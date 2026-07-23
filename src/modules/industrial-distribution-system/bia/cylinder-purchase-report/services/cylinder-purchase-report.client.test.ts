import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchCylinderPurchaseDashboard,
  fetchReportLookups,
} from "./cylinder-purchase-report.client.ts";
import type {
  AppliedFilterContext,
  CylinderPurchaseDashboardResponse,
} from "../types/cylinder-purchase-report.types.ts";

const filters: AppliedFilterContext = {
  customerCode: "C-001",
  customerLabel: "Alpha Store (C-001)",
  productId: 7,
  productLabel: "LPG 11KG (LPG-11)",
  startDate: "2026-06-23",
  endDate: "2026-07-22",
};

const dashboard: CylinderPurchaseDashboardResponse = {
  filters,
  generatedAt: "2026-07-22T10:00:00.000Z",
  sourceRowCount: 1,
  overview: {
    grossPurchasedQty: 10,
    returnedQty: 1,
    netPurchasedQty: 9,
    uniqueCustomers: 1,
    serializedProducts: 1,
  },
  customerRanking: [],
  productPerformance: [],
  returnAnalysis: {
    overall: { grossPurchasedQty: 10, returnedQty: 1, netPurchasedQty: 9, returnRate: 10 },
    byCustomer: [],
    byProduct: [],
    byBranch: [],
    bySalesperson: [],
  },
  branchPerformance: [],
  salespersonPerformance: [],
};

test("serializes defined dashboard filters and forwards the abort signal", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const controller = new AbortController();
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return Response.json(dashboard);
  };

  try {
    assert.deepEqual(
      await fetchCylinderPurchaseDashboard({ ...filters, branchId: undefined }, controller.signal),
      dashboard,
    );
    assert.equal(
      requestedUrl,
      "/api/ids/bia/cylinder-purchase-report?customerCode=C-001&customerLabel=Alpha+Store+%28C-001%29&productId=7&productLabel=LPG+11KG+%28LPG-11%29&startDate=2026-06-23&endDate=2026-07-22",
    );
    assert.equal(requestedInit?.cache, "no-store");
    assert.equal(requestedInit?.signal, controller.signal);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns actionable dashboard errors and lookup data", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    if (requestedUrls.length === 1) {
      return Response.json({ message: "Date range is invalid." }, { status: 400 });
    }
    return Response.json({ data: [{ value: "7", label: "LPG 11KG", code: "LPG-11" }] });
  };

  try {
    await assert.rejects(
      () => fetchCylinderPurchaseDashboard(filters),
      new Error("Date range is invalid."),
    );
    assert.deepEqual(await fetchReportLookups("products", "LPG & 11"), [
      { value: "7", label: "LPG 11KG", code: "LPG-11" },
    ]);
    assert.equal(
      requestedUrls[1],
      "/api/ids/bia/cylinder-purchase-report/lookups?type=products&q=LPG+%26+11",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
