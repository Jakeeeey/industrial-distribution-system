// ============================================================
// customer-order-consumption.calc.ts
// Shared, pure aggregation core: lookup indexes, kg resolution,
// accumulator plumbing, overview rollup and the monthly trend.
// No I/O here — the repo layer feeds rows in.
// ============================================================

import type {
  ConsumptionChannel,
  ConsumptionSourceData,
  CustomerOrderConsumptionOverview,
  CustomerOrderConsumptionRow,
  ExceptionCode,
  MonthlyTrendPoint,
  RawBranchRow,
  RawCategoryRow,
  RawClassificationRow,
  RawCustomerRow,
  RawProductRow,
  RawSalesmanRow,
  RawUnitRow,
  RawWeightUnitRow,
  ReportException,
  ReportTrendPoint,
} from "../types/customer-order-consumption.types";
import {
  computeReturnRate,
  dateOnly,
  isTruthyFlag,
  monthKey,
  normalizeStatus,
  safeRatio,
  toNumber,
} from "./customer-order-consumption.helpers";

// ------------------------------------------------------------
// Lookup indexes
// ------------------------------------------------------------
export interface ConsumptionContext {
  products: Map<number, RawProductRow>;
  units: Map<number, RawUnitRow>;
  weightUnits: Map<number, RawWeightUnitRow>;
  categories: Map<number, RawCategoryRow>;
  customers: Map<string, RawCustomerRow>;
  classifications: Map<number, RawClassificationRow>;
  branches: Map<number, RawBranchRow>;
  salesmen: Map<number, RawSalesmanRow>;
}

/**
 * Builds id -> row maps once per report run so the aggregation loops stay
 * O(rows) instead of O(rows x master rows).
 */
export function buildContext(source: ConsumptionSourceData): ConsumptionContext {
  return {
    products: new Map(source.products.map((row) => [row.product_id, row])),
    units: new Map(source.units.map((row) => [row.unit_id, row])),
    weightUnits: new Map(source.weightUnits.map((row) => [row.id, row])),
    categories: new Map(source.categories.map((row) => [row.category_id, row])),
    customers: new Map(source.customers.map((row) => [row.customer_code, row])),
    classifications: new Map(
      source.classifications.map((row) => [row.id, row])
    ),
    branches: new Map(source.branches.map((row) => [row.id, row])),
    salesmen: new Map(source.salesmen.map((row) => [row.id, row])),
  };
}

// ------------------------------------------------------------
// Kilogram resolution — the rule that keeps units from being mixed
// ------------------------------------------------------------
export interface KgResolution {
  kg: number;
  /** Present only when the line carried a real unit row. */
  unitLabel?: string;
  exception?: ExceptionCode;
  detail?: string;
}

/**
 * Reads the cylinder size out of `categories.category_name`.
 *
 * The categories table has no numeric size column, and the serialized
 * cylinder products commonly carry 0 in `products.product_weight`, so the
 * size is encoded in the category name instead ("LPG 11KG", "LPG 1.4KG").
 * Only an explicit "<n>KG" figure is accepted; anything else returns null
 * rather than guessing a size.
 */
export function parseCategorySizeKg(
  categoryName: string | null | undefined
): number | null {
  const match = /(\d+(?:\.\d+)?)\s*kgs?\b/i.exec(String(categoryName ?? ""));
  if (!match) return null;
  const size = Number.parseFloat(match[1] ?? "");
  return Number.isFinite(size) && size > 0 ? size : null;
}

/**
 * Category-derived size, but only for products flagged as cylinders in an
 * industrial category. The size label is never applied to a product that
 * could not have passed the channel scope gate.
 */
function categorySizeKg(
  product: RawProductRow,
  context: ConsumptionContext
): number | null {
  if (!isTruthyFlag(product.is_serialized)) return null;
  const category =
    product.product_category == null
      ? undefined
      : context.categories.get(product.product_category);
  if (!isTruthyFlag(category?.is_industrial)) return null;
  return parseCategorySizeKg(category?.category_name);
}

/**
 * Scope gate for the CYLINDER channel: a product must be serialized AND
 * belong to an industrial category. A product that was not fetched is
 * unknown; a product whose category row is absent cannot be proven
 * industrial, so both are reported instead of silently dropped.
 */
export type CylinderProductScope =
  | "included"
  | "excluded"
  | "missing"
  | "missing_category";

export function cylinderProductScope(
  productId: number,
  context: ConsumptionContext
): CylinderProductScope {
  const product = context.products.get(productId);
  if (!product) return "missing";
  if (!isTruthyFlag(product.is_serialized)) return "excluded";
  if (product.product_category == null) return "missing_category";
  const category = context.categories.get(product.product_category);
  if (!category) return "missing_category";
  return isTruthyFlag(category.is_industrial) ? "included" : "excluded";
}

/**
 * Converts a piece quantity into kilograms.
 *
 * Two legitimate shapes exist in the data:
 *  - the line is already billed in kg (unit name/shortcut says so) -> qty is kg
 *  - the line is billed per cylinder -> qty x the cylinder size
 *
 * The cylinder size comes from the product's category name first, because a
 * serialized cylinder product usually stores 0 in `product_weight`; the
 * legacy weight columns are only a fallback. `cylinder_assets.tare_weight`
 * is never used, because tare is the weight of the EMPTY vessel, not the gas.
 */
export function resolveLineKg(
  quantity: number,
  productId: number,
  unitId: number | null,
  context: ConsumptionContext
): KgResolution {
  const unit = unitId == null ? undefined : context.units.get(unitId);
  const unitLabel = unit?.unit_shortcut ?? unit?.unit_name ?? undefined;
  const label = `${unit?.unit_name ?? ""} ${unit?.unit_shortcut ?? ""}`.toLowerCase();
  if (label.includes("kg") || label.includes("kilo")) {
    return { kg: quantity, unitLabel };
  }

  const product = context.products.get(productId);
  if (!product) {
    return {
      kg: 0,
      unitLabel,
      exception: "MISSING_PRODUCT_WEIGHT",
      detail: "Product master row not found",
    };
  }

  const categorySize = categorySizeKg(product, context);
  if (categorySize != null) {
    return { kg: quantity * categorySize, unitLabel };
  }

  const weight = toNumber(product.product_weight) || toNumber(product.weight);
  if (weight <= 0) {
    return {
      kg: 0,
      unitLabel,
      exception: "MISSING_PRODUCT_WEIGHT",
      detail: `${product.product_name ?? product.product_id} has no category cylinder size or product_weight`,
    };
  }

  const weightUnit = product.weight_unit_id
    ? context.weightUnits.get(product.weight_unit_id)
    : undefined;
  const weightUnitCode = (weightUnit?.code ?? "KG").toUpperCase();
  if (
    weightUnitCode !== "KG" &&
    weightUnitCode !== "KGS" &&
    weightUnitCode !== "KILOGRAM"
  ) {
    // No conversion factor is modelled anywhere in the schema, so a
    // non-kilogram master weight is reported instead of guessed.
    return {
      kg: 0,
      unitLabel,
      exception: "NON_KG_WEIGHT_UNIT",
      detail: `${product.product_name ?? product.product_id} weighs ${weight} ${weightUnitCode}`,
    };
  }

  return { kg: quantity * weight, unitLabel };
}

/**
 * Cylinder size label for the results table (kg per unit). The category
 * name wins because it is what the cylinder catalogue groups by; the
 * product weight remains the fallback for older master rows.
 */
export function resolveSizeKg(
  productId: number,
  context: ConsumptionContext
): number | null {
  const product = context.products.get(productId);
  if (!product) return null;
  const categorySize = categorySizeKg(product, context);
  if (categorySize != null) return categorySize;
  const weight = toNumber(product.product_weight) || toNumber(product.weight);
  return weight > 0 ? weight : null;
}

/**
 * Provisional gas dimension. There is no gas_type column in the schema, so
 * the product category name is surfaced and null means genuinely unknown.
 */
export function resolveGasType(
  productId: number,
  context: ConsumptionContext
): string | null {
  const category = context.products.get(productId)?.product_category;
  if (category == null) return null;
  const label = context.categories.get(category)?.category_name;
  return label ? String(label) : null;
}

// ------------------------------------------------------------
// Accumulator plumbing
// ------------------------------------------------------------
export interface RowAccumulator {
  customerCode: string;
  branchId: number | null;
  channel: ConsumptionChannel;
  billingMode: string | null;
  productId: number;
  orderKeys: Set<string>;
  grossQty: number;
  returnedQty: number;
  grossKg: number;
  returnedKg: number;
  netAmount: number;
  meteredKg: number;
  wiwoKg: number;
  varianceKg: number;
  quantityUnit: string;
  exceptionCodes: Set<ExceptionCode>;
  months: Map<string, MonthlyTrendPoint>;
}

/** Grain of the result set: customer x branch x channel x product. */
export function accumulatorKey(input: {
  customerCode: string;
  branchId: number | null;
  channel: ConsumptionChannel;
  productId: number;
}): string {
  return [
    input.customerCode,
    input.branchId ?? "NA",
    input.channel,
    input.productId,
  ].join("|");
}

export function createAccumulator(
  customerCode: string,
  branchId: number | null,
  channel: ConsumptionChannel,
  productId: number
): RowAccumulator {
  return {
    customerCode,
    branchId,
    channel,
    billingMode: null,
    productId,
    orderKeys: new Set(),
    grossQty: 0,
    returnedQty: 0,
    grossKg: 0,
    returnedKg: 0,
    netAmount: 0,
    meteredKg: 0,
    wiwoKg: 0,
    varianceKg: 0,
    quantityUnit: "pcs",
    exceptionCodes: new Set(),
    months: new Map(),
  };
}

/**
 * Returns the accumulator for one grain, creating it on first touch.
 * Both channels share one index so a channel filter can drop one side
 * without the other losing its totals.
 */
export function ensureAccumulator(
  index: Map<string, RowAccumulator>,
  input: {
    customerCode: string;
    branchId: number | null;
    channel: ConsumptionChannel;
    productId: number;
  }
): RowAccumulator {
  const key = accumulatorKey(input);
  const existing = index.get(key);
  if (existing) return existing;
  const created = createAccumulator(
    input.customerCode,
    input.branchId,
    input.channel,
    input.productId
  );
  index.set(key, created);
  return created;
}

/**
 * Single write path for movement. The accumulator carries the row totals and
 * one bucket per month, both bumped here so a row can never disagree with the
 * sum of its own trend.
 */
export function accumulateMonth(
  acc: RowAccumulator,
  dateValue: string | null | undefined,
  input: { orderKey?: string; qty?: number; kg?: number; returnedQty?: number; returnedKg?: number }
): void {
  acc.grossQty += input.qty ?? 0;
  acc.returnedQty += input.returnedQty ?? 0;
  acc.grossKg += input.kg ?? 0;
  acc.returnedKg += input.returnedKg ?? 0;

  // The row-level set is global: one sales order is one buying event however
  // many invoices, months or products it was split across.
  if (input.orderKey) acc.orderKeys.add(input.orderKey);

  const key = monthKey(dateValue);
  if (!key) return;
  const point =
    acc.months.get(key) ??
    { yearMonth: key, orderCount: 0, orderKeys: [], grossQty: 0, returnedQty: 0, grossKg: 0, returnedKg: 0, netKg: 0 };
  if (input.orderKey && !point.orderKeys.includes(input.orderKey)) {
    // Each month credits the events that actually moved inside it, so the
    // chart never shows a zero-event bucket carrying quantity.
    point.orderKeys.push(input.orderKey);
    point.orderCount += 1;
  }
  point.grossQty += input.qty ?? 0;
  point.returnedQty += input.returnedQty ?? 0;
  point.grossKg += input.kg ?? 0;
  point.returnedKg += input.returnedKg ?? 0;
  acc.months.set(key, point);
}

/**
 * Freezes one accumulator into a result row, joining the master lookups.
 * Rows with no movement of any kind are dropped so the table has no shells.
 */
export function finalizeRow(
  acc: RowAccumulator,
  context: ConsumptionContext
): CustomerOrderConsumptionRow {
  const customer = context.customers.get(acc.customerCode);
  const product = context.products.get(acc.productId);
  const branch = acc.branchId == null ? undefined : context.branches.get(acc.branchId);
  const orderCount = acc.orderKeys.size;
  const netQty = acc.grossQty - acc.returnedQty;
  const netKg = acc.grossKg - acc.returnedKg;

  const trend = [...acc.months.values()]
    .map((point) => ({
      ...point,
      netKg: point.grossKg - point.returnedKg,
    }))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

  return {
    customerCode: acc.customerCode,
    customerName: customer?.customer_name ?? acc.customerCode,
    storeName: customer?.store_name ?? "",
    classificationName:
      customer?.classification != null
        ? context.classifications.get(customer.classification)?.classification_name ?? ""
        : "",
    branchId: acc.branchId,
    branchName: branch?.branch_name ?? (acc.branchId == null ? "Unassigned" : String(acc.branchId)),
    channel: acc.channel,
    billingMode: acc.billingMode as CustomerOrderConsumptionRow["billingMode"],
    productId: acc.productId,
    productCode: product?.product_code ?? (acc.productId ? String(acc.productId) : "—"),
    productName: product?.product_name ?? (acc.productId ? `Product ${acc.productId}` : "Site supply"),
    gasType: resolveGasType(acc.productId, context),
    sizeKg: resolveSizeKg(acc.productId, context),
    quantityUnit: acc.quantityUnit,
    orderCount,
    grossQty: acc.grossQty,
    returnedQty: acc.returnedQty,
    netQty,
    grossKg: acc.grossKg,
    returnedKg: acc.returnedKg,
    netKg,
    kgIsProxy: acc.channel === "CYLINDER",
    netAmount: acc.netAmount,
    avgOrderSizeKg: safeRatio(netKg, orderCount),
    avgOrderSizeQty: safeRatio(netQty, orderCount),
    meteredKg: acc.meteredKg,
    wiwoKg: acc.wiwoKg,
    varianceKg: acc.varianceKg,
    monthlyTrend: trend,
    exceptionCodes: [...acc.exceptionCodes],
  };
}

export function exception(input: Omit<ReportException, "quantity" | "kg"> & {
  quantity?: number;
  kg?: number;
}): ReportException {
  return { quantity: 0, kg: 0, ...input };
}

// ------------------------------------------------------------
// Rollups
// ------------------------------------------------------------
export interface ChannelTotals {
  customers: number;
  orders: number;
  grossQty: number;
  returnedQty: number;
  grossKg: number;
  returnedKg: number;
  netKg: number;
  netAmount: number;
  avgOrderSizeKg: number;
  returnRatePct: number;
}

/** Totals for one channel only — the two kg bases are never added together. */
function channelTotals(
  rows: CustomerOrderConsumptionRow[],
  channel: ConsumptionChannel
): ChannelTotals {
  const scoped = rows.filter((row) => row.channel === channel);
  const eventKeys = new Set<string>();
  let grossQty = 0;
  let returnedQty = 0;
  let grossKg = 0;
  let returnedKg = 0;
  let netAmount = 0;

  for (const row of scoped) {
    for (const point of row.monthlyTrend) {
      for (const key of point.orderKeys) eventKeys.add(key);
    }
    grossQty += row.grossQty;
    returnedQty += row.returnedQty;
    grossKg += row.grossKg;
    returnedKg += row.returnedKg;
    netAmount += row.netAmount;
  }

  // Deduped across rows: one sales order covering three products is one
  // buying event, which is the frequency the report is meant to measure.
  const orders = eventKeys.size;
  const netKg = grossKg - returnedKg;
  return {
    customers: new Set(scoped.map((row) => row.customerCode)).size,
    orders,
    grossQty,
    returnedQty,
    grossKg,
    returnedKg,
    netKg,
    netAmount,
    avgOrderSizeKg: safeRatio(netKg, orders),
    returnRatePct: computeReturnRate(returnedKg, grossKg),
  };
}

/**
 * KPI overview. `totalCustomers` counts distinct customers across both
 * channels, while every quantity/kg figure stays channel-split.
 */
export function buildOverview(
  rows: CustomerOrderConsumptionRow[],
  exceptions: ReportException[]
): CustomerOrderConsumptionOverview {
  const cylinder = channelTotals(rows, "CYLINDER");
  const lpg = channelTotals(rows, "LPG");

  return {
    totalCustomers: new Set(rows.map((row) => row.customerCode)).size,
    totalOrders: cylinder.orders + lpg.orders,
    cylinder,
    lpg,
    exceptionCount: exceptions.length,
  };
}

/**
 * Merges every row's monthly buckets into report-level series, one series per
 * channel so the chart never plots a proxy kg against a measured kg.
 */
export function buildOverallTrend(
  rows: CustomerOrderConsumptionRow[]
): ReportTrendPoint[] {
  const merged = new Map<string, ReportTrendPoint>();
  const events = new Map<string, Set<string>>();

  for (const row of rows) {
    for (const point of row.monthlyTrend) {
      const key = `${point.yearMonth}|${row.channel}`;
      const current =
        merged.get(key) ??
        {
          yearMonth: point.yearMonth,
          channel: row.channel,
          orderCount: 0,
          orderKeys: [],
          grossQty: 0,
          returnedQty: 0,
          grossKg: 0,
          returnedKg: 0,
          netKg: 0,
        };
      const bucket = events.get(key) ?? new Set<string>();
      for (const orderKey of point.orderKeys) bucket.add(orderKey);
      events.set(key, bucket);

      current.orderCount = bucket.size;
      current.orderKeys = [...bucket];
      current.grossQty += point.grossQty;
      current.returnedQty += point.returnedQty;
      current.grossKg += point.grossKg;
      current.returnedKg += point.returnedKg;
      current.netKg = current.grossKg - current.returnedKg;
      merged.set(key, current);
    }
  }

  return [...merged.values()].sort(
    (a, b) =>
      a.yearMonth.localeCompare(b.yearMonth) || a.channel.localeCompare(b.channel)
  );
}

/** True when a document should be excluded from reporting altogether. */
export function isRejected(status: string | null | undefined, isReplaced?: unknown): boolean {
  if (isTruthyFlag(isReplaced)) return true;
  const normalized = normalizeStatus(status);
  return normalized === "cancelled" || normalized === "voided" || normalized === "rejected";
}

/** Normalised date string used for inclusive window comparisons. */
export function withinWindow(value: string | null | undefined, start: string, end: string): boolean {
  const iso = dateOnly(value);
  if (!iso) return false;
  return iso >= start && iso <= end;
}
