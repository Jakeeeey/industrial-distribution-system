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
  sourceModule: "POS" | "SALES_ORDER" | "SALES_RETURN" | "DISPATCH";
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
 */
export interface CustomerAccountabilityRow {
  customerCode: string;
  customerName: string;
  storeName?: string | null;
  contactNumber?: string | null;
  branchId: number | null;
  branchName: string;
  ownership: CylinderOwnership;
  openingBase: number; // Custody count at start of period cutoff
  periodDeposits: number; // Total deposit cylinders received (+Base)
  periodSwaps: number; // Total swap cylinders circulated
  periodNetSwapChange: number; // Delta from unbalanced swaps (+/- Base)
  periodPullOuts: number; // Total cylinders returned / pulled out (-Base)
  closingBase: number; // Custody balance as of reporting cutoff
  runningBase: number; // Synonymous with closing balance as of cutoff
  lastTransactionDate: string | null;
  lastReferenceNo?: string | null;
  verifiedTransactionsCount: number;
  exceptionCount: number;
}

/**
 * Overall KPI summary statistics across all qualifying customer accounts.
 */
export interface AccountabilityKPISummary {
  totalOpeningBase: number;
  totalPeriodDeposits: number;
  totalPeriodSwaps: number;
  totalPeriodPullOuts: number;
  totalClosingBase: number;
  activeCustomerAccounts: number;
  totalVerifiedRecords: number;
  totalExceptions: number;
}

/**
 * Dynamic lookup options for filter controls.
 */
export interface AccountabilityLookupOptions {
  branches: Array<{ id: number; name: string; code: string }>;
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
  ownership: CylinderOwnership;
  openingBase: number;
  closingBase: number;
  transactions: AccountabilityTransactionRecord[];
  activeSerialsInCustody: Array<{
    serialNumber: string;
    productName: string;
    condition: string;
    daysWithCustomer: number;
    acquisitionDate?: string | null;
  }>;
}
