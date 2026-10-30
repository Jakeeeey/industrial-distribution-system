import assert from "node:assert/strict";
import test from "node:test";

import { buildContext, finalizeRow, type RowAccumulator } from "./customer-order-consumption.calc";
import { accumulateLpg } from "./customer-order-consumption.lpg-calc";
import {
  filters,
  invoice,
  lpgSite,
  masters,
  meterReading,
  source,
  unifiedLpg,
  wiwoDetail,
  wiwoHeader,
} from "./customer-order-consumption.test-fixtures";
import type {
  CustomerOrderConsumptionRow,
  RawInvoiceRow,
  RawLpgSiteRow,
  RawMeterReadingRow,
  RawUnifiedLpgRow,
  RawWiwoDetailRow,
  RawWiwoHeaderRow,
  ReportException,
  SupportingDocument,
} from "../types/customer-order-consumption.types";

interface RunInput {
  filters?: ReturnType<typeof filters>;
  unifiedLpg?: RawUnifiedLpgRow[];
  wiwoHeaders?: RawWiwoHeaderRow[];
  wiwoDetails?: RawWiwoDetailRow[];
  meterReadings?: RawMeterReadingRow[];
  invoices?: RawInvoiceRow[];
  lpgSites?: RawLpgSiteRow[];
  allowedCustomerCodes?: Set<string> | null;
  withDocuments?: boolean;
}

/** Runs the LPG pass only. The fixture site maps 200 -> C-001. */
function run(input: RunInput): {
  rows: CustomerOrderConsumptionRow[];
  exceptions: ReportException[];
  documents: SupportingDocument[];
} {
  const context = buildContext(
    source(masters({ lpgSites: input.lpgSites ?? [lpgSite()], invoices: input.invoices ?? [] }))
  );
  const accumulators = new Map<string, RowAccumulator>();
  const exceptions: ReportException[] = [];
  const documents: SupportingDocument[] = [];

  accumulateLpg({
    filters: input.filters ?? filters(),
    context,
    lpgSites: input.lpgSites ?? [lpgSite()],
    unifiedLpg: input.unifiedLpg ?? [],
    wiwoHeaders: input.wiwoHeaders ?? [],
    wiwoDetails: input.wiwoDetails ?? [],
    meterReadings: input.meterReadings ?? [],
    invoices: input.invoices ?? [],
    allowedCustomerCodes: input.allowedCustomerCodes ?? null,
    accumulators,
    exceptions,
    documents: input.withDocuments ? documents : undefined,
  });

  return {
    rows: [...accumulators.values()].map((acc) => finalizeRow(acc, context)),
    exceptions,
    documents,
  };
}

const only = (rows: CustomerOrderConsumptionRow[]): CustomerOrderConsumptionRow => {
  assert.equal(rows.length, 1, "expected exactly one row");
  return rows[0] as CustomerOrderConsumptionRow;
};

test("counts a posted unified row once, not three times", () => {
  // The same January supply exists in all three ledgers at once.
  const { rows } = run({
    unifiedLpg: [unifiedLpg({ meter_reading_id: 500, wiwo_header_id: 400, billable_kg: 100 })],
    wiwoHeaders: [wiwoHeader({ id: 400, total_billable_kg: 80 })],
    wiwoDetails: [],
    meterReadings: [meterReading({ id: 500, kg_consumed: 60 })],
    invoices: [invoice()],
  });

  const row = only(rows);
  assert.equal(row.grossKg, 100, "metered 60 + weighed 80 must not stack on the billed 100");
  assert.equal(row.orderCount, 1);
  assert.equal(row.channel, "LPG");
  assert.equal(row.kgIsProxy, false);
  assert.equal(row.quantityUnit, "kg");
  assert.equal(row.meteredKg, 100);
  assert.equal(row.wiwoKg, 100);
});

test("a draft unified row still shields its source rows", () => {
  // The ledger owns the reading even while unposted; counting the raw copy
  // would double it the moment the draft is finally posted.
  const { rows } = run({
    unifiedLpg: [unifiedLpg({ status: "DRAFT", meter_reading_id: 500 })],
    meterReadings: [meterReading({ id: 500, kg_consumed: 60 })],
    invoices: [invoice()],
  });
  assert.equal(rows.length, 0);
});

test("an unconsumed posted WIWO header falls through on site supply", () => {
  const { rows, documents } = run({
    wiwoHeaders: [wiwoHeader({ total_billable_kg: 80 })],
    invoices: [invoice()],
    withDocuments: true,
  });

  const row = only(rows);
  assert.equal(row.grossKg, 80);
  assert.equal(row.productId, 0, "no product dimension exists on a header total");
  assert.equal(row.productName, "Site supply");
  assert.equal(documents[0]?.documentType, "WIWO");
});

test("uses WIWO detail lines when they exist and skips non-demand lines", () => {
  const { rows } = run({
    wiwoHeaders: [wiwoHeader({ total_billable_kg: 500 })],
    wiwoDetails: [
      wiwoDetail({ id: 1, line_type: "consumption", is_billable: true, consumed_lpg_kg: 50, billable_kg: 50 }),
      // A newly deployed full cylinder is gas arriving, not gas used.
      wiwoDetail({ id: 2, line_type: "new_deployment", is_billable: true, consumed_lpg_kg: 0, billable_kg: 12 }),
      // Gas coming back off the customer must not read as consumption.
      wiwoDetail({ id: 3, line_type: "return_only", is_billable: true, consumed_lpg_kg: 0, billable_kg: 12 }),
      wiwoDetail({ id: 4, line_type: "consumption", is_billable: false, consumed_lpg_kg: 99, billable_kg: 99 }),
    ],
    invoices: [invoice()],
  });

  const row = only(rows);
  assert.equal(row.grossKg, 50, "only the billable consumption line counts");
  assert.equal(row.orderCount, 1, "one WIWO is one supply event");
});

test("prefers the billable kg over the weighed kg on a WIWO line", () => {
  const { rows } = run({
    wiwoHeaders: [wiwoHeader()],
    wiwoDetails: [wiwoDetail({ consumed_lpg_kg: 50, billable_kg: 45 })],
    invoices: [invoice()],
  });
  assert.equal(only(rows).grossKg, 45);
});

test("a deployment-only swap is listed but carries no consumption", () => {
  const { rows, documents, exceptions } = run({
    wiwoHeaders: [wiwoHeader({ wiwo_type: "deployment_only", total_billable_kg: 0, sales_invoice_id: null })],
    invoices: [invoice()],
    withDocuments: true,
  });
  assert.equal(rows.length, 0);
  assert.equal(documents.length, 1);
  assert.equal(documents[0]?.kg, 0);
  assert.equal(exceptions.length, 0, "a deployment has no branch to blame");
});

test("an unconsumed posted meter reading uses kg_consumed as-is", () => {
  const { rows } = run({
    meterReadings: [meterReading({ meter_unit: "M3", kg_consumed: 60 })],
    invoices: [invoice()],
  });
  const row = only(rows);
  assert.equal(row.grossKg, 60, "kg_consumed is already converted; the raw unit is never applied");
  assert.equal(row.meteredKg, 60);
});

test("ignores anything that is not posted", () => {
  const cases: RunInput[] = [
    { unifiedLpg: [unifiedLpg({ status: "CANCELLED" })], invoices: [invoice()] },
    { wiwoHeaders: [wiwoHeader({ wiwo_status: "DRAFT" })], invoices: [invoice()] },
    { meterReadings: [meterReading({ reading_status: "PENDING" })], invoices: [invoice()] },
  ];
  for (const testCase of cases) {
    assert.equal(run(testCase).rows.length, 0);
  }
});

test("drops rows outside the reporting window", () => {
  const { rows } = run({
    unifiedLpg: [unifiedLpg({ transaction_date: "2026-02-11" })],
    meterReadings: [meterReading({ reading_date: "2025-12-31" })],
    invoices: [invoice()],
  });
  assert.equal(rows.length, 0);
});

test("honours both ends of the window", () => {
  const start = run({ unifiedLpg: [unifiedLpg({ transaction_date: "2026-01-01" })], invoices: [invoice()] });
  const end = run({ unifiedLpg: [unifiedLpg({ transaction_date: "2026-01-31T18:00:00" })], invoices: [invoice()] });
  assert.equal(only(start.rows).grossKg, 100);
  assert.equal(only(end.rows).grossKg, 100);
});

test("the billing engine's kg wins, otherwise the meter is used", () => {
  const noSource = run({
    unifiedLpg: [unifiedLpg({ billable_source: "NONE", billable_kg: 0, metered_kg: 40, wiwo_kg: 35 })],
    invoices: [invoice()],
  });
  assert.equal(only(noSource.rows).grossKg, 40, "falls back to metered kg");

  const weighedOnly = run({
    unifiedLpg: [unifiedLpg({ billable_source: "NONE", billable_kg: 0, metered_kg: 0, wiwo_kg: 35 })],
    invoices: [invoice()],
  });
  assert.equal(only(weighedOnly.rows).grossKg, 35);

  const zero = run({
    unifiedLpg: [unifiedLpg({ billable_source: "NONE", billable_kg: 0, metered_kg: 0, wiwo_kg: 0 })],
    invoices: [invoice()],
  });
  assert.equal(zero.rows.length, 0, "no gas, no row");
});

test("an onboarding baseline fill is excluded from demand and reported", () => {
  const { rows, exceptions, documents } = run({
    unifiedLpg: [unifiedLpg({ transaction_type: "ONBOARDING_BASELINE", billable_kg: 200 })],
    invoices: [invoice()],
    withDocuments: true,
  });

  assert.equal(rows.length, 0, "the first fill is stock, not consumption");
  assert.equal(exceptions[0]?.code, "LPG_BASELINE_EXCLUDED");
  assert.equal(exceptions[0]?.kg, 200, "the excluded volume is still disclosed");
  assert.equal(documents[0]?.kg, 0);
});

test("flags a material meter-versus-weighbridge divergence", () => {
  const diverging = run({
    unifiedLpg: [
      unifiedLpg({ metered_kg: 100, wiwo_kg: 92, variance_kg: 8, variance_reason_code: "LEAK_SUSPECT" }),
    ],
    invoices: [invoice()],
  });
  const row = only(diverging.rows);
  assert.equal(row.exceptionCodes.includes("LPG_VARIANCE"), true);
  assert.equal(row.varianceKg, 8);
  assert.match(diverging.exceptions[0]?.detail ?? "", /LEAK_SUSPECT/);

  const aligned = run({
    unifiedLpg: [unifiedLpg({ metered_kg: 100, wiwo_kg: 100, variance_kg: 0 })],
    invoices: [invoice()],
  });
  assert.equal(only(aligned.rows).exceptionCodes.length, 0);
});

test("reports a roundabout variance below the rounding threshold", () => {
  const { rows } = run({
    unifiedLpg: [unifiedLpg({ variance_kg: 0.0001 })],
    invoices: [invoice()],
  });
  assert.equal(only(rows).exceptionCodes.length, 0, "sub-gram differences are rounding noise");
});

test("an unbilled LPG transaction is disclosed with a null branch", () => {
  const { rows, exceptions } = run({
    unifiedLpg: [unifiedLpg({ sales_invoice_id: null, sales_invoice_no: null })],
    invoices: [invoice()],
  });
  const row = only(rows);
  assert.equal(row.branchId, null);
  assert.equal(row.branchName, "Unassigned");
  assert.equal(exceptions[0]?.code, "UNBILLED_LPG_TRANSACTION");
  assert.equal(row.grossKg, 100, "the demand is real even before billing");
});

test("drops an unattributable row when a branch filter is active", () => {
  const { exceptions } = run({
    filters: filters({ branchIds: [10] }),
    unifiedLpg: [unifiedLpg({ sales_invoice_id: null })],
    invoices: [invoice()],
  });
  assert.equal(exceptions[0]?.code, "UNBILLED_LPG_TRANSACTION");
  assert.equal(run({ filters: filters({ branchIds: [10] }), unifiedLpg: [unifiedLpg({ sales_invoice_id: null })], invoices: [invoice()] }).rows.length, 0);
});

test("reports BRANCH_UNKNOWN when the linked invoice was never fetched", () => {
  const { rows, exceptions } = run({
    unifiedLpg: [unifiedLpg({ sales_invoice_id: 777, sales_invoice_no: "SI-0777" })],
    invoices: [invoice()],
  });
  assert.equal(exceptions[0]?.code, "BRANCH_UNKNOWN");
  assert.equal(only(rows).branchName, "Unassigned");
});

test("resolves the branch from the linked invoice", () => {
  const { rows, exceptions } = run({
    unifiedLpg: [unifiedLpg()],
    invoices: [invoice({ branch_id: 11 })],
    lpgSites: [lpgSite()],
  });
  assert.equal(exceptions.length, 0);
  assert.equal(only(rows).branchId, 11);
});

test("carries the site billing mode onto the row", () => {
  const { rows } = run({
    unifiedLpg: [unifiedLpg()],
    invoices: [invoice()],
    lpgSites: [lpgSite({ billing_mode: "KILO" })],
  });
  assert.equal(only(rows).billingMode, "KILO");
});

test("resolves the customer from the site when the row omits it", () => {
  const { rows } = run({
    unifiedLpg: [unifiedLpg({ customer_code: null })],
    invoices: [invoice()],
  });
  assert.equal(only(rows).customerCode, "C-001");
});

test("drops rows for customers outside the classification allow-list", () => {
  const { rows } = run({
    unifiedLpg: [unifiedLpg()],
    invoices: [invoice()],
    allowedCustomerCodes: new Set(["C-002"]),
  });
  assert.equal(rows.length, 0);
});

test("scopes to the selected customers for the drill-down", () => {
  const { rows } = run({
    filters: filters({ customerCodes: ["C-002"] }),
    unifiedLpg: [unifiedLpg()],
    invoices: [invoice()],
  });
  assert.equal(rows.length, 0);

  const twoCustomers = run({
    filters: filters({ customerCodes: ["C-002", "C-001"] }),
    unifiedLpg: [unifiedLpg()],
    invoices: [invoice()],
  });
  assert.equal(twoCustomers.rows.length, 1, "a selection is an OR, not an AND");
});

test("one document row per LPG billing event", () => {
  const { documents } = run({
    unifiedLpg: [unifiedLpg({ id: 1, transaction_no: "LPG-1" }), unifiedLpg({ id: 2, transaction_no: "LPG-2" })],
    invoices: [invoice()],
    withDocuments: true,
  });
  assert.equal(documents.length, 2);
  assert.equal(documents[0]?.documentType, "LPG_BILLING");
  assert.equal(documents[0]?.reference, "SI-0001", "the billing reference is retained");
});

test("keeps both channels apart for the same customer and product", () => {
  const context = buildContext(source(masters({ lpgSites: [lpgSite()], invoices: [invoice()] })));
  const accumulators = new Map<string, RowAccumulator>();
  const exceptions: ReportException[] = [];

  accumulateLpg({
    filters: filters(),
    context,
    lpgSites: [lpgSite()],
    unifiedLpg: [unifiedLpg()],
    wiwoHeaders: [],
    wiwoDetails: [],
    meterReadings: [],
    invoices: [invoice()],
    allowedCustomerCodes: null,
    accumulators,
    exceptions,
  });

  assert.equal(accumulators.size, 1);
  const row = finalizeRow([...accumulators.values()][0] as RowAccumulator, context);
  assert.equal(row.channel, "LPG");
  assert.equal(row.kgIsProxy, false);
});
