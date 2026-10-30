import assert from "node:assert/strict";
import test from "node:test";

import {
  accumulateMonth,
  buildContext,
  buildOverview,
  buildOverallTrend,
  type ConsumptionContext,
  createAccumulator,
  cylinderProductScope,
  ensureAccumulator,
  finalizeRow,
  isRejected,
  parseCategorySizeKg,
  resolveGasType,
  resolveLineKg,
  resolveSizeKg,
  type RowAccumulator,
  withinWindow,
} from "./customer-order-consumption.calc";
import {
  category,
  filters,
  masters,
  product,
  source,
  unit,
  weightUnit,
} from "./customer-order-consumption.test-fixtures";

const contextFor = (rows = source(masters())): ConsumptionContext => buildContext(rows);

const newIndex = (): Map<string, RowAccumulator> => new Map();

const grain = (
  channel: "CYLINDER" | "LPG" = "CYLINDER",
  productId = 100,
  branchId: number | null = 10,
  customerCode = "C-001"
) => ({ customerCode, branchId, channel, productId });

test("buildContext indexes every master by its lookup key", () => {
  const ctx = contextFor();
  assert.equal(ctx.products.get(100)?.product_name, "LPG 12KG");
  assert.equal(ctx.customers.get("C-001")?.customer_name, "Alpha Foods");
  assert.equal(ctx.branches.get(10)?.branch_name, "Manila");
  assert.equal(ctx.classifications.get(70)?.classification_name, "Commercial");
});

test("resolveLineKg falls back to the product gas weight when the category has no size", () => {
  const ctx = contextFor();
  const resolved = resolveLineKg(10, 100, null, ctx);
  assert.equal(resolved.kg, 120);
  assert.equal(resolved.exception, undefined);
  // products.product_weight is the filled weight; the empty-vessel tare on
  // cylinder_assets would have produced a much smaller, wrong number.
  assert.equal(resolveSizeKg(100, ctx), 12);
});

test("resolveLineKg treats a billed-in-kg line as kilograms already", () => {
  const ctx = contextFor(
    source(masters({ units: [unit({ unit_id: 4, unit_name: "Kilogram", unit_shortcut: "kg" })] }))
  );
  const resolved = resolveLineKg(250, 100, 4, ctx);
  assert.equal(resolved.kg, 250);
  assert.equal(resolved.unitLabel, "kg");
});

test("resolveLineKg reports an unusable weight instead of guessing", () => {
  const unknown = resolveLineKg(5, 999, null, contextFor());
  assert.equal(unknown.kg, 0);
  assert.equal(unknown.exception, "MISSING_PRODUCT_WEIGHT");

  const zeroWeight = contextFor(
    source(masters({ products: [product({ product_weight: 0, weight: 0 })] }))
  );
  const zero = resolveLineKg(5, 100, null, zeroWeight);
  assert.equal(zero.kg, 0);
  assert.equal(zero.exception, "MISSING_PRODUCT_WEIGHT");

  // A pound-denominated master weight has no conversion factor anywhere in
  // the schema, so kg stays 0 instead of being assumed (ticket s8).
  const lbUnit = contextFor(
    source(
      masters({
        products: [product({ product_weight: 26, weight_unit_id: 2 })],
        weightUnits: [weightUnit({ id: 2, code: "LB" })],
      })
    )
  );
  const lb = resolveLineKg(3, 100, null, lbUnit);
  assert.equal(lb.kg, 0);
  assert.equal(lb.exception, "NON_KG_WEIGHT_UNIT");
  assert.match(lb.detail ?? "", /26 LB/);
});

test("resolveLineKg falls back to the legacy weight column", () => {
  const ctx = contextFor(
    source(masters({ products: [product({ product_weight: null, weight: 50 })] }))
  );
  assert.equal(resolveLineKg(2, 100, null, ctx).kg, 100);
});

test("resolveLineKg prefers the category cylinder size over a zero product weight", () => {
  // This is the real catalogue shape: serialized cylinders carry 0 in
  // product_weight and the size lives in the category name.
  const ctx = contextFor(
    source(
      masters({
        products: [product({ product_weight: 0, weight: null, product_category: 60 })],
        categories: [category({ category_id: 60, category_name: "LPG 11KG" })],
      })
    )
  );
  assert.equal(resolveLineKg(10, 100, null, ctx).kg, 110);
  assert.equal(resolveSizeKg(100, ctx), 11);
});

test("parseCategorySizeKg accepts only an explicit kilogram figure", () => {
  assert.equal(parseCategorySizeKg("LPG 11KG"), 11);
  assert.equal(parseCategorySizeKg("LPG 1.4KG CTA - ECTA#149878"), 1.4);
  assert.equal(parseCategorySizeKg("LPG 50 KG"), 50);
  assert.equal(parseCategorySizeKg("LPG 12KGS"), 12);
  // No size, or a size outside a real cylinder, is reported rather than
  // invented by the caller.
  assert.equal(parseCategorySizeKg("LPG CYLINDER"), null);
  assert.equal(parseCategorySizeKg("LPG 0KG"), null);
  assert.equal(parseCategorySizeKg(""), null);
  assert.equal(parseCategorySizeKg(null), null);
});

test("cylinderProductScope requires a serialized product in an industrial category", () => {
  const ctx = contextFor(
    source(
      masters({
        products: [
          product({ product_id: 100, is_serialized: 1 }),
          product({ product_id: 101, is_serialized: 0 }),
          product({ product_id: 102, is_serialized: null }),
          product({ product_id: 103, is_serialized: true }),
          product({ product_id: 104, is_serialized: 1, product_category: 51 }),
          product({ product_id: 105, is_serialized: 1, product_category: null }),
          product({ product_id: 106, is_serialized: 1, product_category: 999 }),
        ],
        categories: [category(), category({ category_id: 51, is_industrial: 0 })],
      })
    )
  );
  assert.equal(cylinderProductScope(100, ctx), "included");
  assert.equal(cylinderProductScope(101, ctx), "excluded");
  assert.equal(cylinderProductScope(102, ctx), "excluded");
  assert.equal(cylinderProductScope(103, ctx), "included");
  assert.equal(cylinderProductScope(104, ctx), "excluded", "a non-industrial category is out of scope");
  assert.equal(cylinderProductScope(105, ctx), "missing_category");
  assert.equal(cylinderProductScope(106, ctx), "missing_category", "an unfetched category cannot prove eligibility");
  assert.equal(cylinderProductScope(999, ctx), "missing", "an unfetched master is unknowable, not excluded");
});

test("the category size is ignored when the product is not serialized", () => {
  const ctx = contextFor(
    source(
      masters({
        products: [
          product({
            product_weight: 0,
            weight: null,
            product_category: 60,
            is_serialized: 0,
          }),
        ],
        categories: [category({ category_id: 60, category_name: "LPG 11KG" })],
      })
    )
  );
  assert.equal(resolveSizeKg(100, ctx), null);
  assert.equal(resolveLineKg(3, 100, null, ctx).kg, 0);
  assert.equal(resolveLineKg(3, 100, null, ctx).exception, "MISSING_PRODUCT_WEIGHT");
});

test("the category size is ignored when the category is not industrial", () => {
  const ctx = contextFor(
    source(
      masters({
        products: [product({ product_weight: 0, weight: null, product_category: 60 })],
        categories: [
          category({ category_id: 60, category_name: "LPG 11KG", is_industrial: 0 }),
        ],
      })
    )
  );
  assert.equal(resolveSizeKg(100, ctx), null);
  assert.equal(resolveLineKg(3, 100, null, ctx).kg, 0);
});

test("resolveSizeKg returns null rather than a zero size", () => {
  const ctx = contextFor(
    source(masters({ products: [product({ product_weight: null, weight: null })] }))
  );
  assert.equal(resolveSizeKg(100, ctx), null);
  assert.equal(resolveSizeKg(999, ctx), null);
});

test("resolveGasType is provisional and null when the category is absent", () => {
  assert.equal(resolveGasType(100, contextFor()), "LPG");
  const noCategories = contextFor(source(masters({ categories: [] })));
  assert.equal(resolveGasType(100, noCategories), null);

  const unnamed = contextFor(source(masters({ categories: [category({ category_name: null })] })));
  assert.equal(resolveGasType(100, unnamed), null);
});

test("accumulateMonth keeps row totals equal to the sum of its buckets", () => {
  const acc = createAccumulator("C-001", 10, "CYLINDER", 100);
  accumulateMonth(acc, "2026-01-10", { orderKey: "SO:A", qty: 10, kg: 120 });
  accumulateMonth(acc, "2026-02-20", { orderKey: "SO:A", qty: 5, kg: 60 });
  accumulateMonth(acc, "2026-01-22", { returnedQty: 2, returnedKg: 24 });

  assert.equal(acc.grossQty, 15);
  assert.equal(acc.grossKg, 180);
  assert.equal(acc.returnedQty, 2);
  assert.equal(acc.returnedKg, 24);
  // One sales order split across two months is still one buying event.
  assert.equal(acc.orderKeys.size, 1);

  const points = [...acc.months.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  assert.deepEqual(points.map((point) => point.yearMonth), ["2026-01", "2026-02"]);
  assert.equal(
    points.reduce((sum, point) => sum + point.grossKg, 0),
    acc.grossKg
  );
  assert.deepEqual(
    points.map((point) => point.orderCount),
    [1, 1],
    "each month credits the event that moved inside it"
  );
  assert.deepEqual(
    points.map((point) => point.orderKeys),
    [["SO:A"], ["SO:A"]],
    "the key is carried so a report-level rollup can dedupe it"
  );

  // netKg is derived at freeze time, not while the bucket is still open.
  const frozen = finalizeRow(acc, contextFor());
  assert.deepEqual(
    frozen.monthlyTrend.map((point) => point.netKg),
    [96, 60]
  );
  assert.equal(frozen.orderCount, 1, "two buckets, one buying event");
});

test("accumulateMonth still totals an unparseable date without a bucket", () => {
  const acc = createAccumulator("C-001", 10, "CYLINDER", 100);
  accumulateMonth(acc, null, { qty: 4, kg: 48 });
  assert.equal(acc.grossQty, 4);
  assert.equal(acc.months.size, 0);
});

test("ensureAccumulator separates the channels at one customer grain", () => {
  const index = newIndex();
  const first = ensureAccumulator(index, grain());
  const again = ensureAccumulator(index, grain());
  const lpg = ensureAccumulator(index, grain("LPG"));

  assert.equal(first, again);
  assert.notEqual(first, lpg);
  assert.equal(index.size, 2);
});

test("finalizeRow derives nets, averages and the kg basis label", () => {
  const ctx = contextFor();
  const acc = ensureAccumulator(newIndex(), grain());
  accumulateMonth(acc, "2026-01-10", { orderKey: "SO:A", qty: 10, kg: 120 });
  accumulateMonth(acc, "2026-01-22", { returnedQty: 2, returnedKg: 24 });

  const row = finalizeRow(acc, ctx);
  assert.equal(row.netQty, 8);
  assert.equal(row.netKg, 96);
  assert.equal(row.orderCount, 1);
  assert.equal(row.avgOrderSizeKg, 96);
  assert.equal(row.kgIsProxy, true, "cylinder kg is always an inferred proxy");
  assert.equal(row.branchName, "Manila");
  assert.equal(row.classificationName, "Commercial");
  assert.equal(row.gasType, "LPG");
  assert.equal(row.sizeKg, 12);
  assert.deepEqual(
    row.monthlyTrend.map((point) => point.netKg),
    [96]
  );
});

test("finalizeRow labels an unattributable LPG row honestly", () => {
  const ctx = contextFor();
  const acc = ensureAccumulator(newIndex(), grain("LPG", 0, null));
  accumulateMonth(acc, "2026-01-10", { orderKey: "LPG:1", qty: 100, kg: 100 });

  const row = finalizeRow(acc, ctx);
  assert.equal(row.kgIsProxy, false, "LPG kg is measured, not inferred");
  assert.equal(row.branchName, "Unassigned");
  assert.equal(row.productName, "Site supply");
  assert.equal(row.sizeKg, null);
});

test("buildOverview never adds the two kg bases together", () => {
  const ctx = contextFor();
  const index = newIndex();
  accumulateMonth(
    ensureAccumulator(index, grain()),
    "2026-01-10",
    { orderKey: "SO:A", qty: 10, kg: 120 }
  );
  accumulateMonth(
    ensureAccumulator(index, grain("LPG", 0)),
    "2026-01-12",
    { orderKey: "LPG:1", qty: 500, kg: 500 }
  );

  const overview = buildOverview([...index.values()].map((acc) => finalizeRow(acc, ctx)), []);

  // A single combined kg figure would be meaningless, so none is exposed.
  assert.equal(overview.cylinder.netKg, 120);
  assert.equal(overview.lpg.netKg, 500);
  assert.equal("totalKg" in overview, false);
  assert.equal(overview.totalCustomers, 1, "one customer buying both is counted once");
  assert.equal(overview.totalOrders, 2);
  assert.equal(overview.cylinder.customers, 1);
  assert.equal(overview.lpg.customers, 1);
});

test("buildOverview rates returns on the gross basis", () => {
  const ctx = contextFor();
  const acc = ensureAccumulator(newIndex(), grain());
  accumulateMonth(acc, "2026-01-10", { orderKey: "SO:A", qty: 10, kg: 120 });
  accumulateMonth(acc, "2026-01-22", { returnedQty: 1, returnedKg: 12 });

  const overview = buildOverview([finalizeRow(acc, ctx)], []);
  assert.equal(overview.cylinder.returnRatePct, 10);
  assert.equal(overview.exceptionCount, 0);
});

test("buildOverallTrend keeps a separate series per channel", () => {
  const ctx = contextFor();
  const index = newIndex();
  accumulateMonth(
    ensureAccumulator(index, grain("CYLINDER", 100, 10, "C-001")),
    "2026-02-01",
    { orderKey: "SO:1", qty: 1, kg: 12 }
  );
  accumulateMonth(
    ensureAccumulator(index, grain("CYLINDER", 100, 10, "C-002")),
    "2026-01-05",
    { orderKey: "SO:2", qty: 2, kg: 24 }
  );
  accumulateMonth(
    ensureAccumulator(index, grain("LPG", 0, 10, "C-001")),
    "2026-01-06",
    { orderKey: "LPG:1", qty: 50, kg: 50 }
  );

  const trend = buildOverallTrend([...index.values()].map((acc) => finalizeRow(acc, ctx)));
  assert.deepEqual(
    trend.map((point) => `${point.yearMonth}/${point.channel}`),
    ["2026-01/CYLINDER", "2026-01/LPG", "2026-02/CYLINDER"]
  );
  assert.equal(trend[0]?.grossKg, 24);
  assert.equal(trend[1]?.grossKg, 50, "january kg is not merged across channels");
});

test("isRejected covers every non-sale document state", () => {
  assert.equal(isRejected("cancelled"), true);
  assert.equal(isRejected("VOIDED"), true);
  assert.equal(isRejected("Rejected"), true);
  assert.equal(isRejected("posted", 1), true);
  assert.equal(isRejected("posted", false), false);
  assert.equal(isRejected("posted", null), false);
  assert.equal(isRejected("posted"), false);
});

test("withinWindow is inclusive at both ends and rejects undated rows", () => {
  const range = filters();
  assert.equal(withinWindow("2026-01-01", range.startDate, range.endDate), true);
  assert.equal(withinWindow("2026-01-31T23:00:00", range.startDate, range.endDate), true);
  assert.equal(withinWindow("2026-02-01", range.startDate, range.endDate), false);
  assert.equal(withinWindow(null, range.startDate, range.endDate), false);
});
