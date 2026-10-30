import assert from "node:assert/strict";
import test from "node:test";

import { requestCustomerOrderConsumptionReport } from "../api/customer-order-consumption.client";
import {
  customerOrderConsumptionFilterSchema,
  readFilterParams,
} from "../types/customer-order-consumption.schema";
import type { AppliedFilterContext } from "../types/customer-order-consumption.types";

/** Captures the URL the client builds, then answers with an empty report. */
function captureUrl(): { url: () => string; stop: () => void } {
  let captured = "";
  const original = globalThis.fetch;
  globalThis.fetch = (input: unknown) => {
    captured = String(input);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as unknown as Response);
  };
  return {
    url: () => captured,
    stop: () => {
      globalThis.fetch = original;
    },
  };
}

test("a multi-select is sent as the same key repeated", async () => {
  const harness = captureUrl();
  const filters: AppliedFilterContext = {
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    branchIds: [10, 11],
    customerCodes: ["C-001", "C-002"],
    salesmanIds: [],
    branchLabels: ["Manila (MNL)", "Cebu (CEB)"],
    customerLabels: ["Alpha Foods (C-001)", "Beta Mills (C-002)"],
  };

  try {
    await requestCustomerOrderConsumptionReport(filters);
  } finally {
    harness.stop();
  }

  const params = new URLSearchParams(harness.url().split("?")[1] ?? "");
  assert.deepEqual(params.getAll("branchIds"), ["10", "11"]);
  assert.deepEqual(params.getAll("customerCodes"), ["C-001", "C-002"]);
  assert.deepEqual(params.getAll("branchLabels"), ["Manila (MNL)", "Cebu (CEB)"]);
  assert.equal(
    params.has("salesmanIds"),
    false,
    "an empty selection must not appear in the request at all"
  );
});

test("what the client sends is what the route parses back", async () => {
  const harness = captureUrl();
  try {
    await requestCustomerOrderConsumptionReport(
      {
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        branchIds: [10, 11],
        classificationIds: [70],
        channel: "LPG",
      },
      AbortSignal.timeout(5000)
    );
  } finally {
    harness.stop();
  }

  const params = new URLSearchParams(harness.url().split("?")[1] ?? "");
  const parsed = customerOrderConsumptionFilterSchema.parse(readFilterParams(params));
  assert.deepEqual(parsed.branchIds, [10, 11], "query strings are coerced back to ids");
  assert.deepEqual(parsed.classificationIds, [70]);
  assert.equal(parsed.channel, "LPG");
});
