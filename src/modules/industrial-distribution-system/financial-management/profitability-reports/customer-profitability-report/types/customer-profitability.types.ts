// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/types/customer-profitability.types.ts
// ==============================================================================
// Customer Profitability Report - TypeScript Types
// Strictly mirrors DDL schema definitions for customer, sales_invoice,
// sales_invoice_details, products, branches, post_dispatch_plan,
// post_dispatch_invoices, post_dispatch_budgeting, cylinder_assets, sales_return.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

export type ProfitabilityTier =
  | "HIGH" // Margin >= 25%
  | "MODERATE" // 10% <= Margin < 25%
  | "MARGINAL" // 0% <= Margin < 10%
  | "LOSS" // Margin < 0%
  | "INCOMPLETE"; // Data warnings or missing cost fields

export type DatePreset = "this_month" | "last_month" | "qtd" | "ytd" | "custom";

/**
 * Filter parameters applied to report generation
 */
export interface CustomerProfitabilityFilters {
  startDate?: string;
  endDate?: string;
  datePreset?: DatePreset;
  branchId?: number | "all";
  tier?: ProfitabilityTier | "all";
  searchQuery?: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

/**
 * Raw Directus representations matching provided DDLs
 */
export interface RawCustomer {
  id: number;
  customer_code: string;
  customer_name: string;
  store_name?: string | null;
  store_signage?: string | null;
  city?: string | null;
  province?: string | null;
  credit_limit?: number | null;
  isActive: number;
  isVAT: number;
  isEWT: number;
  price_type_id?: number | null;
  discount_type?: number | null;
}

export interface RawSalesInvoice {
  invoice_id: number;
  invoice_no?: string | null;
  order_id?: string | null;
  customer_code: string;
  salesman_id?: number | null;
  branch_id?: number | null;
  invoice_date: string | null;
  dispatch_date?: string | null;
  gross_amount?: number | null;
  discount_amount?: number | null;
  vat_amount?: number | null;
  net_amount?: number | null;
  total_amount?: number | null;
  transaction_status?: string | null;
  isPosted?: boolean | number | null;
  isDispatched?: boolean | number | null;
  isReplaced?: boolean | number | null;
  is_visit?: number | null;
}

export interface RawSalesInvoiceDetail {
  detail_id: number;
  invoice_no: number; // Foreign key referencing sales_invoice.invoice_id
  order_id: string;
  product_id: number;
  unit: number;
  unit_price: number;
  quantity: number;
  discount_amount?: number | null;
  gross_amount?: number | null;
  total_amount: number;
  serial_no?: string | null;
}

export interface RawProduct {
  product_id: number;
  product_code?: string | null;
  product_name?: string | null;
  description?: string | null;
  cost_per_unit?: number | null;
  price_per_unit?: number | null;
  estimated_unit_cost?: number | null;
  product_weight?: number | null;
  weight?: number | null;
  unit_of_measurement_count?: number | null;
  is_serialized: number;
  isActive: number;
}

export interface RawBranch {
  id: number;
  branch_code: string;
  branch_name: string;
  state_province?: string | null;
  city?: string | null;
  isActive?: number;
}

export interface RawPostDispatchPlan {
  id: number;
  doc_no?: string | null;
  driver_id?: number | null;
  vehicle_id?: number | null;
  starting_point?: number | null; // references branches.id
  total_distance?: number | null;
  status: string;
  amount?: number | null;
  time_of_dispatch?: string | null;
  time_of_arrival?: string | null;
  is_liquidated?: number | null;
}

export interface RawPostDispatchInvoice {
  id: number;
  post_dispatch_plan_id: number;
  invoice_id: number; // references sales_invoice.invoice_id
  distance?: number | null;
  status?: string;
  sequence?: number | null;
  isCleared?: number | null;
}

export interface RawPostDispatchBudgeting {
  id: number;
  post_dispatch_plan_id: number;
  coa_id?: number | null;
  remarks?: string | null;
  amount?: number | null;
}

export interface RawCylinderAsset {
  id: number;
  product_id: number;
  serial_number: string;
  cylinder_status: string;
  cylinder_condition: string;
  current_branch_id?: number | null;
  current_customer_code?: string | null;
  tare_weight?: number | null;
  cost?: number | null;
  remarks?: string | null;
  modified_date?: string | null;
  is_deleted?: number;
}

export interface RawSalesReturn {
  return_id: number;
  return_number: string;
  customer_code: string;
  branch_id?: number | null;
  return_date: string;
  total_amount: number;
  discount_amount?: number | null;
  gross_amount?: number | null;
  isPosted?: boolean | number | null;
  isReceived?: boolean | number | null;
}

export interface RawSalesReturnDetail {
  detail_id: number;
  return_no: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

/**
 * Calculated Customer Profitability Summary Row
 */
export interface CustomerProfitabilityRow {
  customerId: number;
  customerCode: string;
  customerName: string;
  storeName: string;
  branchId: number | null;
  branchName: string;
  city: string;
  province: string;

  // Operational metrics
  totalInvoicesCount: number;
  totalWeightKg: number;

  // Financial components
  grossInvoicedSales: number;
  salesReturns: number;
  netSales: number;

  gasCogs: number; // Cost of goods sold
  grossMargin: number; // netSales - gasCogs
  grossMarginPercent: number;

  allocatedDeliveryCost: number; // Prorated trip budgeting
  incentivesAmount: number; // Rebates / CTR Turnaround incentives
  cylinderIncidentCost: number; // Damaged / Lost cylinder costs

  contributionMargin: number; // grossMargin - (allocatedDeliveryCost + incentivesAmount + cylinderIncidentCost)
  contributionMarginPercent: number;

  tier: ProfitabilityTier;
  hasDataWarning: boolean;
  warningReasons: string[];
}

/**
 * KPI Summary for Metric Ribbon
 */
export interface ProfitabilityKPISummary {
  totalNetSales: number;
  totalGasCogs: number;
  totalGrossMargin: number;
  averageGrossMarginPercent: number;
  totalOperatingCosts: number; // Delivery + Incentives + Incidents
  totalContributionMargin: number;
  averageContributionMarginPercent: number;

  totalCustomersCount: number;
  profitableCustomersCount: number;
  lossMakingCustomersCount: number;
  incompleteDataCount: number;
}

/**
 * Visualization Data Structures (Recharts compatible)
 */
export interface TierDistributionPoint {
  tier: string;
  tierKey: ProfitabilityTier;
  customerCount: number;
  totalNetSales: number;
  totalContribution: number;
}

export interface CostComponentBreakdownPoint {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyTrendPoint {
  month: string;
  netSales: number;
  gasCost: number;
  deliveryCost: number;
  contributionMargin: number;
}

export interface ProfitabilityChartsData {
  tierDistribution: TierDistributionPoint[];
  costBreakdown: CostComponentBreakdownPoint[];
  monthlyTrend: MonthlyTrendPoint[];
}

/**
 * Drilldown Details for Selected Customer
 */
export interface CustomerDrilldownDetails {
  customer: CustomerProfitabilityRow;
  invoices: {
    invoiceId: number;
    invoiceNo: string;
    invoiceDate: string;
    orderId?: string;
    grossAmount: number;
    discountAmount: number;
    netAmount: number;
    cogs: number;
    margin: number;
    marginPercent: number;
    status: string;
  }[];
  dispatches: {
    planId: number;
    docNo: string;
    dispatchDate: string;
    invoiceId: number;
    allocatedCost: number;
    tripStatus: string;
  }[];
  incidents: {
    assetId: number;
    serialNumber: string;
    productName: string;
    status: string;
    condition: string;
    cost: number;
    incidentDate: string;
  }[];
}

/**
 * Top-Level Response Wrapper from Aggregator / API
 */
export interface CustomerProfitabilityReportResponse {
  rows: CustomerProfitabilityRow[];
  allRows?: CustomerProfitabilityRow[];
  kpis: ProfitabilityKPISummary;
  charts: ProfitabilityChartsData;
  totalRows: number;
  totalPages: number;
  page: number;
  pageSize: number;
  reportingPeriod: {
    startDate: string;
    endDate: string;
  };
}
