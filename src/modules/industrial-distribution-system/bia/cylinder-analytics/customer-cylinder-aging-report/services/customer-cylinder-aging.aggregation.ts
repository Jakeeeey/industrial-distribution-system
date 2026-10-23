// services/customer-cylinder-aging.aggregation.ts
// ──────────────────────────────────────────────────────────────────────────────
// Pure computation and aggregation engine for Customer Cylinder Aging Report.
// Calculates exact dwell from cutoff date - issue date, categorizes aging buckets,
// flags estimated FIFO vs exact serial dwell, and computes KPI summaries.
// ──────────────────────────────────────────────────────────────────────────────

import type {
  CustomerCylinderAgingItem,
  CustomerCylinderAgingKPIs,
  CustomerCylinderAgingChartsData,
  CustomerCylinderAgingReportResponse,
  CustomerCylinderAgingFilters,
  AgingBucketType,
  CustomerAgingAction,
  AgingBasisSource,
  CylinderStatusType,
  CylinderConditionType,
  SupportingDocumentRecord,
} from "../types/customer-cylinder-aging.types";

export interface RawCylinderAsset {
  id: number;
  product_id: {
    product_id: number;
    product_code: string | null;
    product_name: string | null;
    product_weight: number | null;
    is_serialized?: number | boolean | null;
  } | number | null;
  serial_number: string;
  cylinder_status: string;
  cylinder_condition: string;
  current_branch_id: {
    id: number;
    branch_code: string | null;
    branch_name: string | null;
  } | number | null;
  current_customer_code: string | null;
  tare_weight: number | null;
  acquisition_date: string | null;
  created_date?: string | null;
  modified_date?: string | null;
}

export interface RawCustomerRecord {
  customer_code: string;
  customer_name: string | null;
  store_name: string | null;
  contact_number: string | null;
  customer_email: string | null;
  brgy: string | null;
  city: string | null;
  province: string | null;
}

export interface RawBranchRecord {
  id: number;
  branch_code: string;
  branch_name: string;
}

export interface RawMovementRow {
  ts: string;
  product_id: number;
  branch_id: number;
  serial_number: string;
  doc_no: string;
  doc_type: string;
  in_qty: number;
  out_qty: number;
  customer_code?: string | null;
  customer_name?: string | null;
  branch_name?: string | null;
}

export interface AggregationInputs {
  cylinders: RawCylinderAsset[];
  customers: RawCustomerRecord[];
  branches: RawBranchRecord[];
  movements: RawMovementRow[];
  filters: CustomerCylinderAgingFilters;
}

function parseDaysBetween(startIso: string, endIso: string): number {
  const dStart = new Date(startIso);
  const dEnd = new Date(endIso);
  if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) return 0;
  const diffMs = dEnd.getTime() - dStart.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function determineBucket(ageDays: number): AgingBucketType {
  if (ageDays <= 15) return "0_15_DAYS";
  if (ageDays <= 30) return "16_30_DAYS";
  if (ageDays <= 60) return "31_60_DAYS";
  if (ageDays <= 90) return "61_90_DAYS";
  return "90_PLUS_DAYS";
}

function determineAction(ageDays: number, threshold: number): CustomerAgingAction {
  if (ageDays > 90) return "FOR_PULL_OUT_REVIEW";
  if (ageDays > 60) return "PRIORITIZE_COLLECTION";
  if (ageDays > threshold) return "FOLLOW_UP_CUSTOMER";
  if (ageDays > 15) return "MONITOR_CUSTOMER";
  return "NO_ACTION_REQUIRED";
}

export function computeCustomerCylinderAgingReport(
  inputs: AggregationInputs
): CustomerCylinderAgingReportResponse {
  const { cylinders, customers, branches, movements, filters } = inputs;
  const cutoffDate = filters.asOfDate || new Date().toISOString().split("T")[0];
  const threshold = Number(filters.agingThreshold) || 30;

  // Build lookup index maps
  const customerMap = new Map<string, RawCustomerRecord>();
  for (const c of customers) {
    if (c.customer_code) customerMap.set(c.customer_code.trim().toUpperCase(), c);
  }

  const branchMap = new Map<number, RawBranchRecord>();
  for (const b of branches) {
    branchMap.set(Number(b.id), b);
  }

  // Group movement records by serial_number
  const movementsBySerial = new Map<string, RawMovementRow[]>();
  for (const m of movements) {
    const sn = (m.serial_number || "").trim().toUpperCase();
    if (!sn) continue;
    if (!movementsBySerial.has(sn)) {
      movementsBySerial.set(sn, []);
    }
    movementsBySerial.get(sn)!.push(m);
  }

  // Sort each serial's movements by timestamp ascending
  for (const list of movementsBySerial.values()) {
    list.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }

  const items: CustomerCylinderAgingItem[] = [];

  for (const raw of cylinders) {
    // Only inspect units with customer
    const status = (raw.cylinder_status || "").trim().toUpperCase();
    if (status !== "WITH_CUSTOMER") continue;

    // Filter by branch if specified
    const branchId =
      typeof raw.current_branch_id === "object" && raw.current_branch_id !== null
        ? Number(raw.current_branch_id.id)
        : Number(raw.current_branch_id || 0);

    if (filters.branchId && Number(filters.branchId) !== branchId) continue;

    // Customer mapping
    const custCode = (raw.current_customer_code || "").trim();
    if (filters.customerCode && filters.customerCode.trim().toUpperCase() !== custCode.toUpperCase()) {
      continue;
    }
    const customerObj = customerMap.get(custCode.toUpperCase());

    // Product info
    const prodObj =
      typeof raw.product_id === "object" && raw.product_id !== null
        ? raw.product_id
        : { product_id: Number(raw.product_id || 0), product_code: "", product_name: "", product_weight: null, is_serialized: 1 };

    if (filters.productId && Number(filters.productId) !== Number(prodObj.product_id)) {
      continue;
    }

    const isSerialized = Boolean(prodObj.is_serialized ?? 1);
    const sn = (raw.serial_number || "").trim().toUpperCase();
    const branchObj = branchMap.get(branchId);

    // Movement history for this cylinder
    const serialMoves = movementsBySerial.get(sn) || [];
    
    // Find verified issue event up to cutoff date
    // Outbound events: out_qty > 0 or specific dispatch doc types
    const eligibleIssueMoves = serialMoves.filter((m) => {
      const moveDate = (m.ts || "").split("T")[0];
      return (
        moveDate <= cutoffDate &&
        (m.out_qty > 0 ||
          m.doc_type.includes("Dispatch") ||
          m.doc_type.includes("POS") ||
          m.doc_type.includes("Assignment") ||
          m.doc_type.includes("Sales Order"))
      );
    });

    let issueDate = "";
    let issueDocNo = "—";
    let issueDocType = "Standard Issue";
    let agingBasisSource: AgingBasisSource = "CYLINDER_CREATED_FALLBACK";
    let isEstimated = !isSerialized;

    if (eligibleIssueMoves.length > 0) {
      // Pick the latest outbound issue event
      const lastIssue = eligibleIssueMoves[eligibleIssueMoves.length - 1];
      issueDate = (lastIssue.ts || "").split("T")[0];
      issueDocNo = lastIssue.doc_no || "—";
      issueDocType = lastIssue.doc_type || "Dispatch";
      agingBasisSource =
        lastIssue.doc_type.includes("POS")
          ? "POS_TRANSACTION"
          : lastIssue.doc_type.includes("Assignment")
          ? "CUSTOMER_ASSIGNMENT"
          : lastIssue.doc_type.includes("Sales Order")
          ? "SALES_ORDER"
          : "VERIFIED_DISPATCH";
    } else {
      // Fallback to acquisition or modified date
      issueDate =
        raw.acquisition_date ||
        (raw.modified_date ? raw.modified_date.split("T")[0] : "") ||
        (raw.created_date ? raw.created_date.split("T")[0] : "") ||
        cutoffDate;
      issueDocNo = "Initial Record";
      issueDocType = "Legacy Asset Creation";
      agingBasisSource = "CYLINDER_CREATED_FALLBACK";
      isEstimated = true;
    }

    const ageDays = parseDaysBetween(issueDate, cutoffDate);
    const bucket = determineBucket(ageDays);

    // Filter by aging bucket if chosen
    if (filters.agingBucket && filters.agingBucket !== "ALL") {
      if (filters.agingBucket === "OVERDUE_ONLY") {
        if (ageDays <= threshold) continue;
      } else if (filters.agingBucket !== bucket) {
        continue;
      }
    }

    const overdueDays = Math.max(0, ageDays - threshold);
    const isOverdue = ageDays > threshold;
    const recommendedAction = determineAction(ageDays, threshold);

    // Format address
    const addressParts = [customerObj?.brgy, customerObj?.city, customerObj?.province].filter(
      Boolean
    );
    const customerAddress = addressParts.join(", ") || "—";

    // Supporting document records
    const supportingDocuments: SupportingDocumentRecord[] = serialMoves.map((m) => ({
      ts: m.ts,
      docNo: m.doc_no,
      docType: m.doc_type,
      inQty: m.in_qty,
      outQty: m.out_qty,
      customerCode: m.customer_code,
      customerName: m.customer_name,
      branchName: m.branch_name,
    }));

    const item: CustomerCylinderAgingItem = {
      id: raw.id,
      serialNumber: raw.serial_number,
      productId: Number(prodObj.product_id),
      productName: prodObj.product_name || "Industrial Gas Cylinder",
      productCode: prodObj.product_code || undefined,
      isSerialized,
      tareWeight: raw.tare_weight,
      cylinderStatus: (raw.cylinder_status as CylinderStatusType) || "WITH_CUSTOMER",
      cylinderCondition: (raw.cylinder_condition as CylinderConditionType) || "GOOD",
      customerCode: custCode || "UNASSIGNED",
      customerName: customerObj?.customer_name || raw.current_customer_code || "Unknown Customer",
      storeName: customerObj?.store_name || undefined,
      contactNumber: customerObj?.contact_number || undefined,
      customerEmail: customerObj?.customer_email || undefined,
      customerAddress,
      branchId,
      branchCode: branchObj?.branch_code || (typeof raw.current_branch_id === "object" && raw.current_branch_id?.branch_code ? raw.current_branch_id.branch_code : "—"),
      branchName: branchObj?.branch_name || (typeof raw.current_branch_id === "object" && raw.current_branch_id?.branch_name ? raw.current_branch_id.branch_name : "Branch"),
      issueDate,
      issueDocNo,
      issueDocType,
      agingBasisSource,
      ageDays,
      agingBucket: bucket,
      agingThreshold: threshold,
      overdueDays,
      isOverdue,
      isEstimated,
      recommendedAction,
      supportingDocuments,
    };

    // Filter by general search query
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      const match =
        item.serialNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.customerCode.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q) ||
        item.issueDocNo.toLowerCase().includes(q);
      if (!match) continue;
    }

    items.push(item);
  }

  // Sort descending by ageDays by default
  items.sort((a, b) => b.ageDays - a.ageDays);

  // Compute KPIs
  const totalUnitsHeld = items.length;
  const overdueUnits = items.filter((i) => i.isOverdue).length;
  const overduePercentage = totalUnitsHeld > 0 ? (overdueUnits / totalUnitsHeld) * 100 : 0;
  const totalDwellDays = items.reduce((acc, curr) => acc + curr.ageDays, 0);
  const averageDwellDays = totalUnitsHeld > 0 ? Math.round(totalDwellDays / totalUnitsHeld) : 0;
  
  const priorityAccountsSet = new Set<string>();
  const allCustomersSet = new Set<string>();
  for (const item of items) {
    allCustomersSet.add(item.customerCode);
    if (item.recommendedAction === "PRIORITIZE_COLLECTION" || item.recommendedAction === "FOR_PULL_OUT_REVIEW") {
      priorityAccountsSet.add(item.customerCode);
    }
  }

  const kpis: CustomerCylinderAgingKPIs = {
    totalUnitsHeld,
    overdueUnits,
    overduePercentage: Number(overduePercentage.toFixed(1)),
    averageDwellDays,
    priorityCollectionAccountsCount: priorityAccountsSet.size,
    totalCustomersWithCylinders: allCustomersSet.size,
  };

  // Compute Chart Visuals
  const bucketCounts: Record<AgingBucketType, number> = {
    "0_15_DAYS": 0,
    "16_30_DAYS": 0,
    "31_60_DAYS": 0,
    "61_90_DAYS": 0,
    "90_PLUS_DAYS": 0,
  };

  for (const item of items) {
    bucketCounts[item.agingBucket] = (bucketCounts[item.agingBucket] || 0) + 1;
  }

  const bucketDistribution = [
    { bucket: "0_15_DAYS", label: "0-15 Days", count: bucketCounts["0_15_DAYS"] },
    { bucket: "16_30_DAYS", label: "16-30 Days", count: bucketCounts["16_30_DAYS"] },
    { bucket: "31_60_DAYS", label: "31-60 Days", count: bucketCounts["31_60_DAYS"] },
    { bucket: "61_90_DAYS", label: "61-90 Days", count: bucketCounts["61_90_DAYS"] },
    { bucket: "90_PLUS_DAYS", label: "90+ Days", count: bucketCounts["90_PLUS_DAYS"] },
  ];

  const compliantCount = items.filter((i) => !i.isOverdue).length;
  const warningCount = items.filter((i) => i.agingBucket === "31_60_DAYS").length;
  const criticalCount = items.filter((i) => i.agingBucket === "61_90_DAYS").length;
  const delinquentCount = items.filter((i) => i.agingBucket === "90_PLUS_DAYS").length;

  const riskDistribution = [
    { name: "Compliant (Normal)", count: compliantCount },
    { name: "Warning (31-60d)", count: warningCount },
    { name: "Critical (61-90d)", count: criticalCount },
    { name: "Delinquent (90d+)", count: delinquentCount },
  ];

  const charts: CustomerCylinderAgingChartsData = {
    bucketDistribution,
    riskDistribution,
  };

  return {
    filters,
    generatedAt: new Date().toISOString(),
    cutoffDate,
    kpis,
    charts,
    items,
  };
}
