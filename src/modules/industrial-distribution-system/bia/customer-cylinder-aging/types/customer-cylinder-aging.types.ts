// types/customer-cylinder-aging.types.ts
// ──────────────────────────────────────────────────────────────────────────────
// Pure TypeScript interfaces matching the Directus-sourced cylinder aging data.
// Revamped from Spring DTO to Directus multi-fetch aggregation (Phase 1).
// All derived fields (days, status, action) are computed in the BFF route.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * How the aging basis date was determined.
 * CYLINDER_CREATED_DATE_FALLBACK added to match SQL CASE logic.
 */
export type AgingBasisSource =
  | "DEPLOYED_DATE"
  | "LAST_TRANSACTION_DATE"
  | "CYLINDER_MODIFIED_DATE_FALLBACK"
  | "CYLINDER_CREATED_DATE_FALLBACK";

/**
 * Customer activity classification — matches the SQL CASE thresholds exactly:
 *   0-7   → ACTIVE
 *   8-15  → MONITORING
 *   16-30 → WARNING
 *   31-60 → INACTIVE
 *   61+   → CRITICAL
 *   null  → NO_TRANSACTION_RECORD
 */
export type CustomerActivityStatus =
  | "ACTIVE"
  | "MONITORING"
  | "WARNING"
  | "INACTIVE"
  | "CRITICAL"
  | "NO_TRANSACTION_RECORD"
  | "UNKNOWN";

/**
 * Recommended operational action — matches the SQL CASE thresholds exactly:
 *   null        → VERIFY_CUSTOMER
 *   61+         → FOR_PULL_OUT_REVIEW
 *   31-60       → FOLLOW_UP_CUSTOMER
 *   16-30       → MONITOR_CUSTOMER
 *   < 16        → NO_ACTION_REQUIRED
 */
export type RecommendedAction =
  | "VERIFY_CUSTOMER"
  | "FOR_PULL_OUT_REVIEW"
  | "FOLLOW_UP_CUSTOMER"
  | "MONITOR_CUSTOMER"
  | "NO_ACTION_REQUIRED";

/** Physical state of the cylinder in the asset lifecycle. */
export type CylinderStatus =
  | "AVAILABLE"
  | "FULL"
  | "EMPTY"
  | "RESERVED"
  | "LOADED"
  | "WITH_CUSTOMER"
  | "DAMAGED"
  | "LOST"
  | "RETIRED";

/** Physical condition of the cylinder. */
export type CylinderCondition = "GOOD" | "FOR_REPAIR" | "DAMAGED" | "SCRAP";

/**
 * Full record for a single Customer Cylinder Aging entry.
 * Constructed by the BFF route from Directus cylinder_assets + computed fields.
 * Transaction fields (deployedDate, lastTransactionDate, etc.) are null in Phase 1.
 */
export interface CustomerCylinderAgingRecord {
  // ── Asset identity ──────────────────────────────────────────────────────────
  cylinderAssetId: number;
  serialNumber: string;

  // ── Product info ────────────────────────────────────────────────────────────
  productId: number;
  productCode: string | null;
  productName: string | null;
  productWeight: number | null;

  // ── Cylinder state ──────────────────────────────────────────────────────────
  cylinderStatus: CylinderStatus;
  cylinderCondition: CylinderCondition;

  // ── Customer info ────────────────────────────────────────────────────────────
  customerCode: string;
  customerName: string | null;
  storeName: string | null;
  contactNumber: string | null;
  customerEmail: string | null;
  customerAddress: string | null;   // CONCAT_WS(', ', brgy, city, province)

  // ── Branch info ──────────────────────────────────────────────────────────────
  branchId: number | null;
  branchName: string | null;
  branchCode: string | null;

  // ── Asset dates ──────────────────────────────────────────────────────────────
  acquisitionDate: string | null;   // YYYY-MM-DD
  expirationDate: string | null;    // YYYY-MM-DD
  tareWeight: number | null;
  cost: number | null;

  // ── Deployment context (Phase 1: all null — no transaction data yet) ─────────
  deployedDate: string | null;
  deployedSourceModule: string | null;
  deployedTransactionSource: string | null;
  deployedInvoiceId: number | null;
  deployedInvoiceNo: string | null;
  deployedSalesOrderId: number | null;
  deployedOrderNo: string | null;
  deployedPosTransactionId: string | null;
  deployedConsolidatorId: number | null;
  deployedConsolidatorNo: string | null;
  deployedDispatchId: number | null;
  deployedDispatchNo: string | null;
  deployedPostDispatchDocNo: string | null;
  customerMappingConfidence: string | null;

  // ── Aging core fields — computed from Directus dates in the BFF ──────────────
  agingBasisDate: string | null;    // YYYY-MM-DD
  agingBasisSource: AgingBasisSource | null;
  daysWithCustomer: number | null;

  // ── Last transaction (Phase 1: all null) ─────────────────────────────────────
  lastTransactionDate: string | null;
  lastSourceModule: string | null;
  lastTransactionSource: string | null;
  lastInvoiceId: number | null;
  lastInvoiceNo: string | null;
  lastSalesOrderId: number | null;
  lastOrderNo: string | null;
  lastPosTransactionId: string | null;
  lastConsolidatorId: number | null;
  lastConsolidatorNo: string | null;
  lastDispatchId: number | null;
  lastDispatchNo: string | null;
  lastPostDispatchDocNo: string | null;
  lastNetAmount: number | null;
  daysSinceLastTransaction: number | null;

  // ── Analytics flags — computed in BFF from daysWithCustomer ──────────────────
  customerActivityStatus: CustomerActivityStatus;
  recommendedAction: RecommendedAction;
}

export interface CustomerCylinderAgingSummary {
  customerCode: string;
  customerName: string | null;
  storeName: string | null;
  contactNumber: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  branchName: string | null;
  branchCode: string | null;
  productsDeployed: string[];
  totalCylinders: number;
  activeCylinders: number;
  warningCylinders: number;
  criticalCylinders: number;
  averageDaysWithCustomer: number | null;
  maxDaysWithCustomer: number | null;
  lastTransactionDate: string | null;
  daysSinceLastTransaction: number | null;
  customerActivityStatus: CustomerActivityStatus;
  recommendedAction: RecommendedAction;
}

export interface CustomerTransactionHistoryRecord {
  id: number | string;
  sourceModule: "POS" | "BULK";
  transactionSource: "POS_TRANSACTION" | "BULK_SALES_ORDER";
  serialNumber: string;
  movementType: "IN" | "OUT";
  movementDescription: string;
  transactionDate: string;
  referenceNo: string | null;
  productCode: string | null;
  productName: string | null;
  netAmount: number | null;
}

export interface CustomerCylinderDetail {
  customerCode: string;
  customerName: string | null;
  storeName: string | null;
  contactNumber: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  branchName: string | null;
  branchCode: string | null;
  connectedCylinders: CustomerCylinderAgingRecord[];
  transactions: CustomerTransactionHistoryRecord[];
}


/**
 * Filter params sent to the BFF /api/ids/bia/customer-cylinder-aging route.
 * All fields optional — Directus returns all WITH_CUSTOMER records if none provided.
 * startDate/endDate filter on acquisition_date of the cylinder asset.
 */
export interface CustomerCylinderAgingFilters {
  productId?: number | "";
  customerCode?: string;
  branchId?: number | "";      // Added: filter by branch
  startDate?: string;          // YYYY-MM-DD — filters acquisition_date >= startDate
  endDate?: string;            // YYYY-MM-DD — filters acquisition_date <= endDate
}
