import assert from "node:assert/strict";
import test from "node:test";

import {
  cylinderPurchaseFilterSchema,
  reportLookupQuerySchema,
} from "./cylinder-purchase-report.schema";

test("defaults a valid lookup query search term to an empty string", () => {
  assert.deepEqual(reportLookupQuerySchema.parse({ type: "branches" }), {
    type: "branches",
    q: "",
  });
});

test("rejects unsupported lookup types and oversized search terms", () => {
  assert.equal(reportLookupQuerySchema.safeParse({ type: "unknown" }).success, false);
  assert.equal(reportLookupQuerySchema.safeParse({ type: "customers", q: "x".repeat(101) }).success, false);
});

test("preserves selected lookup labels only when their stable filter is present", () => {
  const valid = cylinderPurchaseFilterSchema.parse({
    customerCode: "C-001",
    customerLabel: "Alpha Store (C-001)",
    productId: "11",
    productLabel: "LPG 11KG (LPG-11)",
    branchId: "1",
    branchLabel: "Main Branch (B01)",
    salesmanId: "7",
    salespersonLabel: "Ana (S07)",
    startDate: "2026-06-23",
    endDate: "2026-07-22",
  });

  assert.equal(valid.customerLabel, "Alpha Store (C-001)");
  assert.equal(valid.productLabel, "LPG 11KG (LPG-11)");
  assert.equal(valid.branchLabel, "Main Branch (B01)");
  assert.equal(valid.salespersonLabel, "Ana (S07)");
  assert.equal(
    cylinderPurchaseFilterSchema.safeParse({
      productLabel: "Orphan label",
      startDate: "2026-06-23",
      endDate: "2026-07-22",
    }).success,
    false,
  );
});
