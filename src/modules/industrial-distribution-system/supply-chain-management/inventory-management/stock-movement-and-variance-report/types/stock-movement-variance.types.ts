// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/types/stock-movement-variance.types.ts
// ==============================================================================
// Type Definitions for Stock Movement and Variance Report (IDS SCM)
//
// Source of truth for the calculation contract shared between the BFF route and
// the client module:
//   Expected = opening + in − out
//   Variance = counted − expected
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// - Read-only reporting types only (no posting / charge / payment shapes)
// ==============================================================================

/**
 * Filter parameters accepted by the report BFF endpoint.
 */
export interface StockMovementVarianceFilters {
  startDate: string; // YYYY-MM-DD, period opening boundary
  endDate: string; // YYYY-MM-DD, reporting cutoff
  branchId?: number | string; // Required for a meaningful ledger
  categoryId?: number | string;
  productName?: string;
}

/**
 * A single operational movement as returned by the Spring-backed
 * `view-product-movements` ledger. Field casing is intentionally permissive:
 * the view has historically returned both camelCase and snake_case variants.
 */
export interface RawMovementRow {
  ts?: string | number;
  docType?: string;
  doc_no?: string;
  docNo?: string;
  inBase?: number;
  in_base?: number;
  outBase?: number;
  out_base?: number;
  variance?: number;
  unitCount?: number;
  productId?: number | string;
  product_id?: number | string;
  branchId?: number | string;
  branch_id?: number | string;
  productName?: string;
  branchName?: string;
  descr?: string;
  system_count?: number;
  physical_count?: number;
}

/**
 * A committed physical-count line (Directus `physical_inventory_details`)
 * with its header context flattened by the BFF.
 */
export interface RawCountLine {
  id: number;
  phId: number;
  phNo: string;
  branchId: number;
  cutOffDate: string | null;
  dateEncoded: string | null;
  productId: number;
  systemCount: number;
  physicalCount: number;
  sourceVariance: number;
  offsetMatch: number | null;
  serials: string[];
}

/**
 * Ledger document retained in the drill-down panel as supporting evidence.
 */
export interface SupportingDocument {
  docNo: string;
  docType: string;
  ts: string;
  inBase: number;
  outBase: number;
  /** Variance restatement applied by a Physical Inventory document, in base units. */
  countAdjustment: number;
  descr: string;
}

/**
 * Serial recorded on a physical count that cannot be matched to an asset or a
 * movement record. Spec §8 requires these as separate exception details.
 */
export interface SerialException {
  serialNumber: string;
  phNo: string;
  reason: string;
}

/**
 * Data-exception codes surfaced on a report row. Reporting never repairs these;
 * corrective action stays in the originating module (spec §6).
 */
export type VarianceExceptionCode =
  | "NO_COUNT" // No committed physical count covers this product at the cutoff
  | "UNMATCHED_SERIAL" // Counted serial not resolvable to an asset or movement
  | "VOID_REVERSAL" // Movement document later voided; view does not reverse it
  | "VARIANCE_DRIFT" // Computed variance disagrees with the variance posted by the count
  | "POST_CUTOFF_MOVEMENT"; // Movements exist after the count cutoff that move the balance

/**
 * One reconciled product/branch line of the report. All quantities are in BASE
 * units so that boxed and loose products reconcile against the same ledger.
 */
export interface StockMovementVarianceRow {
  productId: number;
  productCode: string | null;
  productName: string;
  branchId: number;
  branchName: string;
  categoryName: string | null;
  unitCount: number;

  openingBalance: number;
  periodIn: number;
  periodOut: number;
  expectedClosing: number;

  countedClosing: number | null;
  variance: number | null;
  variancePercent: number | null;

  countDocNo: string | null;
  countCutoffDate: string | null;
  countSystemQty: number | null;
  countSourceVariance: number | null;

  exceptionCodes: VarianceExceptionCode[];
  adjustmentReferences: string[];
  supportingDocuments: SupportingDocument[];
  serialExceptions: SerialException[];
}

/**
 * KPI summary values rendered above the results table.
 */
export interface StockMovementVarianceKpis {
  totalLines: number;
  linesWithVariance: number;
  linesCounted: number;
  linesUncounted: number;
  netVarianceUnits: number;
  shortUnits: number;
  overUnits: number;
  exceptionLines: number;
  unmatchedSerials: number;
  voidReversalDocuments: number;
}

/**
 * Full successful report payload returned by the BFF.
 */
export interface StockMovementVarianceReportResponse {
  ok: true;
  generatedAt: string;
  filters: StockMovementVarianceFilters;
  branchName: string | null;
  /** Documents excluded because a later void reversed them. Kept for audit visibility. */
  excludedDocuments: SupportingDocument[];
  rows: StockMovementVarianceRow[];
  kpis: StockMovementVarianceKpis;
  warnings: string[];
}

/**
 * Error payload returned by the BFF on any failure path.
 */
export interface StockMovementVarianceError {
  ok: false;
  error: string;
  message?: string;
}

/**
 * Dropdown option shapes for the filter bar.
 */
export interface VarianceLookupOption {
  id: number | string;
  label: string;
  secondary?: string;
}

export interface StockMovementVarianceLookupOptions {
  branches: VarianceLookupOption[];
  categories: VarianceLookupOption[];
  products: VarianceLookupOption[];
}
