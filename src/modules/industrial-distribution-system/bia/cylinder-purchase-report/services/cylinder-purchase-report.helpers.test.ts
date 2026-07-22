import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateCylinderPurchases,
  getRollingThirtyDayRange,
} from "./cylinder-purchase-report.helpers.ts";
import {
  cylinderPurchaseFilterSchema,
  cylinderPurchaseRowsSchema,
} from "../types/cylinder-purchase-report.schema.ts";
import type { CylinderPurchaseRow } from "../types/cylinder-purchase-report.types.ts";

const row = (patch: Partial<CylinderPurchaseRow> = {}): CylinderPurchaseRow => ({
  customerCode: "C-001",
  customerName: "Alpha Store",
  invoiceDate: "2026-07-01",
  productId: 11,
  productCode: "LPG-11",
  productName: "LPG 11KG",
  branchId: 1,
  branchCode: "B01",
  branchName: "Main",
  salesmanId: 7,
  salesmanCode: "S07",
  salesmanName: "Ana",
  grossPurchasedQty: 10,
  returnedQty: 2,
  netPurchasedQty: 8,
  ...patch,
});

test("rolling range contains exactly 30 inclusive dates", () => {
  assert.deepEqual(
    getRollingThirtyDayRange(new Date("2026-07-22T08:00:00+08:00")),
    {
      startDate: "2026-06-23",
      endDate: "2026-07-22",
    },
  );
});

test("one pass aggregation reconciles all compatible views", () => {
  const rows = [
    row(),
    row({
      productId: 50,
      productCode: "LPG-50",
      productName: "LPG 50KG",
      grossPurchasedQty: 4,
      returnedQty: 0,
      netPurchasedQty: 4,
    }),
    row({
      customerCode: null,
      customerName: null,
      grossPurchasedQty: 1,
      returnedQty: 0,
      netPurchasedQty: 1,
    }),
    row({
      customerCode: null,
      customerName: null,
      productId: 50,
      productCode: "LPG-50",
      productName: "LPG 50KG",
      grossPurchasedQty: 0,
      returnedQty: 3,
      netPurchasedQty: -3,
    }),
  ];
  const result = aggregateCylinderPurchases(
    rows,
    { startDate: "2026-07-01", endDate: "2026-07-22" },
    "2026-07-22T10:00:00.000Z",
  );

  assert.deepEqual(result.overview, {
    grossPurchasedQty: 15,
    returnedQty: 5,
    netPurchasedQty: 10,
    uniqueCustomers: 2,
    serializedProducts: 2,
  });
  assert.equal(result.customerRanking[0].customerCode, "C-001");
  assert.equal(result.customerRanking[1].customerKey, "UNASSIGNED");
  assert.equal(result.customerRanking[1].customerName, "Unassigned Customer");
  assert.equal(result.customerRanking[1].netPurchasedQty, -2);
  assert.equal(result.returnAnalysis.overall.returnRate, 5 / 15);
  assert.equal(
    result.customerRanking.reduce((sum, item) => sum + item.netPurchasedQty, 0),
    result.overview.netPurchasedQty,
  );
  assert.equal(
    result.productPerformance.reduce((sum, item) => sum + item.netPurchasedQty, 0),
    result.overview.netPurchasedQty,
  );
  assert.equal(
    result.branchPerformance.reduce((sum, item) => sum + item.netPurchasedQty, 0),
    result.overview.netPurchasedQty,
  );
  assert.equal(
    result.salespersonPerformance.reduce(
      (sum, item) => sum + item.netPurchasedQty,
      0,
    ),
    result.overview.netPurchasedQty,
  );
});

test("zero gross produces a zero return ratio", () => {
  const result = aggregateCylinderPurchases(
    [row({ grossPurchasedQty: 0, returnedQty: 2, netPurchasedQty: -2 })],
    { startDate: "2026-07-01", endDate: "2026-07-22" },
    "2026-07-22T10:00:00.000Z",
  );

  assert.equal(result.returnAnalysis.overall.returnRate, 0);
});

test("equal product rankings use ascending numeric identity as a stable tie-breaker", () => {
  const result = aggregateCylinderPurchases(
    [
      row({
        productId: 10,
        productCode: "LPG-10",
        productName: "Same Product",
        grossPurchasedQty: 1,
        returnedQty: 0,
        netPurchasedQty: 1,
      }),
      row({
        productId: 2,
        productCode: "LPG-02",
        productName: "Same Product",
        grossPurchasedQty: 1,
        returnedQty: 0,
        netPurchasedQty: 1,
      }),
    ],
    { startDate: "2026-07-01", endDate: "2026-07-22" },
    "2026-07-22T10:00:00.000Z",
  );

  assert.deepEqual(
    result.productPerformance.map((product) => product.productId),
    [2, 10],
  );
});

test("filter validation rejects inverted and invalid filter values", () => {
  assert.equal(
    cylinderPurchaseFilterSchema.safeParse({
      productId: "2",
      startDate: "2026-07-01",
      endDate: "2026-07-22",
    }).success,
    true,
  );
  assert.equal(
    cylinderPurchaseFilterSchema.safeParse({
      startDate: "2026-07-23",
      endDate: "2026-07-22",
    }).success,
    false,
  );
  assert.equal(
    cylinderPurchaseFilterSchema.safeParse({
      productId: 0,
      startDate: "2026-07-01",
      endDate: "2026-07-22",
    }).success,
    false,
  );
});

test("row validation preserves finite quantity and date constraints", () => {
  assert.equal(cylinderPurchaseRowsSchema.safeParse([row()]).success, true);
  assert.equal(
    cylinderPurchaseRowsSchema.safeParse([
      row({ grossPurchasedQty: Number.POSITIVE_INFINITY }),
    ]).success,
    false,
  );
  assert.equal(
    cylinderPurchaseRowsSchema.safeParse([row({ invoiceDate: "July 1" })])
      .success,
    false,
  );
});
