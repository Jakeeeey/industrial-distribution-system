// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/types/cylinder-stock-report.types.ts
// ==============================================================================
// Cylinder Stock Report - Domain Types
// Complies with VoSync development standards:
// - Comprehensive comments left behind for maintainability
// - Strong typing matching database DDL definitions
// - Cylinder variant states from units table (EMPTY, SWAP, REFILL, DEPOSIT, OUTRIGHT, FULL)
// ==============================================================================

export type CylinderCondition = "GOOD" | "FOR_REPAIR" | "DAMAGED" | "SCRAP";

export type CylinderStatus =
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

export type CylinderVariantState =
  | "EMPTY"
  | "SWAP"
  | "REFILL"
  | "DEPOSIT"
  | "OUTRIGHT"
  | "FULL";

export interface RawUnit {
  unit_id: number;
  unit_name: string;
  unit_shortcut: string | null;
  sku_code?: string | null;
  order?: number | null;
}

export interface SerialMovementItem {
  ts: string;
  product_id: number;
  branch_id: number;
  serial_number: string;
  doc_no: string;
  doc_type: string;
  in_qty: number;
  out_qty: number;
  customer_code: string | null;
  customer_name: string | null;
  supplier_name: string | null;
  product_name?: string;
  branch_name?: string;
  uom_ids?: string;
}

export interface CylinderStockRecord {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  variantState: string; // EMPTY, SWAP, REFILL, DEPOSIT, OUTRIGHT, FULL
  unitName: string | null;
  unitShortcut: string | null;
  serialNumber: string;
  cylinderStatus: CylinderStatus;
  cylinderCondition: CylinderCondition;
  branchId: number | null;
  branchName: string;
  branchCode: string;
  customerCode: string | null;
  customerName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  custodianType: "Warehouse" | "Customer" | "Supplier";
  custodianName: string;
  tareWeight: number | null;
  cost: number | null;
  acquisitionDate: string | null;
  expirationDate: string | null;
  isExpired: boolean;
  isNearExpiry: boolean;
  isAvailableUsable: boolean;
  remarks: string | null;
  lastMovement?: SerialMovementItem | null;
}

export interface CylinderStockKPISummary {
  totalAssets: number;
  usableAvailable: number;
  fullStock: number;
  emptyStock: number;
  loadedStock: number;
  reservedStock: number;
  quarantinedDefective: number;
  inTransit: number;
  withCustomer: number;
  withSupplier: number;
}

export interface CylinderStockReportCharts {
  conditionDistribution: Array<{ name: string; value: number; color: string }>;
  statusDistribution: Array<{ name: string; value: number; color: string }>;
  variantBreakdown: Array<{ variantState: string; available: number; total: number }>;
}

export interface CylinderStockLookupsResponse {
  branches: Array<{ id: number; branch_code: string; branch_name: string }>;
  products: Array<{ product_id: number; product_code: string; product_name: string }>;
  variantStates: string[];
}

export interface CylinderStockReportResponse {
  kpis: CylinderStockKPISummary;
  charts: CylinderStockReportCharts;
  rows: CylinderStockRecord[];
  totalCount: number;
  reportingCutoff: string;
}
