// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/services/cylinder-inspection-hydrotest.aggregation.ts
// ==============================================================================
// Cylinder Inspection and Hydrotest Due Report - Aggregation Engine
// Complies with VoSync development standards:
// - Comments on all changes and calculation logic
// - Calculates daysRemaining based on reporting cutoff
// - Statuses: OVERDUE, DUE_SOON, FAILED, MISSING_CERT, COMPLIANT
// - Sourced directly from cylinder_assets without cylinder_inspection_logs table
// ==============================================================================

import type {
  RawCylinderAsset,
  RawProduct,
  RawUnit,
  RawBranch,
  RawCustomer,
  RawSerialMovement,
  CylinderInspectionRecord,
  InspectionComplianceStatus,
  InspectionKPISummary,
  InspectionReportCharts,
  CylinderInspectionReportResponse,
  MovementTracePoint,
} from "../types/cylinder-inspection-hydrotest.types";
import type { CylinderInspectionFilterInput } from "../types/cylinder-inspection-hydrotest.schema";

export interface AggregationSourceData {
  assets: RawCylinderAsset[];
  products: RawProduct[];
  units: RawUnit[];
  branches: RawBranch[];
  customers: RawCustomer[];
  movements: RawSerialMovement[];
}

/**
 * Calculates calendar day difference between target date and base date.
 * Returns negative if target is in the past, positive if in future.
 */
function calculateDaysDifference(targetDateStr: string, baseDate: Date): number {
  const target = new Date(targetDateStr.split("T")[0]);
  if (isNaN(target.getTime())) return 0;

  const baseOnly = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const targetOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  const diffTime = targetOnly.getTime() - baseOnly.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determines compliance classification based on condition, expiration date, and warning window.
 * Rule: Missing due date is classified as MISSING_CERT / Unknown rather than compliant.
 */
function classifyComplianceStatus(
  condition: RawCylinderAsset["cylinder_condition"],
  expirationDate: string | null,
  daysRemaining: number | null,
  warningDays: number
): InspectionComplianceStatus {
  // If physical cylinder condition is failed or defective, it is FAILED
  if (condition === "FOR_REPAIR" || condition === "DAMAGED" || condition === "SCRAP") {
    return "FAILED";
  }

  // Missing or unrecorded hydrotest expiration date
  if (!expirationDate || daysRemaining === null) {
    return "MISSING_CERT";
  }

  // Hydrotest date is past cutoff
  if (daysRemaining < 0) {
    return "OVERDUE";
  }

  // Due within configured warning threshold (e.g. within 30, 60, or 90 days)
  if (daysRemaining <= warningDays) {
    return "DUE_SOON";
  }

  return "COMPLIANT";
}

/**
 * Aggregates raw relational tables and movement ledger into comprehensive report payload.
 */
export function aggregateInspectionHydrotestReport(
  source: AggregationSourceData,
  filters: CylinderInspectionFilterInput
): CylinderInspectionReportResponse {
  const cutoffDate = new Date();
  const cutoffIso = cutoffDate.toISOString();
  const warningWindow = filters.warningDays || 30;

  // Build lookup maps for O(1) correlation
  const productMap = new Map<number, RawProduct>();
  source.products.forEach((p) => productMap.set(Number(p.product_id), p));

  const unitMap = new Map<number, RawUnit>();
  source.units.forEach((u) => unitMap.set(Number(u.unit_id), u));

  const branchMap = new Map<number, RawBranch>();
  source.branches.forEach((b) => branchMap.set(Number(b.id), b));

  const customerMap = new Map<string, RawCustomer>();
  source.customers.forEach((c) => {
    if (c.customer_code) customerMap.set(String(c.customer_code).trim().toUpperCase(), c);
  });

  // Group movement traces by serial number for drawer timeline lookup
  const movementMap = new Map<string, MovementTracePoint[]>();
  source.movements.forEach((m) => {
    const sn = String(m.serial_number || "").trim().toUpperCase();
    if (!sn) return;

    let movementType: MovementTracePoint["movementType"] = "ASSIGNMENT";
    if (m.in_qty > 0 && m.out_qty === 0) movementType = "IN";
    else if (m.out_qty > 0 && m.in_qty === 0) movementType = "OUT";
    else if (m.doc_type?.toLowerCase().includes("transfer")) movementType = "TRANSFER";

    const point: MovementTracePoint = {
      timestamp: m.ts,
      docNo: m.doc_no || "—",
      docType: m.doc_type || "Movement",
      branchName: m.branch_name || "Branch",
      counterparty: m.customer_name || m.supplier_name || m.customer_code || "Warehouse",
      movementType,
      quantity: Math.max(m.in_qty, m.out_qty, 1),
    };

    if (!movementMap.has(sn)) {
      movementMap.set(sn, []);
    }
    movementMap.get(sn)!.push(point);
  });

  // Transform raw cylinder assets
  const normalizedRecords: CylinderInspectionRecord[] = [];

  for (const asset of source.assets) {
    // Check deletion status
    if (Number(asset.is_deleted ?? 0) === 1) continue;

    // Filter retired cylinders unless toggle is active
    const isRetired = asset.cylinder_status === "RETIRED";
    if (isRetired && !filters.includeRetired) {
      continue;
    }

    const serial = String(asset.serial_number || "").trim().toUpperCase();
    const product = productMap.get(Number(asset.product_id));
    const unit = product?.unit_of_measurement ? unitMap.get(Number(product.unit_of_measurement)) : null;
    const branch = asset.current_branch_id ? branchMap.get(Number(asset.current_branch_id)) : null;

    // Custodian determination
    let custodianCode = "BRANCH";
    let custodianName = branch?.branch_name || "Central Warehouse";
    let custodianType: CylinderInspectionRecord["custodianType"] = "Branch";

    if (asset.current_customer_code) {
      const codeKey = String(asset.current_customer_code).trim().toUpperCase();
      const cust = customerMap.get(codeKey);
      custodianCode = asset.current_customer_code;
      custodianName = cust?.store_name || cust?.customer_name || `Customer #${asset.current_customer_code}`;
      custodianType = "Customer";
    } else if (asset.cylinder_status === "WITH_SUPPLIER") {
      custodianCode = `SUPP-${asset.current_supplier_id || "EXT"}`;
      custodianName = `Supplier Partner (#${asset.current_supplier_id || "Ext"})`;
      custodianType = "Supplier";
    }

    const expDateStr = asset.expiration_date ? String(asset.expiration_date).split("T")[0] : null;
    const acqDateStr = asset.acquisition_date ? String(asset.acquisition_date).split("T")[0] : null;

    const daysRemaining = expDateStr ? calculateDaysDifference(expDateStr, cutoffDate) : null;

    const complianceStatus = classifyComplianceStatus(
      asset.cylinder_condition,
      expDateStr,
      daysRemaining,
      warningWindow
    );

    // Sort movement trace newest to oldest
    const rawTrace = movementMap.get(serial) || [];
    const sortedTrace = [...rawTrace].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    normalizedRecords.push({
      id: asset.id,
      serialNumber: serial,
      productId: asset.product_id,
      productCode: product?.product_code || "—",
      productName: product?.product_name || `Product #${asset.product_id}`,
      unitShortcut: unit?.unit_shortcut || "cyl",
      tareWeight: Number(asset.tare_weight ?? 0),
      branchId: asset.current_branch_id ?? 0,
      branchName: branch?.branch_name || "Unassigned Branch",
      custodianCode,
      custodianName,
      custodianType,
      condition: asset.cylinder_condition,
      status: asset.cylinder_status,
      acquisitionDate: acqDateStr,
      expirationDate: expDateStr,
      daysRemaining,
      complianceStatus,
      isRetired,
      remarks: asset.remarks || "No recorded remarks",
      movementsTrace: sortedTrace,
    });
  }

  // Apply user filter criteria first to calculate KPIs, charts, and table rows for the active cohort
  let filtered = normalizedRecords;

  if (filters.branchId) {
    const targetBranch = Number(filters.branchId);
    filtered = filtered.filter((r) => Number(r.branchId) === targetBranch);
  }

  if (filters.complianceStatus && filters.complianceStatus !== "ALL") {
    filtered = filtered.filter((r) => r.complianceStatus === filters.complianceStatus);
  }

  if (filters.condition && filters.condition !== "ALL") {
    filtered = filtered.filter((r) => r.condition === filters.condition);
  }

  if (filters.productId) {
    const targetProd = Number(filters.productId);
    filtered = filtered.filter((r) => Number(r.productId) === targetProd);
  }

  if (filters.searchQuery && filters.searchQuery.trim()) {
    const q = filters.searchQuery.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.serialNumber.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.productCode.toLowerCase().includes(q) ||
        r.custodianName.toLowerCase().includes(q) ||
        r.custodianCode.toLowerCase().includes(q) ||
        r.branchName.toLowerCase().includes(q) ||
        r.remarks.toLowerCase().includes(q)
    );
  }

  // Calculate executive KPI summary across the filtered active cohort
  const totalAudited = filtered.length;
  let compliantCount = 0;
  let dueSoonCount = 0;
  let overdueCount = 0;
  let failedCount = 0;
  let missingCertCount = 0;

  filtered.forEach((r) => {
    switch (r.complianceStatus) {
      case "COMPLIANT":
        compliantCount++;
        break;
      case "DUE_SOON":
        dueSoonCount++;
        break;
      case "OVERDUE":
        overdueCount++;
        break;
      case "FAILED":
        failedCount++;
        break;
      case "MISSING_CERT":
        missingCertCount++;
        break;
    }
  });

  const complianceRate =
    totalAudited > 0 ? Math.round((compliantCount / totalAudited) * 1000) / 10 : 0;

  const kpis: InspectionKPISummary = {
    totalAudited,
    compliantCount,
    dueSoonCount,
    overdueCount,
    failedCount,
    missingCertCount,
    complianceRate,
  };

  // Generate Visual Distribution Charts for active cohort
  const charts: InspectionReportCharts = {
    statusDistribution: [
      { name: "Compliant", value: compliantCount, color: "#10b981" },
      { name: "Due Soon", value: dueSoonCount, color: "#f59e0b" },
      { name: "Overdue", value: overdueCount, color: "#ef4444" },
      { name: "Failed / Defective", value: failedCount, color: "#e11d48" },
      { name: "Missing Cert", value: missingCertCount, color: "#8b5cf6" },
    ],
    expirationHorizon: [
      { horizon: "Overdue", count: overdueCount, color: "#ef4444" },
      { horizon: "<= 30 Days", count: filtered.filter((r) => r.daysRemaining !== null && r.daysRemaining >= 0 && r.daysRemaining <= 30).length, color: "#f59e0b" },
      { horizon: "31-60 Days", count: filtered.filter((r) => r.daysRemaining !== null && r.daysRemaining > 30 && r.daysRemaining <= 60).length, color: "#eab308" },
      { horizon: "61-90 Days", count: filtered.filter((r) => r.daysRemaining !== null && r.daysRemaining > 60 && r.daysRemaining <= 90).length, color: "#06b6d4" },
      { horizon: "> 90 Days", count: filtered.filter((r) => r.daysRemaining !== null && r.daysRemaining > 90).length, color: "#10b981" },
      { horizon: "Unknown", count: missingCertCount, color: "#8b5cf6" },
    ],
  };

  // Apply column sorting
  const sortBy = filters.sortBy || "expirationDate";
  const sortOrder = filters.sortOrder || "asc";
  const mult = sortOrder === "desc" ? -1 : 1;

  filtered.sort((a, b) => {
    if (sortBy === "serialNumber") {
      return a.serialNumber.localeCompare(b.serialNumber) * mult;
    }
    if (sortBy === "productName") {
      return a.productName.localeCompare(b.productName) * mult;
    }
    if (sortBy === "daysRemaining") {
      const aVal = a.daysRemaining ?? 999999;
      const bVal = b.daysRemaining ?? 999999;
      return (aVal - bVal) * mult;
    }
    if (sortBy === "complianceStatus") {
      return a.complianceStatus.localeCompare(b.complianceStatus) * mult;
    }
    if (sortBy === "condition") {
      return a.condition.localeCompare(b.condition) * mult;
    }
    // Default: expirationDate
    const aDate = a.expirationDate ? new Date(a.expirationDate).getTime() : 9999999999999;
    const bDate = b.expirationDate ? new Date(b.expirationDate).getTime() : 9999999999999;
    return (aDate - bDate) * mult;
  });

  const totalCount = filtered.length;

  return {
    kpis,
    charts,
    rows: filtered,
    totalCount,
    reportingCutoff: cutoffIso,
  };
}
