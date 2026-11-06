// types/customer-cylinder-aging.types.ts
// ──────────────────────────────────────────────────────────────────────────────
// Domain contracts and TypeScript types for Customer Cylinder Aging Report (BIA).
// Mapped to vos_database.cylinder_assets, customer, branches, products,
// v_serial_movements, dispatch_plan, post_dispatch_plan, and sales_return.
// ──────────────────────────────────────────────────────────────────────────────

export type AgingBucketType =
  | "0_15_DAYS"
  | "16_30_DAYS"
  | "31_60_DAYS"
  | "61_90_DAYS"
  | "90_PLUS_DAYS";

export type CustomerAgingAction =
  | "NO_ACTION_REQUIRED"
  | "MONITOR_CUSTOMER"
  | "FOLLOW_UP_CUSTOMER"
  | "PRIORITIZE_COLLECTION"
  | "FOR_PULL_OUT_REVIEW";

export type AgingBasisSource =
  | "VERIFIED_DISPATCH"
  | "POS_TRANSACTION"
  | "CUSTOMER_ASSIGNMENT"
  | "SALES_ORDER"
  | "CYLINDER_CREATED_FALLBACK";

export type CylinderStatusType =
  | "AVAILABLE"
  | "FULL"
  | "EMPTY"
  | "RESERVED"
  | "LOADED"
  | "WITH_CUSTOMER"
  | "DAMAGED"
  | "LOST"
  | "RETIRED"
  | "WITH_SUPPLIER"
  | "UNRECEIVED/REPLACED";

export type CylinderConditionType = "GOOD" | "FOR_REPAIR" | "DAMAGED" | "SCRAP";

export interface SupportingDocumentRecord {
  ts: string;
  docNo: string;
  docType: string;
  inQty: number;
  outQty: number;
  customerCode?: string | null;
  customerName?: string | null;
  branchName?: string | null;
  notes?: string | null;
}

export interface CustomerCylinderAgingItem {
  id: string | number;
  serialNumber: string;
  productId: number;
  productName: string;
  productCode?: string;
  isSerialized: boolean;
  tareWeight?: number | null;
  cylinderStatus: CylinderStatusType;
  cylinderCondition: CylinderConditionType;
  
  // Customer details
  customerCode: string;
  customerName: string;
  storeName?: string;
  contactNumber?: string;
  customerEmail?: string;
  customerAddress?: string; // Brgy, City, Province
  
  // Branch details
  branchId: number;
  branchCode: string;
  branchName: string;
  
  // Issue & Dwell Verification
  issueDate: string; // YYYY-MM-DD
  issueDocNo: string;
  issueDocType: string;
  agingBasisSource: AgingBasisSource;
  
  // Computed Aging Metrics
  ageDays: number;
  agingBucket: AgingBucketType;
  agingThreshold: number; // e.g., 30 days
  overdueDays: number;
  isOverdue: boolean;
  isEstimated: boolean; // true if FIFO quantity estimate instead of exact serial match
  recommendedAction: CustomerAgingAction;
  
  // Supporting documents trail
  supportingDocuments: SupportingDocumentRecord[];
}

export interface CustomerCylinderAgingKPIs {
  totalUnitsHeld: number;
  overdueUnits: number;
  overduePercentage: number;
  averageDwellDays: number;
  priorityCollectionAccountsCount: number;
  totalCustomersWithCylinders: number;
}

export interface ChartBucketDistributionPoint {
  bucket: string;
  label: string;
  count: number;
  fill?: string;
}

export interface ChartRiskSharePoint {
  name: string;
  count: number;
  fill?: string;
}

export interface CustomerCylinderAgingChartsData {
  bucketDistribution: ChartBucketDistributionPoint[];
  riskDistribution: ChartRiskSharePoint[];
}

export interface CustomerCylinderAgingFilters {
  asOfDate?: string; // Cutoff date (defaults to today)
  branchId?: number | "";
  customerCode?: string;
  productId?: number | "";
  agingBucket?: AgingBucketType | "ALL" | "OVERDUE_ONLY";
  agingThreshold?: number; // default: 30
  searchQuery?: string;
}

export interface CustomerCylinderAgingReportResponse {
  filters: CustomerCylinderAgingFilters;
  generatedAt: string;
  cutoffDate: string;
  kpis: CustomerCylinderAgingKPIs;
  charts: CustomerCylinderAgingChartsData;
  items: CustomerCylinderAgingItem[];
}

export interface LookupOption {
  value: string;
  label: string;
  code?: string;
}

export interface CustomerCylinderAgingLookupsResponse {
  branches: LookupOption[];
  customers: LookupOption[];
  products: LookupOption[];
}
