// types/customer-cylinder-aging.types.ts
// ──────────────────────────────────────────────────────────────────────────────
// Pure TypeScript interfaces mirroring the Spring DTO.
// No Zod here — Zod lives exclusively in customer-cylinder-aging.schema.ts.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Source used by the Spring backend to determine the aging basis date.
 * The backend falls back through a priority chain when direct transaction data
 * is unavailable, e.g.: DEPLOYED_DATE → LAST_TRANSACTION_DATE → CYLINDER_MODIFIED_DATE_FALLBACK.
 */
export type AgingBasisSource =
  | "DEPLOYED_DATE"
  | "LAST_TRANSACTION_DATE"
  | "CYLINDER_MODIFIED_DATE_FALLBACK";

/**
 * Whether the customer has made any transactions against this cylinder.
 * NO_TRANSACTION_RECORD means the Spring view found no invoice/dispatch/POS hits.
 */
export type CustomerActivityStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "NO_TRANSACTION_RECORD";

/**
 * Recommended operational action surfaced by the Spring aging engine.
 */
export type RecommendedAction =
  | "OK"
  | "FOLLOW_UP"
  | "RETRIEVE"
  | "VERIFY_CUSTOMER";

/** Physical state of the cylinder in the asset lifecycle. */
export type CylinderStatus = "WITH_CUSTOMER" | "IN_WAREHOUSE" | "SCRAP" | "LOST";

/** Physical condition of the cylinder. */
export type CylinderCondition = "GOOD" | "FOR_REPAIR" | "CONDEMNED";

/**
 * Full DTO for a single Customer Cylinder Aging record returned by:
 * GET /api/view-customer-cylinder-aging-master/filter
 */
export interface CustomerCylinderAgingRecord {
  // ── Asset identity ──────────────────────────────────────────────────────────
  cylinderAssetId: number;
  serialNumber: string;

  // ── Product info ────────────────────────────────────────────────────────────
  productId: number;
  productCode: string;
  productName: string;
  productWeight: number | null;

  // ── Cylinder state ──────────────────────────────────────────────────────────
  cylinderStatus: CylinderStatus;
  cylinderCondition: CylinderCondition;

  // ── Customer info ────────────────────────────────────────────────────────────
  customerCode: string;
  customerName: string;
  storeName: string;
  contactNumber: string;
  customerEmail: string;
  customerAddress: string;

  // ── Branch info ──────────────────────────────────────────────────────────────
  branchId: number;
  branchName: string;
  branchCode: string;

  // ── Asset dates ──────────────────────────────────────────────────────────────
  acquisitionDate: string | null;   // YYYY-MM-DD
  expirationDate: string | null;    // YYYY-MM-DD
  tareWeight: number | null;
  cost: number | null;

  // ── Deployment context (how/when cylinder was sent to customer) ─────────────
  deployedDate: string | null;
  deployedSourceModule: string | null;
  deployedTransactionSource: string | null;
  deployedInvoiceId: number | null;
  deployedInvoiceNo: string | null;
  deployedSalesOrderId: number | null;
  deployedOrderNo: string | null;
  deployedPosTransactionId: number | null;
  deployedConsolidatorId: number | null;
  deployedConsolidatorNo: string | null;
  deployedDispatchId: number | null;
  deployedDispatchNo: string | null;
  deployedPostDispatchDocNo: string | null;

  // ── Confidence of the customer mapping ──────────────────────────────────────
  customerMappingConfidence: number | null;

  // ── Aging core fields ────────────────────────────────────────────────────────
  agingBasisDate: string | null;    // YYYY-MM-DD — the date aging is measured from
  agingBasisSource: AgingBasisSource | null;
  daysWithCustomer: number | null;

  // ── Last transaction context ─────────────────────────────────────────────────
  lastTransactionDate: string | null;
  lastSourceModule: string | null;
  lastTransactionSource: string | null;
  lastInvoiceId: number | null;
  lastInvoiceNo: string | null;
  lastSalesOrderId: number | null;
  lastOrderNo: string | null;
  lastPosTransactionId: number | null;
  lastConsolidatorId: number | null;
  lastConsolidatorNo: string | null;
  lastDispatchId: number | null;
  lastDispatchNo: string | null;
  lastPostDispatchDocNo: string | null;
  lastNetAmount: number | null;
  daysSinceLastTransaction: number | null;

  // ── Analytics flags ──────────────────────────────────────────────────────────
  customerActivityStatus: CustomerActivityStatus;
  recommendedAction: RecommendedAction;
}

/**
 * Filter params sent to the BFF /api/ids/bia/customer-cylinder-aging route.
 * All fields optional — Spring returns all WITH_CUSTOMER records if none provided.
 */
export interface CustomerCylinderAgingFilters {
  productId?: number | "";
  customerCode?: string;
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;     // YYYY-MM-DD
}
