// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/services/cylinder-stock-report.aggregation.ts
// ==============================================================================
// Cylinder Stock Report - Aggregation Engine
// Complies with VoSync development standards:
// - Comprehensive comments left behind on logic and reconciliation
// - Pure aggregation function mapping Directus raw rows & Spring movements to report outputs
// - Resolves gas products from products table and variant states from units table
// ==============================================================================

import type {
  CylinderStockRecord,
  CylinderStockKPISummary,
  CylinderStockReportCharts,
  CylinderStockReportResponse,
  CylinderCondition,
  CylinderStatus,
  SerialMovementItem,
  RawUnit,
} from "../types/cylinder-stock-report.types";
import type { CylinderStockFilterInput } from "../types/cylinder-stock-report.schema";

export interface RawCylinderAsset {
  id: number;
  product_id: number | { product_id: number; product_code?: string; product_name?: string };
  serial_number: string;
  cylinder_status: string;
  cylinder_condition: string;
  current_branch_id: number | { id: number; branch_name?: string; branch_code?: string } | null;
  current_customer_code: string | null;
  current_supplier_id: number | null;
  acquisition_date: string | null;
  expiration_date: string | null;
  tare_weight: number | string | null;
  cost: number | string | null;
  remarks: string | null;
  is_deleted?: number;
  created_date?: string | null;
  modified_date?: string | null;
}

export interface RawProduct {
  product_id: number;
  product_code: string | null;
  product_name: string | null;
  is_serialized?: number | boolean | string;
  weight?: number | null;
  product_weight?: number | null;
  unit_of_measurement?: number | null;
  uom_ids?: string | null;
  description?: string | null;
  isActive?: number | boolean;
}

export interface RawBranch {
  id: number;
  branch_code: string;
  branch_name: string;
  isActive?: number;
}

export interface RawCustomer {
  customer_code: string;
  customer_name: string;
  store_name?: string | null;
}

export interface RawStockTransferTransit {
  stock_transfer_id: number;
  serial_number: string;
  scan_type: "DISPATCH" | "RECEIVE";
  created_at: string;
}

export interface AggregationSourceData {
  assets: RawCylinderAsset[];
  products: RawProduct[];
  units: RawUnit[];
  branches: RawBranch[];
  customers: RawCustomer[];
  transits?: RawStockTransferTransit[];
  movements: SerialMovementItem[];
}

/**
 * Valid cylinder UOM variant states strictly excluding standard weight units (like KG).
 */
const VALID_CYLINDER_VARIANT_STATES = ["EMPTY", "SWAP", "REFILL", "DEPOSIT", "OUTRIGHT", "FULL"];

/**
 * Resolves the cylinder's variant state from product.uom_ids or linked unit master.
 */
function resolveVariantState(product?: RawProduct, unit?: RawUnit): string {
  // Check product.uom_ids tag first (e.g. "EMPTY", "SWAP", "REFILL", "FULL")
  if (product?.uom_ids) {
    const candidate = product.uom_ids.trim().toUpperCase();
    if (VALID_CYLINDER_VARIANT_STATES.includes(candidate)) {
      return candidate;
    }
  }

  // Check linked unit from units table
  if (unit?.unit_name) {
    const candidate = unit.unit_name.trim().toUpperCase();
    if (VALID_CYLINDER_VARIANT_STATES.includes(candidate)) {
      return candidate;
    }
  }

  if (unit?.unit_shortcut) {
    const candidate = unit.unit_shortcut.trim().toUpperCase();
    if (VALID_CYLINDER_VARIANT_STATES.includes(candidate)) {
      return candidate;
    }
  }

  return "STANDARD";
}

/**
 * Pure aggregation function calculating stock summaries, KPIs, and tabular view.
 */
export function aggregateCylinderStockReport(
  source: AggregationSourceData,
  filters: CylinderStockFilterInput
): CylinderStockReportResponse {
  const { assets, products, units = [], branches, customers, movements = [] } = source;

  // Build quick-lookup maps
  const productMap = new Map<number, RawProduct>();
  products.forEach((p) => productMap.set(p.product_id, p));

  const unitMap = new Map<number, RawUnit>();
  units.forEach((u) => unitMap.set(u.unit_id, u));

  const branchMap = new Map<number, RawBranch>();
  branches.forEach((b) => branchMap.set(b.id, b));

  const customerMap = new Map<string, RawCustomer>();
  customers.forEach((c) => customerMap.set(c.customer_code, c));

  // Map latest movements by serial number
  const latestMovementsBySerial = new Map<string, SerialMovementItem>();
  movements.forEach((m) => {
    const key = (m.serial_number || "").trim().toUpperCase();
    if (!key) return;
    const existing = latestMovementsBySerial.get(key);
    if (!existing || new Date(m.ts).getTime() > new Date(existing.ts).getTime()) {
      latestMovementsBySerial.set(key, m);
    }
  });

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Process all assets into normalized records
  const allRecords: CylinderStockRecord[] = [];

  for (const asset of assets) {
    if (asset.is_deleted === 1) continue;

    const prodId = typeof asset.product_id === "object" && asset.product_id !== null
      ? asset.product_id.product_id
      : Number(asset.product_id);

    const product = productMap.get(prodId);

    // If Directus has nested relation info on asset.product_id
    const nestedProduct = typeof asset.product_id === "object" && asset.product_id !== null
      ? asset.product_id
      : undefined;

    const branchId = typeof asset.current_branch_id === "object" && asset.current_branch_id !== null
      ? asset.current_branch_id.id
      : (asset.current_branch_id ? Number(asset.current_branch_id) : null);
    const branch = branchId ? branchMap.get(branchId) : undefined;

    const custCode = asset.current_customer_code ? String(asset.current_customer_code).trim() : null;
    const customer = custCode ? customerMap.get(custCode) : undefined;

    const rawStatus = (asset.cylinder_status || "AVAILABLE").toUpperCase() as CylinderStatus;
    const rawCondition = (asset.cylinder_condition || "GOOD").toUpperCase() as CylinderCondition;

    // Custodian logic: Custody is separate from warehouse branch stock
    let custodianType: "Warehouse" | "Customer" | "Supplier" = "Warehouse";
    let custodianName = branch?.branch_name || (branchId ? `Branch #${branchId}` : "Warehouse Floor");

    if (custCode || rawStatus === "WITH_CUSTOMER") {
      custodianType = "Customer";
      custodianName = customer?.customer_name || customer?.store_name || custCode || "Customer Custody";
    } else if (asset.current_supplier_id || rawStatus === "WITH_SUPPLIER") {
      custodianType = "Supplier";
      custodianName = `Supplier #${asset.current_supplier_id || "External Refiller"}`;
    }

    const expDate = asset.expiration_date ? String(asset.expiration_date).split("T")[0] : null;
    const isExpired = expDate ? expDate < todayStr : false;
    const isNearExpiry = expDate && !isExpired ? expDate <= in30Days : false;

    // Available Usable rule: Good condition, inside warehouse, status AVAILABLE/FULL/EMPTY
    const isAvailableUsable =
      rawCondition === "GOOD" &&
      custodianType === "Warehouse" &&
      branchId !== null &&
      ["AVAILABLE", "FULL", "EMPTY"].includes(rawStatus);

    // Resolve Unit and Variant State
    const unit = product?.unit_of_measurement ? unitMap.get(product.unit_of_measurement) : undefined;
    const variantState = resolveVariantState(product, unit);

    const cleanSerial = (asset.serial_number || "").trim().toUpperCase();

    // Prioritize product name and code from products table
    const resolvedProductName =
      product?.product_name ||
      nestedProduct?.product_name ||
      product?.description ||
      `Product #${prodId}`;

    const resolvedProductCode =
      product?.product_code ||
      nestedProduct?.product_code ||
      `PRD-${prodId}`;

    const record: CylinderStockRecord = {
      id: asset.id,
      productId: prodId,
      productCode: resolvedProductCode,
      productName: resolvedProductName,
      variantState,
      unitName: unit?.unit_name || null,
      unitShortcut: unit?.unit_shortcut || null,
      serialNumber: cleanSerial,
      cylinderStatus: rawStatus,
      cylinderCondition: rawCondition,
      branchId,
      branchName: branch?.branch_name || "Unassigned Branch",
      branchCode: branch?.branch_code || "N/A",
      customerCode: custCode,
      customerName: customer?.customer_name || null,
      supplierId: asset.current_supplier_id ? Number(asset.current_supplier_id) : null,
      supplierName: null,
      custodianType,
      custodianName,
      tareWeight: asset.tare_weight !== null ? Number(asset.tare_weight) : (product?.weight || null),
      cost: asset.cost !== null ? Number(asset.cost) : null,
      acquisitionDate: asset.acquisition_date ? String(asset.acquisition_date).split("T")[0] : null,
      expirationDate: expDate,
      isExpired,
      isNearExpiry,
      isAvailableUsable,
      remarks: asset.remarks || null,
      lastMovement: latestMovementsBySerial.get(cleanSerial) || null,
    };

    allRecords.push(record);
  }

  // Calculate Global KPIs before table filters
  const branchScopedRecords = filters.branchId
    ? allRecords.filter((r) => r.branchId === filters.branchId)
    : allRecords;

  const kpis: CylinderStockKPISummary = {
    totalAssets: branchScopedRecords.length,
    usableAvailable: 0,
    fullStock: 0,
    emptyStock: 0,
    loadedStock: 0,
    reservedStock: 0,
    quarantinedDefective: 0,
    inTransit: 0,
    withCustomer: 0,
    withSupplier: 0,
  };

  const conditionCounts: Record<string, number> = {
    GOOD: 0,
    FOR_REPAIR: 0,
    DAMAGED: 0,
    SCRAP: 0,
  };

  const variantCountMap = new Map<string, { available: number; total: number }>();

  for (const r of branchScopedRecords) {
    conditionCounts[r.cylinderCondition] = (conditionCounts[r.cylinderCondition] || 0) + 1;

    // Track variant counts
    if (!variantCountMap.has(r.variantState)) {
      variantCountMap.set(r.variantState, { available: 0, total: 0 });
    }
    const varAgg = variantCountMap.get(r.variantState)!;
    varAgg.total++;

    if (r.custodianType === "Customer") {
      kpis.withCustomer++;
    } else if (r.custodianType === "Supplier") {
      kpis.withSupplier++;
    } else {
      // In warehouse
      if (r.isAvailableUsable) {
        kpis.usableAvailable++;
        varAgg.available++;
      }

      if (r.cylinderStatus === "FULL") {
        kpis.fullStock++;
      } else if (r.cylinderStatus === "EMPTY") {
        kpis.emptyStock++;
      } else if (r.cylinderStatus === "LOADED") {
        kpis.loadedStock++;
      } else if (r.cylinderStatus === "RESERVED") {
        kpis.reservedStock++;
      } else if (
        ["DAMAGED", "LOST", "RETIRED", "UNRECEIVED/REPLACED"].includes(r.cylinderStatus) ||
        ["FOR_REPAIR", "DAMAGED", "SCRAP"].includes(r.cylinderCondition)
      ) {
        kpis.quarantinedDefective++;
      }
    }
  }

  // Filter records for table view
  let filteredRows = branchScopedRecords;

  if (filters.condition && filters.condition !== "ALL") {
    filteredRows = filteredRows.filter((r) => r.cylinderCondition === filters.condition);
  }

  if (filters.status && filters.status !== "ALL") {
    if (filters.status === "AVAILABLE") {
      filteredRows = filteredRows.filter((r) => r.isAvailableUsable);
    } else {
      filteredRows = filteredRows.filter((r) => r.cylinderStatus === filters.status);
    }
  }

  if (filters.productId) {
    filteredRows = filteredRows.filter((r) => r.productId === filters.productId);
  }

  if (filters.variantState && filters.variantState !== "ALL") {
    filteredRows = filteredRows.filter((r) => r.variantState.toUpperCase() === filters.variantState!.toUpperCase());
  }

  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    filteredRows = filteredRows.filter(
      (r) =>
        r.serialNumber.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.productCode.toLowerCase().includes(q) ||
        r.branchName.toLowerCase().includes(q) ||
        (r.customerName && r.customerName.toLowerCase().includes(q)) ||
        (r.remarks && r.remarks.toLowerCase().includes(q))
    );
  }

  // Sorting
  const sortField = filters.sortField as keyof CylinderStockRecord;
  const isAsc = filters.sortOrder === "asc";
  filteredRows.sort((a, b) => {
    const valA = a[sortField] ?? "";
    const valB = b[sortField] ?? "";
    if (valA < valB) return isAsc ? -1 : 1;
    if (valA > valB) return isAsc ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalCount = filteredRows.length;
  const page = filters.page || 1;
  const limit = filters.limit || 25;
  const startIndex = (page - 1) * limit;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + limit);

  // Chart data
  const charts: CylinderStockReportCharts = {
    conditionDistribution: [
      { name: "Good", value: conditionCounts.GOOD || 0, color: "#10b981" },
      { name: "For Repair", value: conditionCounts.FOR_REPAIR || 0, color: "#f59e0b" },
      { name: "Damaged", value: conditionCounts.DAMAGED || 0, color: "#ef4444" },
      { name: "Scrap", value: conditionCounts.SCRAP || 0, color: "#64748b" },
    ],
    statusDistribution: [
      { name: "Available / Full", value: kpis.fullStock, color: "#06b6d4" },
      { name: "Empty", value: kpis.emptyStock, color: "#94a3b8" },
      { name: "Loaded / Reserved", value: kpis.loadedStock + kpis.reservedStock, color: "#f59e0b" },
      { name: "Defective / Quarantine", value: kpis.quarantinedDefective, color: "#ef4444" },
      { name: "With Customer", value: kpis.withCustomer, color: "#6366f1" },
    ],
    variantBreakdown: Array.from(variantCountMap.entries()).map(([variantState, stats]) => ({
      variantState,
      available: stats.available,
      total: stats.total,
    })),
  };

  const cutoff = filters.cutoffDate || new Date().toISOString().replace("T", " ").substring(0, 19);

  return {
    kpis,
    charts,
    rows: paginatedRows,
    totalCount,
    reportingCutoff: cutoff,
  };
}
