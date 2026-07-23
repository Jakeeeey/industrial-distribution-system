import assert from "node:assert/strict";
import test from "node:test";

import type { CylinderPurchaseReportFilters } from "../types/cylinder-purchase-report.types.ts";
import { UpstreamHttpError } from "./cylinder-purchase-report.errors.ts";
import { fetchCylinderPurchaseRows } from "./cylinder-purchase-report.repo.ts";

const filters: CylinderPurchaseReportFilters = {
  startDate: "2026-06-23",
  endDate: "2026-07-22",
};

test("wraps non-abort Spring transport rejections as upstream HTTP errors", async () => {
  const transportError = new TypeError("fetch failed", {
    cause: { code: "ECONNREFUSED" },
  });
  const fetchImpl: typeof fetch = async () => {
    throw transportError;
  };

  await assert.rejects(
    () =>
      fetchCylinderPurchaseRows(filters, {
        fetchImpl,
        springBaseUrl: "http://spring.test",
      }),
    (error: unknown) =>
      error instanceof UpstreamHttpError &&
      error.status === null &&
      error.cause === transportError,
  );
});

test("preserves an abort rejection unchanged for timeout classification", async () => {
  const abortError = new DOMException("Request aborted", "AbortError");
  const fetchImpl: typeof fetch = async () => {
    throw abortError;
  };

  await assert.rejects(
    () =>
      fetchCylinderPurchaseRows(filters, {
        fetchImpl,
        springBaseUrl: "http://spring.test",
      }),
    (error: unknown) => error === abortError,
  );
});
