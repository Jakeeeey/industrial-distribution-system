import assert from "node:assert/strict";
import test from "node:test";

import {
  UpstreamContractError,
  UpstreamHttpError,
} from "./cylinder-purchase-report.errors.ts";
import { getCylinderPurchaseDashboard } from "./cylinder-purchase-report.service.ts";
import type {
  AppliedFilterContext,
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

  const appliedFilters: AppliedFilterContext = {
    ...filters,
    branchId: 196,
    branchLabel: "Main Branch (B196)",
  };
  const report = await getCylinderPurchaseDashboard(
    appliedFilters,
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
  assert.deepEqual(report.filters, appliedFilters);
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

test("propagates a classified Spring transport error without exposing fetch details", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError("getaddrinfo ENOTFOUND private-spring.internal");
  };

  await assert.rejects(
    () =>
      getCylinderPurchaseDashboard(filters, {
        fetchImpl,
        now: fixedNow,
        springBaseUrl: "http://spring.test",
      }),
    (error: unknown) =>
      error instanceof UpstreamHttpError &&
      !error.message.includes("private-spring.internal"),
  );
});

test("propagates malformed Spring JSON as an upstream contract error", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("{", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

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

test("propagates a rejected Spring body stream as an upstream HTTP error", async () => {
  const bodyError = new TypeError("private response stream failure");
  const fetchImpl: typeof fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(bodyError);
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  await assert.rejects(
    () =>
      getCylinderPurchaseDashboard(filters, {
        fetchImpl,
        now: fixedNow,
        springBaseUrl: "http://spring.test",
      }),
    (error: unknown) =>
      error instanceof UpstreamHttpError && error.cause === bodyError,
  );
});
