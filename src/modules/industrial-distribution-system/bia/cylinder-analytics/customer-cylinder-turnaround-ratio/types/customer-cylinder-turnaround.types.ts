// types/customer-cylinder-turnaround.types.ts
// ──────────────────────────────────────────────────────────────────────────────
// Domain contracts and TypeScript types for Customer Cylinder Turnaround Ratio (CTR)
// and Incentive Calculation Module.
// Mapped to customer, branches, products, cylinder_assets, and sales/deposit movements.
// ──────────────────────────────────────────────────────────────────────────────

export type CTRGrade = "CTR_4" | "CTR_6" | "CTR_8" | "SUB_STANDARD" | "BASE_ZERO";

export type AssessmentStatus = "DRAFT" | "FOR_REVIEW" | "APPROVED" | "LOCKED";

export type PeriodMode = "MONTHLY" | "MULTI_MONTH" | "ANNUAL";

export interface LookupOption {
  value: string | number;
  label: string;
  code?: string;
  sublabel?: string;
}

export interface CustomerTurnaroundTransactionDoc {
  ts: string;
  docNo: string;
  docType: "REPEAT_ORDER" | "DEPOSIT_CYLINDER" | "SWAP" | "DELIVERY_RECEIPT";
  quantity: number;
  isRefill11kg: boolean;
  notes?: string;
}

export interface CustomerCylinderTurnaroundItem {
  id: string;
  customerCode: string;
  customerName: string;
  storeName?: string;
  contactNumber?: string;
  branchId: number;
  branchCode: string;
  branchName: string;
  
  // Period details
  periodLabel: string;
  monthsCovered: number;
  
  // Circulation inputs
  cylinderBase: number;
  repeatOrderQty: number;
  depositCylinderQty: number;
  totalCirculatingQty: number; // repeatOrderQty + depositCylinderQty
  
  // Turnaround metrics
  annualTurns: number;
  monthsPerTurn: number;
  grade: CTRGrade;
  
  // Incentive details
  eligibleRefill11kgQty: number;
  eligibleKilograms: number; // eligibleRefill11kgQty * 11
  incentiveRatePerKg: number; // 2, 4, 6, or 0
  incentivePerRefill: number; // 22, 44, 66, or 0
  totalIncentiveAmount: number; // eligibleKilograms * incentiveRatePerKg
  
  // Status & audit info
  isBaseZero: boolean;
  status: AssessmentStatus;
  lastUpdated: string;
  
  // Drill-down breakdown
  transactions: CustomerTurnaroundTransactionDoc[];
}

export interface CustomerCylinderTurnaroundKPIs {
  totalCustomers: number;
  activeTurnaroundCustomers: number;
  averageAnnualTurns: number;
  averageMonthsPerTurn: number;
  gradeDistribution: {
    ctr4Count: number;
    ctr6Count: number;
    ctr8Count: number;
    subStandardCount: number;
    baseZeroCount: number;
  };
  totalEligibleRefills11kg: number;
  totalEligibleKilograms: number;
  totalEstimatedIncentive: number;
  totalApprovedIncentive: number;
}

export interface CustomerCylinderTurnaroundAuditLog {
  id: string;
  assessmentId?: string;
  customerCode?: string;
  actionType: "STATUS_CHANGE" | "OVERRIDE_BASE" | "RECALCULATE" | "APPROVE" | "LOCK";
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  changedBy: string;
  changedRole: "Sales" | "Inventory" | "Finance" | "Management" | "Administrator";
  changedAt: string;
  reasonForChange: string;
}

export interface CustomerCylinderTurnaroundReportResponse {
  periodYear: number;
  periodStartMonth: number;
  periodEndMonth: number;
  monthsCovered: number;
  assessmentNo: string;
  status: AssessmentStatus;
  items: CustomerCylinderTurnaroundItem[];
  kpis: CustomerCylinderTurnaroundKPIs;
  auditLogs: CustomerCylinderTurnaroundAuditLog[];
}

export interface CustomerCylinderTurnaroundLookupsResponse {
  customers: LookupOption[];
  branches: LookupOption[];
  products: LookupOption[];
  years: number[];
}
