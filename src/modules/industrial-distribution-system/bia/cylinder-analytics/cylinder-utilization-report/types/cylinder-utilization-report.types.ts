// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/types/cylinder-utilization-report.types.ts
// ==============================================================================
// Type Definitions for Cylinder Utilization Report (IDS BIA Subsystem)
//
// Data contract shared between the BFF route and the client module. Pure TS
// interfaces only — Zod validation lives in the sibling `.schema.ts` file per
// the project Architecture Rules (`.agents/workflows/core/architecture-rules.md`).
//
// Complies with VoSync standards:
// - Read-only reporting shapes only (no posting / charge / payment writes)
// - snake_case retained for raw Directus rows, camelCase for the view contract
// - Full comments left behind for long-term maintainability
// ==============================================================================

/**
 * Mutually exclusive fleet category a single cylinder asset resolves to.
 *
 * Resolution is precedence-ordered in `classifyAsset` so that no cylinder can
 * be counted in two categories at once (spec §8 constraint).
 */
export type UtilizationBucket =
  | "CIRCULATING" // Deployed out and actively earning
  | "AVAILABLE" // In yard / eligible, last activity inside the idle threshold
  | "IDLE" // In yard / eligible, dormant beyond the idle threshold
  | "MAINTENANCE" // Out of service pending repair
  | "UNAVAILABLE" // Removed from the eligible fleet (lost / retired / scrapped)
  | "UNCLASSIFIED"; // Status absent or outside the source ENUM domain (data exception)

/**
 * Which source record produced an asset's last-activity date.
 * Surfaced per row so a reviewer can audit why a cylinder is called idle.
 */
export type ActivityBasisSource =
  | "ASSET_RECORD" // cylinder_assets.modified_date / created_date audit stamp
  | "SALES_DELIVERY" // sales_order_details_serial.delivery_date (verified order)
  | "SITE_INSTALLATION"; // lpg_customer_site_cylinders.installed_date / removed_date

/**
 * Filter parameters accepted by the report BFF endpoint (spec §2, §5).
 */
export interface CylinderUtilizationFilters {
  startDate: string; // YYYY-MM-DD, reporting period opening boundary
  endDate: string; // YYYY-MM-DD, reporting cutoff the fleet is measured against
  branchId?: number | string; // numeric branch id, or "ALL"
  productId?: number | string; // cylinder size product id, or "" for all sizes
}

/**
 * Raw `cylinder_assets` row as returned by Directus.
 * `is_deleted` is typed loosely because Directus returns 0/1 as number or string.
 */
export interface RawCylinderAssetRow {
  id: number;
  serial_number: string | null;
  product_id: number | null;
  cylinder_status: string | null;
  cylinder_condition: string | null;
  current_branch_id: number | null;
  current_customer_code: string | null;
  created_date: string | null;
  modified_date: string | null;
  is_deleted?: number | string | null;
}

/**
 * Raw verified delivery movement row (`sales_order_details_serial`), the serial
 * keyed outbound movement used to refine an asset's last-activity date.
 */
export interface RawDeliveryMovementRow {
  id: number;
  serial_number: string | null;
  delivery_date: string | null;
  sales_order_id: number | string | null;
  customer_code: string | null;
  branch_id: number | string | null;
  product_id: number | string | null;
}

/**
 * Raw metered-site installation row (`lpg_customer_site_cylinders`), keyed on the
 * asset id rather than the serial number.
 */
export interface RawSiteCylinderMovementRow {
  id: number;
  lpg_site_id: number | string | null;
  customer_code: string | null;
  cylinder_asset_id: number | string | null;
  installed_date: string | null;
  removed_date: string | null;
  site_cylinder_status: string | null;
}

/**
 * Supporting document retained as drill-down evidence for one cylinder (spec §5
 * "open supporting documents"). Includes reversals so a reviewer can see why a
 * movement was or was not counted.
 */
export interface SupportingMovementDocument {
  id: string;
  sourceModule: "SALES_ORDER" | "SALES_ORDER_REVERSAL" | "METERED_SITE";
  documentNo: string;
  documentDate: string | null;
  documentStatus: string | null;
  customerCode: string | null;
  counted: boolean; // true when the document is verified under its posting workflow
  note?: string | null;
}

/**
 * A single cylinder with its resolved bucket, shown in the drill-down panel.
 */
export interface CylinderUtilizationAssetRecord {
  assetId: number;
  serialNumber: string;
  sizeLabel: string;
  productId: number | null;
  branchId: number | null;
  branchName: string;
  customerCode: string | null;
  status: string | null;
  condition: string | null;
  bucket: UtilizationBucket;
  lastActivityDate: string | null;
  activityBasis: ActivityBasisSource | null;
  idleDays: number | null;
  isException: boolean;
  exceptionReason?: string | null;
  movements: SupportingMovementDocument[];
}

/**
 * One results-table row: a branch × cylinder-size grouping (spec §11 columns).
 */
export interface CylinderUtilizationRow {
  branchId: number | null;
  branchName: string;
  productId: number | null;
  sizeLabel: string;
  productCode: string | null;
  fleet: number; // all non-deleted assets in the grouping
  circulating: number;
  available: number;
  idle: number;
  maintenance: number;
  unavailable: number;
  unclassified: number; // missing / out-of-domain statuses (spec §8)
  eligibleFleet: number; // fleet − unavailable − unclassified
  utilization: number; // circulating ÷ eligible fleet × 100
  idleRate: number; // idle ÷ eligible fleet × 100
  averageIdleDays: number | null; // mean dormancy of the idle assets
}

/**
 * KPI summary strip across the whole filtered fleet (spec §7 outputs).
 */
export interface CylinderUtilizationKPIs {
  totalFleet: number;
  eligibleFleet: number;
  circulating: number;
  available: number;
  idle: number;
  maintenance: number;
  unavailable: number;
  unclassified: number;
  utilization: number;
  idleRate: number;
  maintenanceRate: number;
  branchesReported: number;
  sizesReported: number;
  movementsConsidered: number; // verified movement rows applied to last activity
  reversalsExcluded: number; // linked reversals/voids seen but not counted
}

/**
 * The effective business rules behind the figures, echoed by the BFF so the UI
 * legend can never drift from what the server actually applied (spec §4).
 */
export interface UtilizationRuleSnapshot {
  idleThresholdDays: number;
  circulatingStatuses: string[];
  yardStatuses: string[];
  maintenanceStatuses: string[];
  maintenanceConditions: string[];
  unavailableStatuses: string[];
  unavailableConditions: string[];
  activityBasis: string[];
}

/**
 * Known source-data limitations, surfaced to the caller instead of hidden —
 * the same convention the Stock Movement & Variance report follows.
 */
export interface UtilizationSourceLimitation {
  code: string;
  message: string;
}

/**
 * Response contract of the primary BFF endpoint.
 */
export interface CylinderUtilizationReportResponse {
  rows: CylinderUtilizationRow[];
  kpis: CylinderUtilizationKPIs;
  rules: UtilizationRuleSnapshot;
  limitations: UtilizationSourceLimitation[];
  filters: CylinderUtilizationFilters;
  reportingCutoff: string;
  generatedAt: string;
}

/**
 * Lookup options for the filter controls.
 */
export interface UtilizationLookupOptions {
  branches: Array<{ id: number; name: string; code: string }>;
  sizes: Array<{ id: number; label: string; code: string; weight: number | null }>;
}

/**
 * Drill-down response for one branch × size grouping.
 */
export interface CylinderUtilizationDetailResponse {
  branchId: number | null;
  branchName: string;
  productId: number | null;
  sizeLabel: string;
  bucket: UtilizationBucket | null; // bucket the caller drilled into, null = all
  assets: CylinderUtilizationAssetRecord[];
  rules: UtilizationRuleSnapshot;
  reportingCutoff: string;
}
