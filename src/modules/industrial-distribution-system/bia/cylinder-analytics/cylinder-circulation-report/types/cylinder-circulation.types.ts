// types/cylinder-circulation.types.ts
// ──────────────────────────────────────────────────────────────────────────────
// Domain contracts and TypeScript types for BIA Cylinder Circulation Report.
// Mapped to vos_database.v_serial_movements, cylinder_assets, products, branches,
// customer, dispatch_plan, and post_dispatch_plan schemas.
// ──────────────────────────────────────────────────────────────────────────────

export type CirculationBreakType =
  | "HEALTHY"
  | "BREAK_MISSING_RETURN"
  | "BREAK_UNVERIFIED_TRANSIT"
  | "BREAK_LOCATION_CONFLICT"
  | "BREAK_ORPHAN_RETURN"
  | "BREAK_STATUS_MISMATCH";

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

export type CustodianType = "Branch" | "Customer" | "Supplier" | "Driver" | "Unknown";

export interface SerialMovementRecord {
  ts: string;
  productId: number;
  branchId: number;
  serialNumber: string;
  docNo: string;
  docType: string;
  inQty: number;
  outQty: number;
  customerCode?: string | null;
  customerName?: string | null;
  supplierName?: string | null;
  productName: string;
  branchName: string;
  uomIds?: string | null;
  // Computed trace metadata
  dwellDays?: number;
  stageName?: string;
  isFlaggedBreak?: boolean;
  breakReason?: string;
}

export interface CylinderCirculationItem {
  id: string | number;
  serialNumber: string;
  productId: number;
  productName: string;
  productCode?: string;
  tareWeight?: number | null;
  cylinderStatus: CylinderStatusType;
  cylinderCondition: CylinderConditionType;
  currentBranchId: number;
  currentBranchName: string;
  currentCustodianType: CustodianType;
  currentCustodianCode: string;
  currentCustodianName: string;
  lastEventTimestamp: string;
  lastEventDocNo: string;
  lastEventDocType: string;
  circulationStatus: CirculationBreakType;
  breakDescription: string;
  totalMovementsCount: number;
  daysInCurrentStatus: number;
  averageCycleDays: number;
  movementsHistory: SerialMovementRecord[];
}

export interface CylinderCirculationKPIs {
  totalTrackedCylinders: number;
  healthyCylinders: number;
  circulationBreaksCount: number;
  breakPercentage: number;
  withCustomerCount: number;
  inTransitCount: number;
  inWarehouseCount: number;
  avgTurnaroundDays: number;
}

export interface ChartStagePoint {
  stage: string;
  volume: number;
  avgDwellDays: number;
}

export interface ChartStatusPoint {
  name: string;
  value: number;
  fill?: string;
}

export interface CylinderCirculationChartsData {
  statusDistribution: ChartStatusPoint[];
  stageTurnaround: ChartStagePoint[];
}

export interface CylinderCirculationFilters {
  branchId?: number | "";
  productId?: number | "";
  circulationStatus?: CirculationBreakType | "ALL" | "BREAKS_ONLY";
  serialNumber?: string;
  serialNumbers?: string[];
  startDate?: string;
  endDate?: string;
}

export interface CylinderCirculationReportResponse {
  filters: CylinderCirculationFilters;
  generatedAt: string;
  cutoffDate: string;
  kpis: CylinderCirculationKPIs;
  charts: CylinderCirculationChartsData;
  cylinders: CylinderCirculationItem[];
}

export interface LookupOption {
  value: string;
  label: string;
  code?: string;
}

export interface CylinderCirculationLookupsResponse {
  branches: LookupOption[];
  products: LookupOption[];
}
