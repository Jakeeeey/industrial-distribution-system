// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/types/cylinder-deposit-swap.types.ts
// ==============================================================================
// Types & Schema Definitions for Cylinder Deposit and Swap Report (BIA)
// Follows IDS standards: pure TypeScript interfaces, full comment annotations.
// ==============================================================================

/**
 * Filter parameters supplied by the UI to the BFF API route.
 */
export interface CylinderDepositSwapFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  branchId?: number | ""; // Optional branch filter (active branches only)
  customerCode?: string; // Optional single customer lookup
  productId?: number | ""; // Optional product/capacity filter (serialized products only)
  // AG-COMMENT: Ownership filter removed per user requirement
}

/**
 * Lookup options available for populating the filter bar.
 */
export interface CylinderDepositSwapLookupOptions {
  branches: Array<{ id: number; branch_code: string; branch_name: string }>;
  products: Array<{
    product_id: number;
    product_code: string;
    product_name: string;
    description?: string | null;
    product_weight: number | null;
  }>;
  customers: Array<{ customer_code: string; customer_name: string; store_name: string | null }>;
}

/**
 * Lifecycle status buckets for physical cylinders held in customer custody.
 */
export interface CylinderLifecycleSummary {
  circulating: number; // Active movement <= 30 days
  idleWarning: number; // Inactive 31-60 days
  idleCritical: number; // Stagnant > 60 days
  underMaintenance: number; // Flagged DAMAGED or FOR_REPAIR
  totalCylinders: number; // Total active custody
}

/**
 * Product-level detail row shown when expanding a customer's record.
 */
export interface CustomerProductCylinderRow {
  productId: number;
  productCode: string;
  productName: string;
  productWeight: number | null;
  openingBase: number;
  depositsDelivered: number; // New deposits issued (+)
  swapsInbound: number; // Empty cylinders returned by customer
  swapsOutbound: number; // Full cylinders delivered (refill)
  depositsPulledOut: number; // Cylinders returned / pulled out (-)
  netSwapVariance: number; // Outbound - Inbound
  closingBase: number; // Opening + Deposits - Pullouts + NetVariance
  circulatingQty: number; // Active <= 30 days
  idleQty: number; // Inactive > 30 days
}

/**
 * Parent customer-level aggregation row displayed in the primary table.
 */
export interface CustomerCylinderReportRow {
  customerCode: string;
  customerName: string;
  storeName: string | null;
  branchId: number | null;
  branchName: string | null;
  contactNumber: string | null;
  customerAddress: string | null;
  totalOpeningBase: number;
  totalDepositsDelivered: number;
  totalSwapsInbound: number;
  totalSwapsOutbound: number;
  totalDepositsPulledOut: number;
  totalNetVariance: number;
  totalClosingBase: number;
  products: CustomerProductCylinderRow[];
  lastTransactionDate: string | null;
}

/**
 * Daily/weekly trend data point for Recharts visualization.
 */
export interface CylinderMovementTrendPoint {
  date: string; // YYYY-MM-DD
  formattedDate: string; // MMM DD
  deposits: number;
  swapsIn: number;
  swapsOut: number;
  netDelta: number;
}

/**
 * Distribution summary for pie/donut charts.
 */
export interface CylinderProductDistributionPoint {
  productName: string;
  quantity: number;
  percentage: number;
}

/**
 * Top-level KPI metrics summary displayed in the header cards.
 */
export interface CylinderDepositSwapKPISummary {
  totalActiveCustomerBase: number;
  totalPeriodDeposits: number;
  totalPeriodSwapsReturned: number;
  totalPeriodSwapsDelivered: number;
  totalPeriodPullOuts: number;
  totalStagnantCylinders: number;
  totalCustomersAudited: number;
  lifecycle: CylinderLifecycleSummary;
}

/**
 * Complete payload returned by the BFF route.
 */
export interface CylinderDepositSwapReportResponse {
  filters: CylinderDepositSwapFilters;
  kpis: CylinderDepositSwapKPISummary;
  rows: CustomerCylinderReportRow[];
  trends: CylinderMovementTrendPoint[];
  productDistribution: CylinderProductDistributionPoint[];
  generatedAt: string;
}

/**
 * Individual physical serial asset record for the customer audit drawer.
 */
export interface CustomerSerialAssetDetail {
  serialNumber: string;
  productName: string;
  cylinderStatus: string;
  cylinderCondition: string;
  ownership: string;
  daysWithCustomer: number;
  deployedDate: string | null;
  lastMovementDate: string | null;
}

/**
 * Matched financial cash deposit record from treasury/memos.
 */
export interface MatchedFinancialDeposit {
  id: number | string;
  recordType: "BANK_DEPOSIT" | "CUSTOMER_MEMO" | "PAYMENT_RECEIPT";
  referenceNumber: string;
  transactionDate: string;
  amount: number;
  status: string;
  remarks: string | null;
}

/**
 * Chronological movement history record for the customer audit drawer.
 */
export interface CustomerAuditTransactionItem {
  id: string | number;
  transactionDate: string;
  sourceModule: "POS" | "BULK_DISPATCH" | "CLEARANCE" | "SALES_RETURN" | "MANUAL_STOCK";
  transactionType: "DEPOSIT_OUT" | "SWAP_IN" | "SWAP_OUT" | "PULL_OUT" | "MAINTENANCE_RETURN";
  referenceNo: string;
  productName: string;
  quantity: number;
  serialNumbers: string[];
  notes: string | null;
}

/**
 * Full detail response for a specific customer audit drill-down.
 */
export interface CustomerDepositSwapDetailResponse {
  customerCode: string;
  customerName: string;
  storeName: string | null;
  branchName: string | null;
  contactNumber: string | null;
  customerAddress: string | null;
  activeSerials: CustomerSerialAssetDetail[];
  financialDeposits: MatchedFinancialDeposit[];
  movementHistory: CustomerAuditTransactionItem[];
}
