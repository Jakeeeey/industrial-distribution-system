// ============================================================
// customer-incentive.types.ts
// Pure TypeScript interfaces for the Customer Incentive & Rebate Report.
// Validation lives in customer-incentive.schema.ts — no Zod here.
// Placement: CRM -> Customer Reports -> Customer Incentive & Rebate Report
//
// The claim lifecycle is carried by customers_memo, the only approved +
// settled money record the schema actually offers. There is no dedicated
// incentive table, so statuses are mapped, not invented (see CLAIM_STATUS).
// ============================================================

/** Default cylinder size the incentive is measured on, in kilograms. */
export const DEFAULT_ELIGIBLE_SIZE_KG = 11;

// ------------------------------------------------------------
// Claim status
// customers_memo.status is the source of truth. §6 of the spec names the
// business states; these are the labels readers expect, mapped one-to-one
// onto the enum so the report can never claim a state the data does not hold.
//   FOR APPROVAL        -> For Review
//   APPROVED            -> Approved
//   PARTIALLY APPLIED   -> Partially Released
//   APPLIED             -> Released
//   REJECTED            -> Rejected  (reason retained)
//   DELETED             -> excluded as voided
// ------------------------------------------------------------
export type ClaimStatus =
  | "FOR_REVIEW"
  | "APPROVED"
  | "PARTIALLY_RELEASED"
  | "RELEASED"
  | "REJECTED";

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  FOR_REVIEW: "For Review",
  APPROVED: "Approved",
  PARTIALLY_RELEASED: "Partially Released",
  RELEASED: "Released",
  REJECTED: "Rejected",
};

/** customers_memo.status values that are treated as voided and dropped. */
export const VOID_MEMO_STATUSES = new Set(["DELETED"]);

// ------------------------------------------------------------
// Filter inputs sent to the BFF.
//
// Every picker below holds a list, so an empty or absent list means "no cut
// here" rather than "nothing matches". A one-element list and a hundred-element
// list are the same query shape to the repo, which is why nothing here is
// singular.
// ------------------------------------------------------------
export interface CustomerIncentiveFilters {
  startDate: string; // YYYY-MM-DD, Asia/Manila
  endDate: string; // YYYY-MM-DD, doubles as the reporting cutoff
  customerCodes?: string[]; // customer.customer_code
  branchIds?: number[]; // branches.id, matched on sales_invoice.branch_id
  salesmanIds?: number[]; // salesman.id
  classificationIds?: number[]; // customer.classification -> customer_classification.id
  claimStatus?: ClaimStatus;
  /**
   * categories.category_id, restricted to industrial categories. When set it
   * decides which products count as eligible refills, by membership, so two
   * categories of different sizes can be measured in one pass.
   */
  categoryIds?: number[];
  /**
   * Cylinder size in kg that a product must resolve to for eligibility. Only
   * consulted while no category is selected: a category states its own size.
   */
  sizeKg?: number;
}

/**
 * Filters as the service sees them. The display label arrays come from the
 * filter bar and are echoed back into the exports and the PDF footer; they are
 * never used in a query. They are arrays because the option lists behind them
 * are not fetched until a picker opens, so an id alone would render as a bare
 * number on a reloaded page.
 */
export interface AppliedFilterContext extends CustomerIncentiveFilters {
  customerLabels?: string[];
  branchLabels?: string[];
  salesmanLabels?: string[];
  classificationLabels?: string[];
  categoryLabels?: string[];
  sizeKg?: number;
}

// ------------------------------------------------------------
// Raw Directus rows. Field lists mirror the `fields=` projections
// in customer-incentive.repo.ts.
// ------------------------------------------------------------
export interface RawBranchRow {
  id: number;
  branch_name: string | null;
  branch_code: string | null;
}

export interface RawClassificationRow {
  id: number;
  classification_name: string | null;
}

export interface RawSalesmanRow {
  id: number;
  salesman_code: string | null;
  salesman_name: string | null;
}

/**
 * `id` is what customers_memo.customer_id points at; the sales documents key
 * on customer_code instead. Both are read so the two sides can be joined.
 */
export interface RawCustomerRow {
  id: number;
  customer_code: string;
  customer_name: string | null;
  store_name: string | null;
  classification: number | null;
}

export interface RawProductRow {
  product_id: number;
  product_code: string | null;
  product_name: string | null;
  /** IDS Rule: product description displayed as product name when available. */
  description?: string | null;
  product_weight: number | null;
  /** categories.category_id. Nullable in the schema, so it can be absent. */
  product_category: number | null;
  /** IDS Rule: products filtered by is_serialized = 1. */
  is_serialized?: number | boolean | string | null;
}

/**
 * categories — the cylinder catalogue. `category_name` is the only place a
 * size is written down ("LPG 11KG"); the table has no numeric size column.
 */
export interface RawCategoryRow {
  category_id: number;
  category_name: string | null;
}

export interface RawInvoiceRow {
  invoice_id: number;
  invoice_no: string | null;
  customer_code: string | null;
  branch_id: number | null;
  salesman_id: number | null;
  invoice_date: string | null;
  transaction_status: string | null;
  /** Gross or total invoice amount used for supporting document trail in drill-down drawer. */
  total_amount?: number | null;
  /** A reprint of an already-issued invoice. Only the original may earn. */
  isReplaced?: unknown;
}

/**
 * `invoice_no` holds sales_invoice.invoice_id despite the name — the same
 * mismatch the sibling report documents, so it is written down here too.
 */
export interface RawInvoiceDetailRow {
  detail_id: number;
  invoice_no: number;
  product_id: number;
  quantity: number;
  unit_price: number | null;
}

export interface RawReturnRow {
  return_id: number;
  return_number: string;
  customer_code: string | null;
  branch_id: number | null;
  salesman_id: number | null;
  return_date: string | null;
  status: string | null;
  deleted_at: string | null;
  /** Total returned amount used for supporting document trail in drill-down drawer. */
  total_amount?: number | null;
  /**
   * Nullable on the schema. Absent or null is read as posted, because holding
   * a return back would raise the earned amount; only an explicit false is
   * taken to mean the goods have not been received against a posting yet.
   */
  isPosted?: unknown;
}

export interface RawReturnDetailRow {
  detail_id: number;
  return_no: string;
  product_id: number;
  quantity: number;
  status: string | null;
}

export interface RawReturnLinkRow {
  id: number;
  return_no: number; // sales_return.return_id
  invoice_no: number; // sales_invoice.invoice_id
  amount: number | null;
}

/**
 * customers_memo — the claim vehicle. `type` FKs to balance_type, which only
 * distinguishes debit from credit, so it cannot classify an incentive and is
 * read for context only. There is no memo_type table despite chart_of_accounts
 * carrying a memo_type column.
 */
export interface RawMemoRow {
  id: number;
  memo_number: string;
  customer_id: number;
  salesman_id: number | null;
  supplier_reference: string | null;
  customer_reference: string | null;
  amount: number | null;
  applied_amount: number | null;
  reason: string | null;
  status: string | null;
  chart_of_account: number | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  isPending: unknown;
  isClaimed: unknown;
}

/** Which invoices a memo was applied against. */
export interface RawMemoInvoiceRow {
  id: number;
  invoice_id: number | null;
  memo_id: number | null;
  amount: number | null;
  date_applied: string | null;
}

/** Settled payments, one row per transmittal that carried the memo. */
export interface RawMemoTransmittalRow {
  id: number;
  memo_id: number | null;
  transmitted_to: string | null;
  paid_amount: number | null;
  received_at: string | null;
  transmittal_no: string | null;
  created_at: string | null;
}

export interface RawAccountRow {
  coa_id: number;
  gl_code: string | null;
  account_title: string | null;
}

/** Everything the pure aggregation layer needs; one read per collection. */
export interface IncentiveSourceData {
  branches: RawBranchRow[];
  classifications: RawClassificationRow[];
  salesmen: RawSalesmanRow[];
  customers: RawCustomerRow[];
  products: RawProductRow[];
  /** Industrial categories only — the cylinder catalogue the size is read from. */
  categories: RawCategoryRow[];
  invoices: RawInvoiceRow[];
  invoiceDetails: RawInvoiceDetailRow[];
  returns: RawReturnRow[];
  returnDetails: RawReturnDetailRow[];
  returnLinks: RawReturnLinkRow[];
  memos: RawMemoRow[];
  memoInvoices: RawMemoInvoiceRow[];
  memoTransmittals: RawMemoTransmittalRow[];
  accounts: RawAccountRow[];
}

// ------------------------------------------------------------
// Output rows
// ------------------------------------------------------------
export interface IncentiveClaimSummary {
  memoNumber: string;
  claimStatus: ClaimStatus;
  statusLabel: string;
  /** customers_memo.amount — the figure finance approved. */
  approvedAmount: number;
  /** customers_memo.applied_amount — the figure already settled. */
  releasedAmount: number;
  reason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  accountTitle: string | null;
  /** customer_memo_transmittals references that paid this memo. */
  paymentReferences: string[];
}

/**
 * Product/branch breakdown behind one customer. Claims are never allocated
 * down to this level — the schema has no per-product memo link — so the
 * figures here are evidence only and carry no money.
 */
export interface CustomerIncentiveEvidence {
  branchId: number | null;
  branchName: string;
  productId: number;
  productCode: string;
  productName: string;
  sizeKg: number | null;
  grossUnits: number;
  returnedUnits: number;
  eligibleUnits: number;
  eligibleKg: number;
  /** Billed ₱/kg read off the invoice lines, weighted by quantity. */
  ratePerKg: number | null;
  /** Σ qty x unit_price on the accepted lines — the recorded line value. */
  earnedAmount: number;
  /** Value of the approved return adjustments deducted from the above. */
  adjustmentAmount: number;
  invoiceCount: number;
  returnCount: number;
  salesmanNames: string[];
  exceptionCodes: string[];
}

/**
 * One row per customer — the unit a claim is actually approved and settled
 * at. Aggregating here is what keeps memo money from being split across
 * product rows and counted twice.
 */
export interface CustomerIncentiveRow {
  customerCode: string;
  customerName: string;
  storeName: string;
  classificationName: string;
  branchNames: string[];
  salesmanNames: string[];

  grossUnits: number;
  returnedUnits: number;
  eligibleUnits: number;
  /** eligibleUnits x product weight — the kg actually delivered. */
  eligibleKg: number;

  /**
   * Blended ₱/kg across all eligible lines. This is the billed rate, not an
   * independent rebate rate; the schema holds no incentive-rate table, so no
   * rebate percentage is invented anywhere in this report.
   */
  ratePerKg: number | null;
  /** False when no eligible line carried a unit price, so rate is unknown. */
  rateIsKnown: boolean;

  earnedAmount: number;
  adjustmentAmount: number;

  claimCount: number;
  approvedAmount: number;
  releasedAmount: number;
  outstandingAmount: number;
  /** approvedAmount - earnedAmount; §10 "Variance". */
  varianceAmount: number;
  /** approvedAmount / eligibleKg — what the customer was really paid per kg. */
  impliedRatePerKg: number | null;

  /** Roll-up: the most advanced status among the customer's claims. */
  claimStatus: ClaimStatus | "NO_CLAIM";
  statusLabel: string;
  /** Every distinct status present, so a mixed customer is not hidden. */
  claimStatuses: ClaimStatus[];
  memoNumbers: string[];
  paymentReferences: string[];
  exceptionCodes: string[];

  evidence: CustomerIncentiveEvidence[];
}

export interface IncentiveOverview {
  customerCount: number;
  rowRowCount: number;
  eligibleUnits: number;
  eligibleKg: number;
  earnedAmount: number;
  adjustmentAmount: number;
  approvedAmount: number;
  releasedAmount: number;
  outstandingAmount: number;
  varianceAmount: number;
  claimCounts: Record<ClaimStatus, number>;
  exceptionCount: number;
}

export type ExceptionCode =
  | "MISSING_PRODUCT_WEIGHT"
  | "PRODUCT_NOT_CATEGORISED"
  | "NO_RATE_SNAPSHOT"
  | "VOIDED_INVOICE_EXCLUDED"
  | "UNPOSTED_RETURN_EXCLUDED"
  | "RETURNED_UNITS_EXCEEDED"
  | "MEMO_WITHOUT_EVIDENCE"
  | "MEMO_WITHOUT_CUSTOMER"
  | "MEMO_STATUS_UNRECOGNISED"
  | "DUPLICATE_MEMO_SUSPECTED"
  | "OVER_RELEASED"
  | "BRANCH_UNRESOLVED"
  | "MEMO_OUTSIDE_WINDOW";

export interface ReportException {
  code: ExceptionCode;
  severity: "info" | "warning" | "critical";
  customerCode: string | null;
  customerName: string;
  referenceType: "INVOICE" | "RETURN" | "MEMO" | "PRODUCT";
  referenceNo: string;
  detail: string;
  amount: number | null;
}

/** Supporting evidence listed in the drill-down for one customer. */
export interface SupportingDocument {
  documentType: "SALES_INVOICE" | "SALES_RETURN" | "CUSTOMER_MEMO" | "TRANSMITTAL";
  documentNo: string;
  date: string | null;
  amount: number | null;
  status: string | null;
  detail: string;
}

export interface CustomerIncentiveDetail {
  customerCode: string;
  customerName: string;
  storeName: string;
  classificationName: string;
  branchName: string;
  window: { startDate: string; endDate: string };
  rows: CustomerIncentiveRow[];
  claims: IncentiveClaimSummary[];
  documents: SupportingDocument[];
  exceptions: ReportException[];
}

export interface CustomerIncentiveReportResponse {
  filters: AppliedFilterContext;
  generatedAt: string;
  /** The date balances were measured at — always the applied endDate. */
  reportingCutoff: string;
  sourceRowCount: number;
  overview: IncentiveOverview;
  rows: CustomerIncentiveRow[];
  exceptions: ReportException[];
  claims: IncentiveClaimSummary[];
}

export interface ReportLookupOption {
  value: string;
  label: string;
  code?: string;
  /** Cylinder size read out of a category name, for the size picker only. */
  sizeKg?: number;
}

/**
 * Collections the filter bar may search. This list is the whitelist the BFF
 * validates against, so a new picker is added here and nowhere else.
 */
export const REPORT_LOOKUP_KINDS = [
  "customers",
  "branches",
  "salesmen",
  "classifications",
  "categories",
] as const;

export type ReportLookupKind = (typeof REPORT_LOOKUP_KINDS)[number];
