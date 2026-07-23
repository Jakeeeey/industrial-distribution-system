export interface QuantityMetrics {
  grossPurchasedQty: number;
  returnedQty: number;
  netPurchasedQty: number;
}

export interface CylinderPurchaseRow extends QuantityMetrics {
  customerCode: string | null;
  customerName: string | null;
  invoiceDate: string;
  productId: number;
  productCode: string;
  productName: string;
  branchId: number;
  branchCode: string;
  branchName: string;
  salesmanId: number;
  salesmanCode: string;
  salesmanName: string;
}

export interface CylinderPurchaseReportFilters {
  customerCode?: string;
  productId?: number;
  branchId?: number;
  salesmanId?: number;
  startDate: string;
  endDate: string;
}

export interface AppliedFilterContext extends CylinderPurchaseReportFilters {
  customerLabel?: string;
  productLabel?: string;
  branchLabel?: string;
  salespersonLabel?: string;
}

export interface CustomerPurchaseSummary extends QuantityMetrics {
  customerKey: string;
  customerCode: string | null;
  customerName: string;
  returnRate: number;
  productBreakdown: ProductPurchaseSummary[];
  branchBreakdown: BranchPurchaseSummary[];
  salespersonBreakdown: SalespersonPurchaseSummary[];
}

export interface ProductPurchaseSummary extends QuantityMetrics {
  productId: number;
  productCode: string;
  productName: string;
  returnRate: number;
  uniqueCustomers: number;
}

export interface BranchPurchaseSummary extends QuantityMetrics {
  branchId: number;
  branchCode: string;
  branchName: string;
  returnRate: number;
  uniqueCustomers: number;
  uniqueProducts: number;
}

export interface SalespersonPurchaseSummary extends QuantityMetrics {
  salesmanId: number;
  salesmanCode: string;
  salesmanName: string;
  returnRate: number;
  uniqueCustomers: number;
  uniqueProducts: number;
  customerBreakdown: SalespersonCustomerPurchaseSummary[];
  productBreakdown: ProductPurchaseSummary[];
  customerProductBreakdown: SalespersonCustomerProductPurchaseSummary[];
}

export interface SalespersonCustomerPurchaseSummary extends QuantityMetrics {
  customerKey: string;
  customerCode: string | null;
  customerName: string;
  returnRate: number;
  uniqueProducts: number;
}

export interface SalespersonCustomerProductPurchaseSummary
  extends QuantityMetrics {
  key: string;
  customerKey: string;
  customerCode: string | null;
  customerName: string;
  productId: number;
  productCode: string;
  productName: string;
  returnRate: number;
}

export interface ReturnAnalysisItem extends QuantityMetrics {
  key: string;
  code: string;
  label: string;
  returnRate: number;
}

export interface ReturnAnalysisDataset {
  overall: QuantityMetrics & { returnRate: number };
  byCustomer: ReturnAnalysisItem[];
  byProduct: ReturnAnalysisItem[];
  byBranch: ReturnAnalysisItem[];
  bySalesperson: ReturnAnalysisItem[];
}

export type ReportLookupType = "customers" | "products" | "branches" | "salespeople";

export interface ReportLookupOption {
  value: string;
  label: string;
  code?: string;
}

export interface ReportLookupResponse {
  data: ReportLookupOption[];
}

export type CylinderPurchaseDashboardView =
  | "customers"
  | "products"
  | "returns"
  | "branches"
  | "salespeople";

export interface CylinderPurchaseDashboardResponse {
  filters: AppliedFilterContext;
  generatedAt: string;
  sourceRowCount: number;
  overview: QuantityMetrics & {
    uniqueCustomers: number;
    serializedProducts: number;
  };
  customerRanking: CustomerPurchaseSummary[];
  productPerformance: ProductPurchaseSummary[];
  returnAnalysis: ReturnAnalysisDataset;
  branchPerformance: BranchPurchaseSummary[];
  salespersonPerformance: SalespersonPurchaseSummary[];
}
