// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/types/lost-damaged-cylinder.types.ts
// ==============================================================================
// Lost and Damaged Cylinder Report - Type Definitions
// Complies with VoSync development standards:
// - Comprehensive comments left behind for long-term maintainability
// - Strong typing for assets, incidents, KPIs, and movements
// ==============================================================================

export type IncidentCategory = "LOST" | "DAMAGED";

export type IncidentCondition = "GOOD" | "FOR_REPAIR" | "DAMAGED" | "SCRAP";

export type IncidentStatus = "REPORTED" | "VERIFIED" | "WRITTEN_OFF" | "RECOVERED";

export type RecoveryStatus = "PENDING_RECOVERY" | "RECOVERED" | "WRITTEN_OFF" | "SCRAPPED";

export type ChargeStatus = "UNCHARGED" | "ASSESSED" | "BILLED" | "SETTLED" | "WAIVED";

export interface MovementTracePoint {
  timestamp: string;
  docNo: string;
  docType: string;
  branchName: string;
  movementType: "IN" | "OUT" | "TRANSFER" | "ASSIGNMENT";
  quantity: number;
}

export interface IncidentRecord {
  id: number;
  incidentNo: string;
  serialNumber: string;
  productCode: string;
  productName: string;
  tareWeight: number;
  branchId: number;
  branchName: string;
  custodianCode: string;
  custodianName: string;
  custodianType: "Customer" | "Branch";
  incidentCategory: IncidentCategory;
  condition: IncidentCondition;
  status: IncidentStatus;
  recoveryStatus: RecoveryStatus;
  chargeStatus: ChargeStatus;
  assessedValue: number;
  incidentDate: string;
  daysOutstanding: number;
  writeOffDocNo: string | null;
  recoveryDocNo: string | null;
  supportingDocNo: string;
  remarks: string;
  movementsTrace: MovementTracePoint[];
}

export interface KPISummary {
  totalIncidents: number;
  lostCount: number;
  damagedCount: number;
  recoveredCount: number;
  writtenOffCount: number;
  totalLossValue: number;
  recoveredValue: number;
  unsettledChargesValue: number;
  recoveryRate: number; // percentage (0 - 100)
}

export interface IncidentDistributionItem {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyFinancialTrendItem {
  month: string;
  lossValue: number;
  recoveredValue: number;
  incidentCount: number;
}

export interface LostDamagedReportCharts {
  incidentDistribution: IncidentDistributionItem[];
  monthlyTrend: MonthlyFinancialTrendItem[];
}

export interface LostDamagedLookupsResponse {
  branches: Array<{ id: number; branch_code: string; branch_name: string }>;
  products: Array<{ product_id: number; product_code: string; product_name: string }>;
}

export interface LostDamagedReportResponse {
  kpis: KPISummary;
  charts: LostDamagedReportCharts;
  rows: IncidentRecord[];
  totalCount: number;
  reportingCutoff: string;
}
