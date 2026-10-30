import assert from "node:assert/strict";
import test from "node:test";

import {
  customerOrderConsumptionDetailSchema,
  customerOrderConsumptionFilterSchema,
  readFilterParams,
  readLabelList,
  reportLookupQuerySchema,
} from "./customer-order-consumption.schema";

const valid = { startDate: "2026-01-01", endDate: "2026-01-31" };

test("accepts the minimal period-only query", () => {
  const parsed = customerOrderConsumptionFilterSchema.parse(valid);
  assert.deepEqual(parsed, { startDate: "2026-01-01", endDate: "2026-01-31" });
});

test("coerces the numeric filters that arrive as query strings", () => {
  const parsed = customerOrderConsumptionFilterSchema.parse({
    ...valid,
    branchIds: ["10", "11"],
    salesmanIds: ["5"],
    classificationIds: ["70"],
    channel: "LPG",
    customerCodes: ["C-001", "C-002"],
  });

  assert.deepEqual(parsed.branchIds, [10, 11]);
  assert.deepEqual(parsed.salesmanIds, [5]);
  assert.deepEqual(parsed.classificationIds, [70]);
  assert.equal(parsed.channel, "LPG");
  assert.deepEqual(parsed.customerCodes, ["C-001", "C-002"]);
});

test("an empty selection list means no cut, not nothing matches", () => {
  for (const key of [
    "customerCodes",
    "branchIds",
    "salesmanIds",
    "classificationIds",
  ] as const) {
    const parsed = customerOrderConsumptionFilterSchema.safeParse({ ...valid, [key]: [] });
    assert.equal(parsed.success, true, key);
    assert.deepEqual(parsed.success && parsed.data[key], [], key);
  }
});

test("trims codes inside a selection so a pasted list still matches", () => {
  const parsed = customerOrderConsumptionFilterSchema.parse({
    ...valid,
    customerCodes: ["  C-001  "],
  });
  assert.deepEqual(parsed.customerCodes, ["C-001"]);
});

test("rejects anything that is not a plain ISO date", () => {
  for (const startDate of ["2026-1-1", "01/01/2026", "2026-01-01T00:00:00", ""]) {
    assert.equal(
      customerOrderConsumptionFilterSchema.safeParse({ ...valid, startDate }).success,
      false,
      startDate
    );
  }
});

test("rejects an inverted window instead of returning silent zeros", () => {
  const result = customerOrderConsumptionFilterSchema.safeParse({
    startDate: "2026-02-01",
    endDate: "2026-01-31",
  });

  assert.equal(result.success, false);
  const issue = result.error.issues[0];
  assert.equal(issue?.path[0], "startDate", "the error is placed on the field the user must fix");
  assert.equal(issue?.message, "startDate must not be after endDate");
});

test("a same-day window is valid", () => {
  assert.equal(
    customerOrderConsumptionFilterSchema.safeParse({ startDate: "2026-01-31", endDate: "2026-01-31" }).success,
    true
  );
});

test("rejects an unknown channel and a bad id inside a selection", () => {
  assert.equal(customerOrderConsumptionFilterSchema.safeParse({ ...valid, channel: "BULK" }).success, false);
  assert.equal(
    customerOrderConsumptionFilterSchema.safeParse({ ...valid, branchIds: [10, 0] }).success,
    false,
    "one bad id fails the whole list rather than being quietly dropped"
  );
  assert.equal(customerOrderConsumptionFilterSchema.safeParse({ ...valid, branchIds: [-3] }).success, false);
  assert.equal(
    customerOrderConsumptionFilterSchema.safeParse({ ...valid, customerCodes: [""] }).success,
    false,
    "an empty code would filter to nothing rather than to everybody"
  );
});

test("caps a selection so the query stays a readable URL", () => {
  const ids = Array.from({ length: 51 }, (_, index) => index + 1);
  const result = customerOrderConsumptionFilterSchema.safeParse({ ...valid, branchIds: ids });
  assert.equal(result.success, false);
  assert.equal(result.error.issues[0]?.message, "At most 50 can be selected at once");
});

test("repeated query keys become lists, everything else stays single", () => {
  const params = new URLSearchParams([
    ["startDate", "2026-01-01"],
    ["endDate", "2026-01-31"],
    ["branchIds", "10"],
    ["branchIds", "11"],
    ["customerCodes", "C-001"],
  ]);

  const raw = readFilterParams(params);
  assert.deepEqual(raw.branchIds, ["10", "11"]);
  assert.deepEqual(raw.customerCodes, ["C-001"]);
  assert.equal(raw.channel, undefined);
  assert.equal(raw.startDate, "2026-01-01", "a single-valued key is not wrapped in an array");
});

test("display labels are read as a capped, trimmed list", () => {
  const params = new URLSearchParams([
    ["branchLabels", " Manila (MNL) "],
    ["branchLabels", ""],
    ["branchLabels", "Cebu (CEB)"],
  ]);
  assert.deepEqual(readLabelList(params, "branchLabels"), ["Manila (MNL)", "Cebu (CEB)"]);

  const padded = new URLSearchParams(
    Array.from({ length: 60 }, (_, index): [string, string] => ["branchLabels", `B${index}`])
  );
  assert.equal(readLabelList(padded, "branchLabels").length, 50);
  assert.deepEqual(readLabelList(new URLSearchParams(), "branchLabels"), []);
});

test("the drill-down requires a customer but keeps the period rules", () => {
  assert.equal(customerOrderConsumptionDetailSchema.safeParse({ ...valid }).success, false);
  assert.equal(
    customerOrderConsumptionDetailSchema.safeParse({ ...valid, customerDetail: "  " }).success,
    false
  );

  const parsed = customerOrderConsumptionDetailSchema.safeParse({
    ...valid,
    customerDetail: "  C-001  ",
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.customerDetail, "C-001", "padded codes are trimmed");

  // The refinement survives .extend(), or a drill-down could invert the window.
  assert.equal(
    customerOrderConsumptionDetailSchema.safeParse({
      startDate: "2026-03-01",
      endDate: "2026-01-31",
      customerDetail: "C-001",
    }).success,
    false
  );
});

test("lookup types are whitelisted so no collection name can be injected", () => {
  for (const type of ["customers", "branches", "salesmen", "classifications"]) {
    assert.equal(reportLookupQuerySchema.safeParse({ type }).success, true, type);
  }

  for (const type of ["directus_users", "token", "", "CUSTOMERS"]) {
    assert.equal(reportLookupQuerySchema.safeParse({ type }).success, false, type);
  }

  assert.equal(reportLookupQuerySchema.safeParse({ type: "customers", q: "al" }).success, true);
  assert.equal(
    reportLookupQuerySchema.safeParse({ type: "customers", q: "x".repeat(101) }).success,
    false,
    "a runaway typeahead string is refused before it reaches Directus"
  );
});
