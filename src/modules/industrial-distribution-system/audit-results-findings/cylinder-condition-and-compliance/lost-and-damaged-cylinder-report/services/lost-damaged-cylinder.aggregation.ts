// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/services/lost-damaged-cylinder.aggregation.ts
// ==============================================================================
// Lost and Damaged Cylinder Report - Aggregation Engine
// Aggregates cylinder_assets, products, branches, customer, stock adjustments,
// sales returns, and serial movements into a unified, reconciled report dataset.
//
// Rules:
// - Damaged or For Repair cylinders in warehouse remain VERIFIED or REPORTED.
// - An incident is only RECOVERED if supported by a verified sales_return (isReceived = 1)
//   or an approved reversal stock_adjustment (type = 'IN').
// ==============================================================================

import type {
  IncidentRecord,
  KPISummary,
  LostDamagedReportCharts,
  MovementTracePoint,
} from "../types/lost-damaged-cylinder.types";
import type { LostDamagedFilterInput } from "../types/lost-damaged-cylinder.schema";

export interface RawCylinderAsset {
  id: number;
  product_id: number | { product_id: number; product_code?: string; product_name?: string };
  serial_number: string;
  cylinder_status: string;
  cylinder_condition: string;
  current_branch_id: number | { id: number; branch_name?: string; branch_code?: string } | null;
  current_customer_code: string | null;
  tare_weight: number | string | null;
  cost: number | string | null;
  remarks: string | null;
  created_date: string | null;
  modified_date: string | null;
  is_deleted?: number;
}

export interface RawProduct {
  product_id: number;
  product_code: string | null;
  product_name: string | null;
  cost_per_unit: number | null;
  price_per_unit: number | null;
  estimated_unit_cost: number | null;
  product_weight: number | null;
  is_serialized?: number;
}

export interface RawBranch {
  id: number;
  branch_code: string;
  branch_name: string;
  isActive?: number;
}

export interface RawCustomer {
  customer_code: string;
  customer_name: string;
  store_name?: string | null;
  contact_number?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface RawStockAdjustmentHeader {
  id: number;
  doc_no: string;
  branch_id: number | null;
  type: "IN" | "OUT";
  isPosted: boolean | number;
  posted_by?: number | null;
  postedAt?: string | null;
  remarks?: string | null;
  amount?: number | null;
}

export interface RawStockAdjustmentSerial {
  id: number;
  stock_adjustment_id: number;
  serial_number: string;
  created_at?: string;
}

export interface RawSalesReturnSerial {
  id: number;
  sales_return_detail_id: number;
  serial_number: string;
  created_at?: string;
}

export interface RawSalesReturnHeader {
  return_id: number;
  return_number: string;
  customer_code: string;
  branch_id: number | null;
  return_date: string;
  isReceived?: boolean | number;
  received_at?: string | null;
}

export interface RawSerialMovement {
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
  branch_name?: string;
  product_name?: string;
}

export interface AggregationSourceData {
  assets: RawCylinderAsset[];
  products: RawProduct[];
  branches: RawBranch[];
  customers: RawCustomer[];
  adjustments: RawStockAdjustmentHeader[];
  adjustmentSerials: RawStockAdjustmentSerial[];
  salesReturns: RawSalesReturnHeader[];
  salesReturnSerials: RawSalesReturnSerial[];
  movements: RawSerialMovement[];
}

export function aggregateLostDamagedReport(
  data: AggregationSourceData,
  filters: LostDamagedFilterInput
): {
  kpis: KPISummary;
  charts: LostDamagedReportCharts;
  rows: IncidentRecord[];
  totalCount: number;
  reportingCutoff: string;
} {
  const {
    assets,
    products,
    branches,
    customers,
    adjustments,
    adjustmentSerials,
    salesReturns,
    salesReturnSerials,
    movements,
  } = data;

  // Build lookup maps for rapid cross-referencing
  const productMap = new Map<number, RawProduct>();
  for (const p of products) productMap.set(p.product_id, p);

  const branchMap = new Map<number, RawBranch>();
  for (const b of branches) branchMap.set(b.id, b);

  const customerMap = new Map<string, RawCustomer>();
  for (const c of customers) customerMap.set((c.customer_code || "").trim().toUpperCase(), c);

  // Map adjustment headers
  const adjHeaderMap = new Map<number, RawStockAdjustmentHeader>();
  for (const adj of adjustments) adjHeaderMap.set(adj.id, adj);

  // Map serial number to posted stock adjustments
  const serialToAdjustments = new Map<string, RawStockAdjustmentHeader[]>();
  for (const sas of adjustmentSerials) {
    const s = (sas.serial_number || "").trim().toUpperCase();
    const header = adjHeaderMap.get(sas.stock_adjustment_id);
    if (header) {
      if (!serialToAdjustments.has(s)) serialToAdjustments.set(s, []);
      serialToAdjustments.get(s)!.push(header);
    }
  }

  // Map sales returns for recovery verification
  const serialToReturns = new Map<string, RawSalesReturnHeader[]>();
  for (const srs of salesReturnSerials) {
    const s = (srs.serial_number || "").trim().toUpperCase();
    const retHeader = salesReturns.find((r) => r.return_id === srs.sales_return_detail_id);
    if (retHeader) {
      if (!serialToReturns.has(s)) serialToReturns.set(s, []);
      serialToReturns.get(s)!.push(retHeader);
    }
  }

  // Group serial movements for timeline trace
  const serialMovementsMap = new Map<string, RawSerialMovement[]>();
  for (const m of movements) {
    const s = (m.serial_number || "").trim().toUpperCase();
    if (!serialMovementsMap.has(s)) serialMovementsMap.set(s, []);
    serialMovementsMap.get(s)!.push(m);
  }

  const incidents: IncidentRecord[] = [];
  let seq = 10001;

  for (const asset of assets) {
    const serial = (asset.serial_number || "").trim().toUpperCase();
    if (!serial) continue;

    const statusUpper = (asset.cylinder_status || "").toUpperCase();
    const condUpper = (asset.cylinder_condition || "").toUpperCase();

    // Check if asset is Lost, Damaged, Scrap, or For Repair
    const isLost = statusUpper === "LOST";
    const isDamaged =
      statusUpper === "DAMAGED" ||
      condUpper === "DAMAGED" ||
      condUpper === "SCRAP" ||
      condUpper === "FOR_REPAIR";

    // Skip assets that are purely operational/available without incident
    if (!isLost && !isDamaged) {
      const hasAdj = serialToAdjustments.get(serial)?.some((a) => a.type === "OUT");
      if (!hasAdj) continue;
    }

    // Determine category
    const incidentCategory: IncidentRecord["incidentCategory"] = isLost ? "LOST" : "DAMAGED";

    // Determine condition
    let condition: IncidentRecord["condition"] = "GOOD";
    if (condUpper === "DAMAGED") condition = "DAMAGED";
    else if (condUpper === "SCRAP") condition = "SCRAP";
    else if (condUpper === "FOR_REPAIR") condition = "FOR_REPAIR";
    else if (isLost) condition = "GOOD";

    // Check for approved write-offs
    const adjList = serialToAdjustments.get(serial) || [];
    const writeOffAdj = adjList.find((a) => a.type === "OUT" && (a.isPosted === true || a.isPosted === 1));
    const reversalAdj = adjList.find((a) => a.type === "IN" && (a.isPosted === true || a.isPosted === 1));

    // Check for returns / recoveries
    const returnList = serialToReturns.get(serial) || [];
    const recoveryReturn = returnList.find((r) => r.isReceived === true || r.isReceived === 1);

    // Determine lifecycle status accurately
    let status: IncidentRecord["status"] = "REPORTED";
    let recoveryStatus: IncidentRecord["recoveryStatus"] = "PENDING_RECOVERY";

    // If cylinder was marked LOST and subsequently recovered via documented return or reversal adjustment
    if (isLost && (recoveryReturn || reversalAdj)) {
      status = "RECOVERED";
      recoveryStatus = "RECOVERED";
    } else if (writeOffAdj) {
      status = "WRITTEN_OFF";
      recoveryStatus = condUpper === "SCRAP" ? "SCRAPPED" : "WRITTEN_OFF";
    } else if (isDamaged) {
      // Physical condition is damaged / for repair
      if (recoveryReturn) {
        // Customer pulled out / returned a damaged cylinder into warehouse
        status = "VERIFIED";
        recoveryStatus = "RECOVERED";
      } else if (asset.modified_date) {
        status = "VERIFIED";
        recoveryStatus = "PENDING_RECOVERY";
      } else {
        status = "REPORTED";
        recoveryStatus = "PENDING_RECOVERY";
      }
    } else if (asset.modified_date) {
      status = "VERIFIED";
      recoveryStatus = "PENDING_RECOVERY";
    }

    // Charge status evaluation
    let chargeStatus: IncidentRecord["chargeStatus"] = "UNCHARGED";
    if (asset.current_customer_code) {
      if (status === "RECOVERED") {
        chargeStatus = "SETTLED";
      } else if (status === "WRITTEN_OFF") {
        chargeStatus = "WAIVED";
      } else {
        chargeStatus = "ASSESSED";
      }
    }

    // Branch resolution
    const branchId =
      typeof asset.current_branch_id === "object"
        ? asset.current_branch_id?.id ?? 0
        : Number(asset.current_branch_id ?? 0);
    const branch = branchMap.get(branchId);
    const branchName = branch?.branch_name || "Main Warehouse";

    // Product resolution & Valuation
    const prodId =
      typeof asset.product_id === "object"
        ? asset.product_id?.product_id ?? 0
        : Number(asset.product_id ?? 0);
    const prod = productMap.get(prodId);
    const productCode = prod?.product_code || "CYL-PROD";
    const productName = prod?.product_name || "LPG Industrial Cylinder";

    const assessedValue = Number(
      asset.cost ??
        prod?.cost_per_unit ??
        prod?.estimated_unit_cost ??
        prod?.price_per_unit ??
        2800
    );

    // Custodian resolution
    const custCode = (asset.current_customer_code || "").trim().toUpperCase();
    const cust = custCode ? customerMap.get(custCode) : null;
    const custodianName = cust ? cust.store_name || cust.customer_name : branchName;
    const custodianType: IncidentRecord["custodianType"] = custCode ? "Customer" : "Branch";

    // Incident date & days outstanding
    const incidentDate = asset.modified_date
      ? String(asset.modified_date).split(/[ T]/)[0]
      : asset.created_date
      ? String(asset.created_date).split(/[ T]/)[0]
      : new Date().toISOString().split("T")[0];

    const incidentTimestamp = new Date(incidentDate).getTime();
    const now = Date.now();
    const daysOutstanding = Math.max(0, Math.floor((now - incidentTimestamp) / (1000 * 60 * 60 * 24)));

    // Movement trace timeline
    const rawMoves = serialMovementsMap.get(serial) || [];
    const movementsTrace: MovementTracePoint[] = rawMoves.map((m) => {
      let mType: MovementTracePoint["movementType"] = "ASSIGNMENT";
      if (m.in_qty > 0) mType = "IN";
      else if (m.out_qty > 0) mType = "OUT";
      else if (m.doc_type?.toLowerCase().includes("transfer")) mType = "TRANSFER";

      return {
        timestamp: m.ts,
        docNo: m.doc_no || "DOC-SYS",
        docType: m.doc_type || "Movement",
        branchName: m.branch_name || branchName,
        movementType: mType,
        quantity: m.in_qty || m.out_qty || 1,
      };
    });

    const supportingDocNo =
      writeOffAdj?.doc_no ||
      recoveryReturn?.return_number ||
      movementsTrace[0]?.docNo ||
      `ASSET-${asset.id}`;

    incidents.push({
      id: asset.id,
      incidentNo: `INC-${seq++}`,
      serialNumber: serial,
      productCode,
      productName,
      tareWeight: Number(asset.tare_weight ?? 0),
      branchId,
      branchName,
      custodianCode: custCode || branch?.branch_code || "STOCK",
      custodianName,
      custodianType,
      incidentCategory,
      condition,
      status,
      recoveryStatus,
      chargeStatus,
      assessedValue,
      incidentDate,
      daysOutstanding,
      writeOffDocNo: writeOffAdj?.doc_no || null,
      recoveryDocNo: recoveryReturn?.return_number || null,
      supportingDocNo,
      remarks: asset.remarks || "Incident flagged by inventory inspection/reading.",
      movementsTrace,
    });
  }

  // Apply filters
  const filtered = incidents.filter((row) => {
    if (filters.branchId && filters.branchId !== "ALL" && filters.branchId !== "") {
      if (String(row.branchId) !== String(filters.branchId)) return false;
    }
    if (filters.incidentCategory && filters.incidentCategory !== "ALL") {
      if (row.incidentCategory !== filters.incidentCategory) return false;
    }
    if (filters.condition && filters.condition !== "ALL") {
      if (row.condition !== filters.condition) return false;
    }
    if (filters.status && filters.status !== "ALL") {
      if (row.status !== filters.status) return false;
    }
    if (filters.chargeStatus && filters.chargeStatus !== "ALL") {
      if (row.chargeStatus !== filters.chargeStatus) return false;
    }
    if (filters.startDate && row.incidentDate < filters.startDate) return false;
    if (filters.endDate && row.incidentDate > filters.endDate) return false;

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      const match =
        row.incidentNo.toLowerCase().includes(q) ||
        row.serialNumber.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        row.custodianName.toLowerCase().includes(q) ||
        row.supportingDocNo.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    const ord = filters.sortOrder === "asc" ? 1 : -1;
    if (filters.sortBy === "assessedValue") {
      return (a.assessedValue - b.assessedValue) * ord;
    }
    if (filters.sortBy === "daysOutstanding") {
      return (a.daysOutstanding - b.daysOutstanding) * ord;
    }
    if (filters.sortBy === "serialNumber") {
      return a.serialNumber.localeCompare(b.serialNumber) * ord;
    }
    return a.incidentDate.localeCompare(b.incidentDate) * ord;
  });

  // Calculate KPIs
  let lostCount = 0;
  let damagedCount = 0;
  let recoveredCount = 0;
  let writtenOffCount = 0;
  let totalLossValue = 0;
  let recoveredValue = 0;
  let unsettledChargesValue = 0;

  for (const item of filtered) {
    if (item.incidentCategory === "LOST") lostCount++;
    if (item.incidentCategory === "DAMAGED") damagedCount++;
    if (item.status === "RECOVERED") {
      recoveredCount++;
      recoveredValue += item.assessedValue;
    } else {
      totalLossValue += item.assessedValue;
    }

    if (item.status === "WRITTEN_OFF") writtenOffCount++;

    if (item.chargeStatus === "ASSESSED" || item.chargeStatus === "BILLED") {
      unsettledChargesValue += item.assessedValue;
    }
  }

  const totalIncidents = filtered.length;
  const recoveryRate = totalIncidents > 0 ? Math.round((recoveredCount / totalIncidents) * 100) : 0;

  const kpis: KPISummary = {
    totalIncidents,
    lostCount,
    damagedCount,
    recoveredCount,
    writtenOffCount,
    totalLossValue,
    recoveredValue,
    unsettledChargesValue,
    recoveryRate,
  };

  // Compile Colorful Chart Visuals
  const incidentDistribution = [
    { name: "Lost Cylinders", value: lostCount, color: "#ef4444" },
    { name: "Damaged / Repair", value: damagedCount, color: "#f59e0b" },
    { name: "Recovered Assets", value: recoveredCount, color: "#10b981" },
    { name: "Written Off", value: writtenOffCount, color: "#6366f1" },
  ];

  // Group by Month for Trend Chart
  const monthMap = new Map<string, { loss: number; recovered: number; count: number }>();
  for (const item of filtered) {
    const m = item.incidentDate.substring(0, 7) || "2026-01";
    if (!monthMap.has(m)) monthMap.set(m, { loss: 0, recovered: 0, count: 0 });
    const cur = monthMap.get(m)!;
    cur.count++;
    if (item.status === "RECOVERED") {
      cur.recovered += item.assessedValue;
    } else {
      cur.loss += item.assessedValue;
    }
  }

  const monthlyTrend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, val]) => ({
      month,
      lossValue: val.loss,
      recoveredValue: val.recovered,
      incidentCount: val.count,
    }));

  const reportingCutoff = new Date().toISOString().replace("T", " ").substring(0, 19);

  return {
    kpis,
    charts: {
      incidentDistribution,
      monthlyTrend,
    },
    rows: filtered,
    totalCount: filtered.length,
    reportingCutoff,
  };
}
