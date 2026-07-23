import assert from "node:assert/strict";
import test from "node:test";

import type { ReturnAnalysisDataset } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

import {
  formatReturnRate,
  getReturnAnalysisRows,
  rankReportRows,
} from "./analytical-view.utils.ts";

test("assigns ranks without changing the payload order or source array", () => {
  const rows = [{ name: "Alpha" }, { name: "Beta" }];

  const ranked = rankReportRows(rows);

  assert.deepEqual(
    ranked.map(({ rank, data }) => [rank, data.name]),
    [
      [1, "Alpha"],
      [2, "Beta"],
    ],
  );
  assert.deepEqual(rows, [{ name: "Alpha" }, { name: "Beta" }]);
  assert.notEqual(ranked, rows);
});

test("formats zero-gross and non-finite return rates as zero percent", () => {
  assert.equal(formatReturnRate(Number.NaN, 0), "0%");
  assert.equal(formatReturnRate(Number.POSITIVE_INFINITY, 0), "0%");
});

test("selects every return-analysis grouping from the aggregated response", () => {
  const item = (key: string) => ({
    key,
    code: key.toUpperCase(),
    label: key,
    grossPurchasedQty: 10,
    returnedQty: 2,
    netPurchasedQty: 8,
    returnRate: 0.2,
  });
  const dataset: ReturnAnalysisDataset = {
    overall: {
      grossPurchasedQty: 40,
      returnedQty: 8,
      netPurchasedQty: 32,
      returnRate: 0.2,
    },
    byCustomer: [item("customer")],
    byProduct: [item("product")],
    byBranch: [item("branch")],
    bySalesperson: [item("salesperson")],
  };

  assert.equal(getReturnAnalysisRows(dataset, "customer")[0]?.key, "customer");
  assert.equal(getReturnAnalysisRows(dataset, "product")[0]?.key, "product");
  assert.equal(getReturnAnalysisRows(dataset, "branch")[0]?.key, "branch");
  assert.equal(
    getReturnAnalysisRows(dataset, "salesperson")[0]?.key,
    "salesperson",
  );
});
