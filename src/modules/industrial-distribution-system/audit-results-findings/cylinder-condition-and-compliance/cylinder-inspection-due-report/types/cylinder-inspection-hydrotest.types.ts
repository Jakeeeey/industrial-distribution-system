// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/types/cylinder-inspection-hydrotest.types.ts
// ==============================================================================
// Cylinder Inspection and Hydrotest Due Report - Type Definitions
// Complies with VoSync development standards:
// - Comprehensive comments left behind for long-term maintainability
// - Exact types conforming to DDL schemas: cylinder_assets, products, units, customer, branches, v_serial_movements
// ==============================================================================

/**
 * Compliance status classification for cylinder inspection and hydrotesting.
 * - OVERDUE: Expiration date is strictly before reporting cutoff (today).
 * - DUE_SOON: Expiration date falls within configured warning period (<= cutoff + warningDays).
 * - FAILED: Condition is FOR_REPAIR, DAMAGED, or SCRAP.
 * - MISSING_CERT: Expiration date is null or unrecorded (Unknown rather than compliant).
 * - COMPLIANT: Expiration date is beyond warning period and condition is GOOD.
 */
export type InspectionComplianceStatus =
  | "OVERDUE"
  | "DUE_SOON"
  | "FAILED"
  | "MISSING_CERT"
  | "COMPLIANT";

export type CylinderCondition = "GOOD" | "FOR_REPAIR" | "DAMAGED" | "SCRAP";

export type CylinderStatus =
  | "AVAILABLE"
  | "FULL"
  | "EMPTY"
  | "RESERVED"
  | "LOADED"
  | "WITH_CUSTOMER"
  | "DAMAGED"
  | "LOST"
  | "RETIRED"
  | "WITH_SUPPLIER"
  | "UNRECEIVED/REPLACED";

/**
 * Raw record structure from Directus cylinder_assets collection.
 */
export interface RawCylinderAsset {
  id: number;
  product_id: number;
  serial_number: string;
  cylinder_status: CylinderStatus;
  cylinder_condition: CylinderCondition;
  current_branch_id: number | null;
  current_customer_code: string | null;
  current_supplier_id: number | null;
  acquisition_date: string | null;
  expiration_date: string | null;
  tare_weight: number | string | null;
  cost: number | string | null;
  remarks: string | null;
  created_by?: number | null;
  created_date?: string | null;
  modified_by?: number | null;
  modified_date?: string | null;
  is_deleted?: number | string | null;
}

/**
 * Raw record structure from Directus products collection.
 */
export interface RawProduct {
  product_id: number;
  product_code: string | null;
  product_name: string | null;
  is_serialized: number | boolean;
  unit_of_measurement: number | null;
  uom_ids: string | null;
  weight: number | string | null;
  product_weight: number | string | null;
  isActive?: number | boolean | null;
}

/**
 * Raw record structure from Directus units collection.
 * Allowed units: 1, 18, 19, 20, 21, 22, 23
 */
export interface RawUnit {
  unit_id: number;
  unit_name: string;
  unit_shortcut: string | null;
  sku_code: string | null;
}

/**
 * Raw record structure from Directus branches collection.
 */
export interface RawBranch {
  id: number;
  branch_code: string;
  branch_name: string;
  isActive?: number | boolean | null;
}

/**
 * Raw record structure from Directus customer collection.
 */
export interface RawCustomer {
  customer_code: string;
  customer_name: string;
  store_name?: string | null;
  contact_number?: string | null;
  city?: string | null;
  province?: string | null;
}

/**
 * Raw serial movement record from Spring Boot endpoint /api/view-serial-movements/all (v_serial_movements view).
 */
export interface RawSerialMovement {
  ts: string;
  product_id: number;
  branch_id: number;
  serial_number: string;
  doc_no: string;
  doc_type: string;
  in_qty: number;
  out_qty: number;
  customer_code: string | null;
  customer_name: string | null;
  supplier_name?: string | null;
  product_name?: string | null;
  branch_name?: string | null;
  uom_ids?: string | null;
}

/**
 * Normalized movement timeline point for the inspection drilldown drawer.
 */
export interface MovementTracePoint {
  timestamp: string;
  docNo: string;
  docType: string;
  branchName: string;
  counterparty: string;
  movementType: "IN" | "OUT" | "TRANSFER" | "ASSIGNMENT";
  quantity: number;
}

/**
 * Unified inspection record displayed in the report table and drawer.
 */
export interface CylinderInspectionRecord {
  id: number;
  serialNumber: string;
  productId: number;
  productCode: string;
  productName: string;
  unitShortcut: string;
  tareWeight: number;
  branchId: number;
  branchName: string;
  custodianCode: string;
  custodianName: string;
  custodianType: "Customer" | "Branch" | "Supplier";
  condition: CylinderCondition;
  status: CylinderStatus;
  acquisitionDate: string | null;
  expirationDate: string | null;
  daysRemaining: number | null; // null if expirationDate is unrecorded
  complianceStatus: InspectionComplianceStatus;
  isRetired: boolean;
  remarks: string;
  movementsTrace: MovementTracePoint[];
}

/**
 * Executive KPI summary metrics for cylinder compliance and hydrotest readiness.
 */
export interface InspectionKPISummary {
  totalAudited: number;
  compliantCount: number;
  dueSoonCount: number;
  overdueCount: number;
  failedCount: number;
  missingCertCount: number;
  complianceRate: number; // percentage (0 - 100)
}

/**
 * Distribution item for visual donut charts.
 */
export interface StatusDistributionItem {
  name: string;
  value: number;
  color: string;
}

/**
 * Horizon distribution item for expiration timeline bar charts.
 */
export interface ExpirationHorizonItem {
  horizon: string;
  count: number;
  color: string;
}

export interface InspectionReportCharts {
  statusDistribution: StatusDistributionItem[];
  expirationHorizon: ExpirationHorizonItem[];
}

export interface CylinderInspectionLookupsResponse {
  branches: Array<{ id: number; branch_code: string; branch_name: string }>;
  products: Array<{ product_id: number; product_code: string; product_name: string }>;
}

export interface CylinderInspectionReportResponse {
  kpis: InspectionKPISummary;
  charts: InspectionReportCharts;
  rows: CylinderInspectionRecord[];
  totalCount: number;
  reportingCutoff: string;
}
