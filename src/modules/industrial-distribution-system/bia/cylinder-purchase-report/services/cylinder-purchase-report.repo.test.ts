import assert from "node:assert/strict";
import test from "node:test";

import type { CylinderPurchaseReportFilters } from "../types/cylinder-purchase-report.types";
import {
  UpstreamContractError,
  UpstreamHttpError,
} from "./cylinder-purchase-report.errors";
import { fetchCylinderPurchaseRows } from "./cylinder-purchase-report.repo";

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

test("classifies malformed JSON from a successful Spring response as a contract error", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("{", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(
    () =>
      fetchCylinderPurchaseRows(filters, {
        fetchImpl,
        springBaseUrl: "http://spring.test",
      }),
    (error: unknown) => error instanceof UpstreamContractError,
  );
});

test("wraps a rejected Spring response body stream as an upstream HTTP error", async () => {
  const bodyError = new TypeError("private upstream body stream failed");
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
      fetchCylinderPurchaseRows(filters, {
        fetchImpl,
        springBaseUrl: "http://spring.test",
      }),
    (error: unknown) =>
      error instanceof UpstreamHttpError &&
      error.status === null &&
      error.cause === bodyError,
  );
});

test("preserves an abort from the Spring response body stream unchanged", async () => {
  const abortError = new DOMException("Response body aborted", "AbortError");
  const fetchImpl: typeof fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(abortError);
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  await assert.rejects(
    () =>
      fetchCylinderPurchaseRows(filters, {
        fetchImpl,
        springBaseUrl: "http://spring.test",
      }),
    (error: unknown) => error === abortError,
  );
});
