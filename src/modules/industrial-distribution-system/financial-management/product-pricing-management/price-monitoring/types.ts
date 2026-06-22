// =============================================================================
// Price Monitoring — Shared Types
// Source contract: Implementation Specification v1.0 | 22 June 2026
// Section 7.2 — Required Response Fields (ViewPriceMonitoringDto)
// =============================================================================

// ---------------------------------------------------------------------------
// Domain enums
// ---------------------------------------------------------------------------

/** Possible price movement directions returned by the Spring API. */
export type PriceMovement = "INCREASE" | "DECREASE" | "NEW PRICE" | "NO CHANGE";

/** Supplier-to-product mapping validation status. */
export type SupplierValidation = "VALID" | "SUPPLIER NOT MAPPED TO PRODUCT";

// ---------------------------------------------------------------------------
// Primary API response shape
// Matches ViewPriceMonitoringDto from the Spring Boot controller.
// Phase 1: read-only — no write fields.
// ---------------------------------------------------------------------------

export interface ViewPriceMonitoringRow {
  /** Unique price change request identifier. */
  requestId: number;
  /** Price change header / batch identifier. */
  headerId: number;
  /** Batch reference number from price_change_headers. */
  referenceNo: string | null;
  /** Batch remarks from price_change_headers. */
  headerRemarks: string | null;
  /** Header status for audit display (e.g. APPROVED). */
  headerStatus: string | null;

  // Supplier fields
  supplierId: number;
  supplierName: string | null;
  supplierShortcut: string | null;
  supplierType: string | null;

  // Product fields
  productId: number;
  productCode: string | null;
  productName: string | null;

  // Price type fields
  priceTypeId: number;
  priceTypeName: string | null;
  /** Frontend ordering; ASC = top of matrix. */
  priceTypeSort: number;

  // Status — always "APPROVED" for Phase 1 returned rows
  requestStatus: string;

  // Price values
  oldPrice: number | null;
  newPrice: number | null;
  priceDifference: number | null;
  priceMovement: PriceMovement | null;
  priceChangePercentage: number | null;

  /** Current active price in product_per_price_type — NOT historical. */
  currentLivePrice: number | null;
  currentPriceStatus: string | null;

  // Audit timestamps
  requestedAt: string | null;
  /** Effective approval time. Mapped from priceChangeDatetime by the API. */
  approvedAt: string | null;
  /** Normally null for Phase 1 APPROVED rows. */
  rejectedAt: string | null;
  /** Primary historical timestamp — use this for year/month grouping. */
  priceChangeDatetime: string | null;

  // Audit metadata
  rejectReason: string | null;
  productSupplierMappingId: number | null;
  supplierProductValidation: SupplierValidation | null;

  // User references
  requestedBy: number | null;
  requestedByName: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  rejectedBy: number | null;
  rejectedByName: string | null;
}

// ---------------------------------------------------------------------------
// Frontend filter/query state
// ---------------------------------------------------------------------------

/** State held by usePriceMonitoring hook for the filter bar. */
export interface PriceMonitoringQuery {
  /** Required. Must be a positive product ID before fetching. */
  productId: number | "";
  productCode?: string | null;
  productLabel?: string | null;
  /** Optional. When "" → API returns all suppliers for the product. */
  supplierId: number | "";
  supplierLabel?: string | null;
  /** Optional client-side start date filter. */
  dateFrom?: Date;
  /** Optional client-side end date filter. */
  dateTo?: Date;
}

// ---------------------------------------------------------------------------
// Frontend grouping shapes (computed by matrixUtils)
// ---------------------------------------------------------------------------

/** All rows for a single price type, sorted by priceChangeDatetime ASC. */
export interface PriceTypeGroup {
  priceTypeId: number;
  priceTypeName: string;
  priceTypeSort: number;
  rows: ViewPriceMonitoringRow[];
}

/**
 * Jan–Dec price values for a single price type in a given year.
 * null = no prior price exists for that month (show dash).
 * A number = carry-forward effective price.
 */
export type MonthlyPrices = (number | null)[];

/** Monthly matrix entry for one price type. */
export interface MonthlyMatrixEntry {
  priceTypeId: number;
  priceTypeName: string;
  priceTypeSort: number;
  /** Index 0 = January, 11 = December. carry-forward. */
  monthlyPrices: MonthlyPrices;
  /** Whether a real change event occurred that month (for cell highlight). */
  changedMonths: boolean[];
  /** The actual change event row for each month (null if carry-forward). */
  changeEvents?: (ViewPriceMonitoringRow | null)[];
  /** currentLivePrice from the latest row for this price type. */
  currentLivePrice: number | null;
}

/** KPI summary for a selected year. */
export interface AnnualSummary {
  /** Highest newPrice in the year across all price types. */
  highestPrice: number | null;
  /** Lowest newPrice in the year across all price types. */
  lowestPrice: number | null;
  /** Average of all newPrice values in the year. */
  averagePrice: number | null;
  /** Count of approved price change events in the year. */
  totalChanges: number;
}

/** KPI summary across all years. */
export interface OverallSummary {
  /** Current live price (from overall latest approved change). */
  currentPrice: number | null;
  /** Timestamp of overall latest change. */
  lastUpdated: string | null;
  /** Highest price overall. */
  highestPrice: number | null;
  /** Year of occurrence for highest price. */
  highestPriceYear: number | null;
  /** Lowest price overall. */
  lowestPrice: number | null;
  /** Year of occurrence for lowest price. */
  lowestPriceYear: number | null;
  /** Average of all changes overall. */
  averagePrice: number | null;
  /** Total count of all approved price changes. */
  totalChanges: number;
}
