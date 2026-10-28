// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/types/sales-performance.types.ts
// ==============================================================================
// Sales Performance Report - TypeScript Models & Types
// Covers individual sales transactions, product line items, KPI cards, Recharts
// visual trends, customer/branch rankings, and filter lookup payloads.
// ==============================================================================

export type TaxTreatmentType = "ALL" | "VAT" | "NON_VAT";
export type DatePresetType = "today" | "this_week" | "this_month" | "custom";

/**
 * Detailed line item representing an industrial gas or related sales record
 * reconciled against voided statuses and linked sales returns / credit deductions.
 */
export interface SalesPerformanceRecord {
  id: string; // Composite unique key: `${invoiceId}-${detailId}`
  invoiceId: number;
  invoiceNo: string;
  orderId: string;
  invoiceDate: string;
  dispatchDate: string | null;
  customerCode: string;
  customerName: string;
  storeName: string;
  branchId: number;
  branchName: string;
  branchCode: string;
  salesmanId: number | null;
  salesmanName: string;
  productId: number;
  productCode: string;
  productName: string;
  isSerialized: boolean;
  productWeight: number; // kg per unit
  quantitySold: number;
  kgSold: number; // computed: quantitySold * productWeight
  unitPrice: number;
  grossAmount: number;
  discountAmount: number;
  creditAmount: number; // deducted returns for this line/invoice
  netSales: number; // grossAmount - discountAmount - creditAmount
  vatAmount: number;
  taxTreatment: "VAT 12%" | "Non-VAT / Exempt";
  recognitionBasis: "Invoice (Dispatched)" | "Official Receipt (Remitted)";
  transactionStatus: string;
  isPosted: boolean;
  hasExceptions: boolean;
  exceptionReason?: string;
}

/**
 * Executive KPI summary metrics displayed in top metric cards.
 */
export interface SalesPerformanceKPIs {
  totalNetSales: number;
  totalGrossSales: number;
  totalCredits: number;
  totalKgSold: number;
  totalInvoices: number;
  totalReturns: number;
  averageOrderValue: number;
  vatSalesTotal: number;
  nonVatSalesTotal: number;
  overallKgRate: number; // Net sales per kg sold
}

/**
 * Data structures for Recharts colorful data visualizations.
 */
export interface SalesTrendPoint {
  date: string;
  netSales: number;
  grossSales: number;
  kgSold: number;
  invoicesCount: number;
}

export interface GasDistributionPoint {
  gasType: string;
  kgSold: number;
  netSales: number;
  percentage: number;
  color: string;
}

export interface BranchComparisonPoint {
  branchId: number;
  branchName: string;
  branchCode: string;
  netSales: number;
  kgSold: number;
  invoiceCount: number;
  averageTicket: number;
}

export interface SalesPerformanceChartsData {
  salesTrend: SalesTrendPoint[];
  gasDistribution: GasDistributionPoint[];
  branchComparison: BranchComparisonPoint[];
}

/**
 * Customer & Product Rankings.
 */
export interface CustomerRanking {
  customerCode: string;
  customerName: string;
  storeName: string;
  branchName: string;
  totalInvoices: number;
  totalKgSold: number;
  totalNetSales: number;
}

export interface ProductRanking {
  productId: number;
  productCode: string;
  productName: string;
  isSerialized: boolean;
  totalUnitsSold: number;
  totalKgSold: number;
  totalNetSales: number;
}

export interface SalesPerformanceRankings {
  topCustomers: CustomerRanking[];
  topProducts: ProductRanking[];
}

/**
 * Lookup options for SearchableSelect components.
 */
export interface LookupOption {
  value: string;
  label: string;
  code?: string;
  weight?: number;
}

export interface SalesPerformanceLookupsResponse {
  branches: LookupOption[];
  customers: LookupOption[];
  products: LookupOption[];
  salesmen: LookupOption[];
}

/**
 * BFF Response payload containing paginated rows, KPIs, charts, and rankings.
 */
export interface SalesPerformanceReportResponse {
  records: SalesPerformanceRecord[];
  totalRecords: number;
  kpis: SalesPerformanceKPIs;
  charts: SalesPerformanceChartsData;
  rankings: SalesPerformanceRankings;
  metadata: {
    generatedAt: string;
    cutoffTimestamp: string;
    appliedFiltersSummary: string;
  };
}
