import assert from "node:assert/strict";
import test from "node:test";

import { buildCustomerOrderConsumptionReport } from "./customer-order-consumption.service";
import {
  branch,
  classification,
  customer,
  filters,
  invoice,
  invoiceDetail,
  lpgSite,
  masters,
  postDispatch,
  product,
  returnDetail,
  salesReturn,
  salesman,
  source,
  unifiedLpg,
  unit,
  weightUnit,
  category,
} from "./customer-order-consumption.test-fixtures";

const GENERATED_AT = new Date("2026-02-01T00:00:00Z");

/** Both channels, one customer, one branch — the shape the ticket describes. */
const bothChannels = () =>
  source(
    masters({
      customers: [customer(), customer({ customer_code: "C-002", customer_name: "Beta Bottling" })],
      invoices: [
        invoice({ invoice_id: 1, order_id: "SO-1" }),
        invoice({ invoice_id: 2, order_id: "SO-1", invoice_no: "SI-0002", invoice_date: "2026-01-11" }),
      ],
      invoiceDetails: [
        invoiceDetail({ detail_id: 1, invoice_no: 1, product_id: 100, quantity: 10 }),
        invoiceDetail({ detail_id: 2, invoice_no: 2, product_id: 101, quantity: 4 }),
      ],
      products: [
        product(),
        product({ product_id: 101, product_code: "O2-10", product_name: "Oxygen 10KG", product_weight: 10 }),
      ],
      lpgSites: [lpgSite()],
      unifiedLpg: [unifiedLpg()],
    })
  );

test("builds the full envelope from raw rows without touching the network", () => {
  const report = buildCustomerOrderConsumptionReport(filters(), bothChannels(), GENERATED_AT);

  assert.equal(report.generatedAt, GENERATED_AT.toISOString());
  assert.equal(report.reportingCutoff, "2026-01-31", "endDate is the cutoff the header prints");
  assert.equal(report.rows.length, 3);
  assert.equal(report.filters.endDate, "2026-01-31");
  assert.ok(report.sourceRowCount > 0);
});

test("sourceRowCount counts the movement rows the report read", () => {
  const report = buildCustomerOrderConsumptionReport(filters(), bothChannels(), GENERATED_AT);
  // 2 invoices + 2 details + 1 unified LPG row.
  assert.equal(report.sourceRowCount, 5);
});

test("keeps the two kg bases apart in the overview", () => {
  const report = buildCustomerOrderConsumptionReport(filters(), bothChannels(), GENERATED_AT);

  assert.equal(report.overview.cylinder.grossKg, 160, "10 x 12 kg + 4 x 10 kg");
  assert.equal(report.overview.lpg.grossKg, 100, "the metered 100 kg is not added to the proxy");
  assert.equal(report.overview.cylinder.netKg, 160);
  assert.equal(report.overview.lpg.netKg, 100);
  assert.equal(report.overview.totalCustomers, 1);
  assert.equal(report.overview.totalOrders, 2, "one split sales order plus one LPG billing");
});

test("trends each channel as its own series", () => {
  const report = buildCustomerOrderConsumptionReport(filters(), bothChannels(), GENERATED_AT);
  assert.deepEqual(
    report.monthlyTrend.map((point) => `${point.yearMonth}:${point.channel}`),
    ["2026-01:CYLINDER", "2026-01:LPG"]
  );
  assert.equal(report.monthlyTrend[0]?.grossKg, 160);
  assert.equal(report.monthlyTrend[1]?.grossKg, 100);
});

test("sorts by customer, then branch, then channel, then volume", () => {
  const rows = buildCustomerOrderConsumptionReport(filters(), bothChannels(), GENERATED_AT).rows;
  assert.deepEqual(
    rows.map((row) => `${row.customerCode}/${row.channel}/${row.grossKg}`),
    ["C-001/CYLINDER/120", "C-001/CYLINDER/40", "C-001/LPG/100"],
    "the heaviest product leads inside one customer and channel"
  );

  const withTwoCustomers = buildCustomerOrderConsumptionReport(
    filters(),
    source(
      masters({
        customers: [
          customer({ customer_code: "C-002", customer_name: "Alpha Second" }),
          customer(),
        ],
        branches: [branch(), branch({ id: 11, branch_name: "Cebu", branch_code: "CEB" })],
        invoices: [
          invoice({ invoice_id: 1, order_id: "SO-1", customer_code: "C-002", branch_id: 11 }),
          invoice({ invoice_id: 2, order_id: "SO-2", customer_code: "C-001", invoice_date: "2026-01-11" }),
        ],
        invoiceDetails: [
          invoiceDetail({ detail_id: 1, invoice_no: 1, quantity: 1 }),
          invoiceDetail({ detail_id: 2, invoice_no: 2, quantity: 2 }),
        ],
      })
    ),
    GENERATED_AT
  ).rows;
  assert.deepEqual(
    withTwoCustomers.map((row) => row.customerName),
    ["Alpha Foods", "Alpha Second"],
    "customer name ordering is what the reviewer scans"
  );
  assert.deepEqual(
    withTwoCustomers.map((row) => row.grossQty),
    [2, 1],
    "the two customers are distinct rows, not one merged account"
  );
});

test("an order covering three products is still one buying event", () => {
  const report = buildCustomerOrderConsumptionReport(
    filters({ channel: "CYLINDER" }),
    source(
      masters({
        products: [
          product(),
          product({ product_id: 101, product_name: "Oxygen 10KG", product_weight: 10 }),
          product({ product_id: 102, product_name: "Argon 5KG", product_weight: 5 }),
        ],
        invoices: [invoice({ invoice_id: 1, order_id: "SO-9" })],
        invoiceDetails: [
          invoiceDetail({ detail_id: 1, invoice_no: 1, product_id: 100 }),
          invoiceDetail({ detail_id: 2, invoice_no: 1, product_id: 101 }),
          invoiceDetail({ detail_id: 3, invoice_no: 1, product_id: 102 }),
        ],
      })
    ),
    GENERATED_AT
  );

  assert.equal(report.rows.length, 3, "one row per product at the report grain");
  assert.equal(report.overview.cylinder.orders, 1, "the frequency KPI must not track the line count");
  assert.equal(report.overview.totalOrders, 1);
  assert.equal(report.monthlyTrend[0]?.orderCount, 1);
});

test("a channel filter skips the other pass entirely", () => {
  const cylinderOnly = buildCustomerOrderConsumptionReport(
    filters({ channel: "CYLINDER" }),
    bothChannels(),
    GENERATED_AT
  );
  assert.deepEqual(cylinderOnly.rows.map((row) => row.channel), ["CYLINDER", "CYLINDER"]);
  assert.equal(cylinderOnly.overview.lpg.netKg, 0);

  const lpgOnly = buildCustomerOrderConsumptionReport(
    filters({ channel: "LPG" }),
    bothChannels(),
    GENERATED_AT
  );
  assert.deepEqual(lpgOnly.rows.map((row) => row.channel), ["LPG"]);
  assert.equal(lpgOnly.overview.cylinder.netKg, 0);
});

test("drops rows that carry no movement at all", () => {
  const report = buildCustomerOrderConsumptionReport(
    filters(),
    source(
      masters({
        invoices: [invoice()],
        invoiceDetails: [invoiceDetail({ quantity: 0 })],
      })
    ),
    GENERATED_AT
  );
  assert.equal(report.rows.length, 0);
  assert.equal(report.overview.totalOrders, 0);
});

test("keeps a return that lands in the window even when the sale did not", () => {
  const report = buildCustomerOrderConsumptionReport(
    filters(),
    source(
      masters({
        returns: [salesReturn()],
        returnDetails: [returnDetail()],
      })
    ),
    GENERATED_AT
  );

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0]?.grossQty, 0);
  assert.equal(report.rows[0]?.returnedQty, 2);
  assert.equal(report.rows[0]?.netKg, -24, "an adjustment to earlier demand is a real signal");
});

test("carries exceptions through to the envelope untouched", () => {
  const report = buildCustomerOrderConsumptionReport(
    filters(),
    source(
      masters({
        invoices: [invoice()],
        invoiceDetails: [invoiceDetail({ product_id: 999 })],
        postDispatch: [postDispatch({ status: "fulfilled with concerns" })],
      })
    ),
    GENERATED_AT
  );

  assert.deepEqual(
    report.exceptions.map((item) => item.code).sort(),
    ["FULFILLED_WITH_CONCERNS", "MISSING_PRODUCT_WEIGHT"]
  );
  assert.equal(report.overview.exceptionCount, 2);
  assert.equal(
    report.rows.length,
    0,
    "a line whose product cannot be proven serialized is disclosed, not shown"
  );
});

test("the classification selection is applied without a second query", () => {
  const rows = buildCustomerOrderConsumptionReport(
    filters({ classificationIds: [71] }),
    bothChannels(),
    GENERATED_AT
  ).rows;
  assert.equal(rows.length, 0, "every fixture customer is classification 70");

  const matched = buildCustomerOrderConsumptionReport(
    filters({ classificationIds: [70] }),
    bothChannels(),
    GENERATED_AT
  ).rows;
  assert.equal(matched.length, 3);

  const either = buildCustomerOrderConsumptionReport(
    filters({ classificationIds: [71, 70] }),
    bothChannels(),
    GENERATED_AT
  ).rows;
  assert.equal(either.length, 3, "a classification selection is an OR");
});

test("the customer selection reproduces exactly the drill-down scope", () => {
  const scoped = buildCustomerOrderConsumptionReport(
    filters({ customerCodes: ["C-001"] }),
    bothChannels(),
    GENERATED_AT
  );
  assert.deepEqual([...new Set(scoped.rows.map((row) => row.customerCode))], ["C-001"]);

  const other = buildCustomerOrderConsumptionReport(
    filters({ customerCodes: ["C-002"] }),
    bothChannels(),
    GENERATED_AT
  );
  assert.equal(other.rows.length, 0);

  const two = buildCustomerOrderConsumptionReport(
    filters({ customerCodes: ["C-001", "C-002"] }),
    bothChannels(),
    GENERATED_AT
  );
  assert.deepEqual([...new Set(two.rows.map((row) => row.customerCode))], ["C-001"]);
});

test("a branch selection restricts the report to those branches only", () => {
  const rows = buildCustomerOrderConsumptionReport(
    filters({ branchIds: [11] }),
    bothChannels(),
    GENERATED_AT
  ).rows;
  assert.equal(rows.length, 0, "ticket s8: no cross-branch reading");

  const picked = buildCustomerOrderConsumptionReport(
    filters({ branchIds: [10, 11] }),
    bothChannels(),
    GENERATED_AT
  ).rows;
  assert.equal(picked.length, 3);
});

test("masters are joined onto every row for the table", () => {
  const report = buildCustomerOrderConsumptionReport(
    filters(),
    source(
      masters({
        customers: [customer({ classification: 71 })],
        classifications: [classification({ id: 71, classification_name: "Industrial" })],
        branches: [branch({ id: 10, branch_name: "Manila" })],
        salesmen: [salesman()],
        units: [unit({ unit_id: 3 })],
        weightUnits: [weightUnit()],
        categories: [category()],
        invoices: [invoice()],
        invoiceDetails: [invoiceDetail()],
      })
    ),
    GENERATED_AT
  );

  const row = report.rows[0];
  assert.equal(row?.classificationName, "Industrial");
  assert.equal(row?.branchName, "Manila");
  assert.equal(row?.productCode, "LPG-12");
  assert.equal(row?.gasType, "LPG");
});
