import assert from "node:assert/strict";
import test from "node:test";

import { UpstreamContractError } from "./cylinder-purchase-report.errors.ts";
import { getCylinderPurchaseDashboard } from "./cylinder-purchase-report.service.ts";
import type {
  CylinderPurchaseReportFilters,
  CylinderPurchaseRow,
} from "../types/cylinder-purchase-report.types.ts";

const filters: CylinderPurchaseReportFilters = {
  startDate: "2026-06-23",
  endDate: "2026-07-22",
};

const fixedNow = (): Date => new Date("2026-07-22T10:00:00.000Z");

const validRow: CylinderPurchaseRow = {
  customerCode: "C-001",
  customerName: "Alpha Store",
  invoiceDate: "2026-07-01",
  productId: 11,
  productCode: "LPG-11",
  productName: "LPG 11KG",
  branchId: 196,
  branchCode: "B196",
  branchName: "Main",
  salesmanId: 7,
  salesmanCode: "S07",
  salesmanName: "Ana",
  grossPurchasedQty: 10,
  returnedQty: 2,
  netPurchasedQty: 8,
};

test("forwards only defined Spring filters", async () => {
  let requested = "";
  const fetchImpl: typeof fetch = async (input) => {
    requested = String(input);
    return Response.json([validRow]);
  };

  await getCylinderPurchaseDashboard(
    { ...filters, branchId: 196 },
    {
      fetchImpl,
      now: fixedNow,
      springBaseUrl: "http://spring.test",
    },
  );

  assert.equal(
    requested,
    "http://spring.test/api/v-bia-cylinder-purchases/filter?branchId=196&startDate=2026-06-23&endDate=2026-07-22",
  );
});

test("rejects an inconsistent upstream net quantity", async () => {
  const fetchImpl: typeof fetch = async () =>
    Response.json([{ ...validRow, netPurchasedQty: 999 }]);

  await assert.rejects(
    () =>
      getCylinderPurchaseDashboard(filters, {
        fetchImpl,
        now: fixedNow,
        springBaseUrl: "http://spring.test",
      }),
    (error: unknown) => error instanceof UpstreamContractError,
  );
});
