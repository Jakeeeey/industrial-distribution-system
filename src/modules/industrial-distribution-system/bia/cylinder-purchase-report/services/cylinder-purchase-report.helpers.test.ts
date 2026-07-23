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

test("rolling range uses the caller local day near a +08:00 midnight", () => {
  assert.deepEqual(
    getRollingThirtyDayRange(new Date("2026-07-22T00:15:00+08:00")),
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
  const alphaCustomer = result.customerRanking[0];
  assert.equal(
    alphaCustomer.productBreakdown.reduce(
      (sum, item) => sum + item.netPurchasedQty,
      0,
    ),
    alphaCustomer.netPurchasedQty,
  );
  assert.equal(
    alphaCustomer.branchBreakdown.reduce(
      (sum, item) => sum + item.netPurchasedQty,
      0,
    ),
    alphaCustomer.netPurchasedQty,
  );
  assert.equal(
    alphaCustomer.salespersonBreakdown.reduce(
      (sum, item) => sum + item.netPurchasedQty,
      0,
    ),
    alphaCustomer.netPurchasedQty,
  );
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

test("salesperson details group customers, cylinders, and customer cylinder purchases", () => {
  const result = aggregateCylinderPurchases(
    [
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
        customerCode: "C-002",
        customerName: "Beta Store",
        grossPurchasedQty: 3,
        returnedQty: 0,
        netPurchasedQty: 3,
      }),
      row({
        customerCode: null,
        customerName: null,
        productId: 50,
        productCode: "LPG-50",
        productName: "LPG 50KG",
        grossPurchasedQty: 1,
        returnedQty: 1,
        netPurchasedQty: 0,
      }),
    ],
    { startDate: "2026-07-01", endDate: "2026-07-22" },
    "2026-07-22T10:00:00.000Z",
  );

  const salesperson = result.salespersonPerformance[0];
  assert.deepEqual(
    salesperson.customerBreakdown.map((item) => ({
      customerKey: item.customerKey,
      products: item.uniqueProducts,
      net: item.netPurchasedQty,
    })),
    [
      { customerKey: "C-001", products: 2, net: 12 },
      { customerKey: "C-002", products: 1, net: 3 },
      { customerKey: "UNASSIGNED", products: 1, net: 0 },
    ],
  );
  assert.equal(
    salesperson.customerBreakdown.at(-1)?.customerName,
    "Unassigned Customer",
  );
  assert.deepEqual(
    salesperson.productBreakdown.map((item) => item.productId),
    [11, 50],
  );
  assert.deepEqual(
    salesperson.customerProductBreakdown.map((item) => item.key),
    ["C-001::11", "C-001::50", "C-002::11", "UNASSIGNED::50"],
  );
  assert.equal(
    salesperson.customerBreakdown.reduce(
      (total, item) => total + item.netPurchasedQty,
      0,
    ),
    salesperson.netPurchasedQty,
  );
  assert.equal(
    salesperson.productBreakdown.reduce(
      (total, item) => total + item.netPurchasedQty,
      0,
    ),
    salesperson.netPurchasedQty,
  );
  assert.equal(
    salesperson.customerProductBreakdown.reduce(
      (total, item) => total + item.netPurchasedQty,
      0,
    ),
    salesperson.netPurchasedQty,
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

test("fractional quantities reconcile across every aggregate view", () => {
  const result = aggregateCylinderPurchases(
    [
      row({ grossPurchasedQty: 1.75, returnedQty: 0.25, netPurchasedQty: 1.5 }),
      row({
        productId: 50,
        productCode: "LPG-50",
        productName: "LPG 50KG",
        grossPurchasedQty: 0.5,
        returnedQty: 0.125,
        netPurchasedQty: 0.375,
      }),
    ],
    { startDate: "2026-07-01", endDate: "2026-07-22" },
    "2026-07-22T10:00:00.000Z",
  );

  assert.deepEqual(result.overview, {
    grossPurchasedQty: 2.25,
    returnedQty: 0.375,
    netPurchasedQty: 1.875,
    uniqueCustomers: 1,
    serializedProducts: 2,
  });
  for (const view of [
    result.customerRanking,
    result.productPerformance,
    result.branchPerformance,
    result.salespersonPerformance,
  ]) {
    assert.equal(
      view.reduce((sum, item) => sum + item.netPurchasedQty, 0),
      result.overview.netPurchasedQty,
    );
  }
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
