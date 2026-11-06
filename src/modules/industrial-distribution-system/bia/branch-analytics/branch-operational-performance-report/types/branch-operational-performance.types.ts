// types/branch-operational-performance.types.ts
// ──────────────────────────────────────────────────────────────────────────────
// Shared TypeScript contracts for BIA Branch Operational Performance Report.
// Sourced from sales_invoice, cylinder_assets, dispatch_plan, post_dispatch_plan,
// and database views v_serial_movements & v_serial_onhand.
// ──────────────────────────────────────────────────────────────────────────────

export type IncidentType =
  | "CYLINDER_LOST"
  | "CYLINDER_DAMAGED"
  | "UNRETURNED_AGING"
  | "DELIVERY_VARIANCE";

export type RecoveryStatus =
  | "IN_CUSTODY"
  | "PENDING_RECOVERY"
  | "RECOVERED"
  | "WRITTEN_OFF";

export type ChargeStatus =
  | "UNCHARGED"
  | "ASSESSED"
  | "CHARGED"
  | "WAIVED";

export type CustodianType = "Customer" | "Salesman" | "Driver" | "Branch";

export interface BranchOperationalFilters {
  branchId?: number | "";
  custodianCode?: string;
  incidentType?: IncidentType | "all";
  recoveryStatus?: RecoveryStatus | "all";
  chargeStatus?: ChargeStatus | "all";
  startDate: string;
  endDate: string;
}

export interface AppliedFilterContext extends BranchOperationalFilters {
  branchLabel?: string;
  custodianLabel?: string;
}

export interface BranchOperationalKPIs {
  totalSalesAmount: number;
  activeHoldingCylinders: number;
  warehouseOnhandCylinders: number;
  deliveredFulls: number;
  returnedEmpties: number;
  cylinderRecoveryRate: number; // (returnedEmpties / deliveredFulls) * 100
  totalTripExpenses: number;
  activeIncidentsCount: number;
}

export interface IncidentMovementTrace {
  timestamp: string;
  docNo: string;
  docType: string;
  branchName: string;
  movementType: "IN" | "OUT" | "TRANSFER" | "ASSIGNMENT";
  quantity: number;
  remarks?: string;
}

export interface IncidentRecord {
  id: string | number;
  incidentNo: string;
  serialNumber: string;
  productName: string;
  productCode: string;
  custodianCode: string;
  custodianName: string;
  custodianType: CustodianType;
  incidentType: IncidentType;
  assessedValue: number;
  recoveryStatus: RecoveryStatus;
  chargeStatus: ChargeStatus;
  documentRef: string;
  incidentDate: string;
  daysOutstanding: number;
  movementsTrace?: IncidentMovementTrace[];
}

export interface VolumeTrendPoint {
  date: string;
  deliveredFulls: number;
  returnedEmpties: number;
  salesAmount: number;
}

export interface CostRevenueTrendPoint {
  date: string;
  salesRevenue: number;
  tripExpense: number;
}

export interface StatusDistributionPoint {
  name: string;
  value: number;
  fill?: string;
}

export interface BranchOperationalReportCharts {
  volumeTrends: VolumeTrendPoint[];
  costRevenueTrends: CostRevenueTrendPoint[];
  incidentDistribution: StatusDistributionPoint[];
  recoveryDistribution: StatusDistributionPoint[];
}

export interface BranchOperationalReportResponse {
  filters: AppliedFilterContext;
  generatedAt: string;
  dataFreshnessTimestamp: string;
  cutoffDate: string;
  kpis: BranchOperationalKPIs;
  charts: BranchOperationalReportCharts;
  incidents: IncidentRecord[];
}

export interface LookupOption {
  value: string;
  label: string;
  code?: string;
}

export interface ReportLookupsResponse {
  branches: LookupOption[];
  custodians: LookupOption[];
}
