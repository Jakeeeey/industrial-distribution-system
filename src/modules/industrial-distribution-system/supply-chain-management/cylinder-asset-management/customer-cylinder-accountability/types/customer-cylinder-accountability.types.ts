// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/types/customer-cylinder-accountability.types.ts
// ==============================================================================
// Type Definitions for Customer Cylinder Accountability Report (VoSync BIA Subsystem)
// Complies with VoSync Design System & Enterprise Standards:
// - Physical quantity segregation from cash deposit values
// - Clear ownership delineation (Company vs Customer-owned)
// - Verified record tracking & Exception auditing
// - Full comments left behind for long-term maintainability
// ==============================================================================

/**
 * Filter parameters for querying customer cylinder accountability data.
 */
export interface CustomerAccountabilityFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (Reporting Cutoff)
  branchId?: number | string;
  customerCode?: string;
  ownership?: "ALL" | "COMPANY" | "CUSTOMER";
  searchQuery?: string;
}

/**
 * Cylinder Ownership classification.
 */
export type CylinderOwnership = "COMPANY" | "CUSTOMER" | "MIXED";

/**
 * Transaction classification according to physical base impact.
 */
export type CylinderActivityType =
  | "DEPOSIT"      // +1 to customer base (New cylinder issuance without return)
  | "SWAP"         // Net 0 to base (1-to-1 exchange of empty for full)
  | "NET_SWAP_ADD" // +Delta to base (More full cylinders taken than empties returned)
  | "NET_SWAP_SUB" // -Delta to base (More empties returned than full taken)
  | "PULL_OUT"     // -1 to customer base (Cylinder returned and deposit credited/returned)
  | "REVERSAL";    // Offset / cancellation of an earlier transaction

/**
 * Single ledger transaction row representing a verified document movement.
 */
export interface AccountabilityTransactionRecord {
  id: string;
  transactionDate: string; // YYYY-MM-DD
  customerCode: string;
  customerName: string;
  sourceModule: "POS" | "SALES_ORDER" | "SALES_RETURN" | "DISPATCH" | "WIWO";
  sourceHeaderId: string; // Document Number / Invoice / Order No
  sourceDetailId?: number | string;
  sourceStatus: "COMPLETED" | "DELIVERED" | "POSTED" | "VOIDED" | "CANCELLED";
  activityType: CylinderActivityType;
  productName: string;
  productCode?: string;
  ownership: CylinderOwnership;
  depositQty: number; // Positive quantity if deposit
  swapQty: number; // Exchange quantity
  pullOutQty: number; // Positive quantity if pulled out / returned
  netBaseImpact: number; // e.g. +1, 0, -1
  runningBase: number; // Balance after this transaction
  referenceNo: string; // Customer PO, SI No, or Transaction Reference
  isVerified: boolean; // True if accepted under posting workflow
  hasException: boolean; // True if flagged for anomaly
  exceptionReason?: string | null;
  serialNumbers?: string[];
  notes?: string | null;
}

/**
 * Customer master summary row displayed in the primary report grid.
 * Conforms to SNET Spec v1.0 §11 Wireframe columns:
 * Customer, Site, Opening, Issued, Returned, Held, Limit, Variance.
 */
export interface CustomerAccountabilityRow {
  customerCode: string;
  customerName: string;
  storeName?: string | null;
  contactNumber?: string | null;
  branchId: number | null;
  branchName: string;
  // AG-COMMENT: SNET Spec §11 column "Site" alias
  siteName?: string;
  ownership: CylinderOwnership;

  // Primary Reconciliation Ledger Metrics (§4 & §11)
  openingBase: number; // Custody count at start of period cutoff (Spec: Opening)
  opening?: number; // Alias for openingBase
  periodDeposits: number; // Total deposit cylinders received (+Base) (Spec: Issued)
  issued?: number; // Alias for periodDeposits
  periodSwaps: number; // Total swap cylinders circulated (1-to-1 exchanges, net 0)
  periodNetSwapChange: number; // Delta from unbalanced swaps (+/- Base)
  periodPullOuts: number; // Total cylinders returned / pulled out (-Base) (Spec: Returned)
  returned?: number; // Alias for periodPullOuts
  closingBase: number; // Custody balance as of reporting cutoff (Spec: Held)
  runningBase: number; // Synonymous with closing balance as of cutoff
  held?: number; // Alias for closingBase

  // AG-COMMENT: SNET Spec §7 & §11 Authorized Quota & Variance definitions
  // Variance = Current Held - Authorized Limit (positive variance = over-limit risk)
  authorizedLimit: number;
  variance: number;

  // AG-COMMENT: SNET Spec §7 Turnaround & Commercial Incentive outputs
  // Turns per year, months per turn, customer grade, incentive rate, and total incentive
  turnsPerYear?: number;
  monthsPerTurn?: number;
  customerGrade?: "A" | "B" | "C" | "STANDARD";
  incentiveRate?: number; // e.g. ₱ per cylinder or incentive percentage
  totalIncentive?: number; // Accrued incentive rebate calculation

  lastTransactionDate: string | null;
  lastReferenceNo?: string | null;
  verifiedTransactionsCount: number;
  exceptionCount: number;
  auditStatus?: "RECONCILED" | "REVIEW_REQUIRED";
}

/**
 * Overall KPI summary statistics across all qualifying customer accounts.
 * Conforms to SNET Spec §7 & §11 including limit and variance totals.
 */
export interface AccountabilityKPISummary {
  totalOpeningBase: number;
  totalPeriodDeposits: number; // Total Issued (+)
  totalPeriodSwaps: number;
  totalPeriodPullOuts: number; // Total Returned (-)
  totalClosingBase: number; // Total Current Held (=)
  // AG-COMMENT: SNET Spec additions for fleet risk oversight
  totalAuthorizedLimit: number;
  totalVariance: number;
  overLimitCount: number; // Number of customer accounts holding cylinders above authorized quota
  activeCustomerAccounts: number;
  totalVerifiedRecords: number;
  totalExceptions: number;
}

/**
 * Dynamic lookup options for filter controls.
 */
export interface AccountabilityLookupOptions {
  branches: Array<{ id: number; name: string; code: string; division_id?: number | null }>;
  customers: Array<{ code: string; name: string; storeName?: string }>;
  ownerships: Array<{ code: CylinderOwnership | "ALL"; label: string }>;
}

/**
 * Response contract returned by the primary BFF endpoint.
 */
export interface CustomerAccountabilityReportResponse {
  rows: CustomerAccountabilityRow[];
  kpis: AccountabilityKPISummary;
  reportingCutoff: string;
  generatedAt: string;
}

/**
 * Drilldown detail response for an individual customer's timeline ledger.
 */
export interface CustomerAccountabilityDetailResponse {
  customerCode: string;
  customerName: string;
  storeName: string | null;
  contactNumber: string | null;
  address: string | null;
  branchName: string;
  siteName?: string; // SNET Spec §11 alias
  ownership: CylinderOwnership;
  openingBase: number;
  closingBase: number;
  // AG-COMMENT: SNET Spec §7 & §11 drilldown fields
  authorizedLimit: number;
  variance: number;
  turnsPerYear?: number;
  monthsPerTurn?: number;
  customerGrade?: "A" | "B" | "C" | "STANDARD";
  incentiveRate?: number;
  totalIncentive?: number;
  transactions: AccountabilityTransactionRecord[];
  activeSerialsInCustody: Array<{
    serialNumber: string;
    productName: string;
    condition: string;
    daysWithCustomer: number;
    acquisitionDate?: string | null;
  }>;
}
