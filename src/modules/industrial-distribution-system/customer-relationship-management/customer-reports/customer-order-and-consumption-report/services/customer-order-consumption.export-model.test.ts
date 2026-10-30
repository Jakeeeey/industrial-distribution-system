import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDemandExportSections,
  buildReportExportSections,
  buildReportFilterContext,
  exportKg,
} from "./customer-order-consumption.export-model";
import type {
  AppliedFilterContext,
  ChannelTotals,
  CustomerOrderConsumptionReportResponse,
  CustomerOrderConsumptionRow,
} from "../types/customer-order-consumption.types";

const totals = (patch: Partial<ChannelTotals> = {}): ChannelTotals => ({
  customers: 1,
  orders: 2,
  grossQty: 10,
  returnedQty: 1,
  grossKg: 120,
  returnedKg: 12,
  netKg: 108,
  netAmount: 1000,
  avgOrderSizeKg: 54,
  returnRatePct: 10,
  ...patch,
});

const row = (patch: Partial<CustomerOrderConsumptionRow> = {}): CustomerOrderConsumptionRow => ({
  customerCode: "C-001",
  customerName: "Alpha Foods",
  storeName: "Alpha Store",
  classificationName: "Commercial",
  branchId: 10,
  branchName: "Manila",
  channel: "CYLINDER",
  billingMode: null,
  productId: 100,
  productCode: "LPG-12",
  productName: "LPG 12KG",
  gasType: "LPG",
  sizeKg: 12,
  quantityUnit: "cyl",
  orderCount: 2,
  grossQty: 10,
  returnedQty: 1,
  netQty: 9,
  grossKg: 120,
  returnedKg: 12,
  netKg: 108,
  kgIsProxy: true,
  netAmount: 1000,
  avgOrderSizeKg: 54,
  avgOrderSizeQty: 4.5,
  meteredKg: 0,
  wiwoKg: 0,
  varianceKg: 0,
  monthlyTrend: [
    { yearMonth: "2026-01", orderCount: 1, orderKeys: ["SO:1"], grossQty: 10, returnedQty: 1, grossKg: 120, returnedKg: 12, netKg: 108 },
  ],
  exceptionCodes: [],
  ...patch,
});

const report = (
  patch: Partial<CustomerOrderConsumptionReportResponse> = {}
): CustomerOrderConsumptionReportResponse => ({
  filters: { startDate: "2026-01-01", endDate: "2026-01-31" },
  generatedAt: "2026-02-01T00:00:00.000Z",
  reportingCutoff: "2026-01-31",
  sourceRowCount: 42,
  overview: {
    totalCustomers: 1,
    totalOrders: 3,
    cylinder: totals(),
    lpg: totals({ grossKg: 500, returnedKg: 0, netKg: 500, orders: 1, grossQty: 500, netAmount: 5000, avgOrderSizeKg: 500, returnRatePct: 0 }),
    exceptionCount: 2,
  },
  rows: [row()],
  exceptions: [
    {
      code: "LPG_VARIANCE",
      channel: "LPG",
      customerCode: "C-001",
      customerName: "Alpha Foods",
      referenceType: "LPG_TRANSACTION",
      referenceNo: "LPG-0001",
      detail: "Meter 100 kg vs weighed 92 kg.",
      quantity: 0,
      kg: 8,
    },
  ],
  monthlyTrend: [],
  ...patch,
});

const section = (
  report_: CustomerOrderConsumptionReportResponse,
  title: string
) => {
  const found = buildReportExportSections(report_).find((item) => item.title === title);
  assert.ok(found, `section ${title} missing`);
  return found;
};

test("the filter context is echoed on every export", () => {
  const context = buildReportFilterContext({
    startDate: "2026-01-01",
    endDate: "2026-01-31",
  });
  const byLabel = new Map(context.map((item) => [item.label, item.value]));

  assert.equal(byLabel.get("Period"), "2026-01-01 to 2026-01-31");
  assert.equal(byLabel.get("Branch"), "All branches");
  assert.equal(byLabel.get("Channel"), "Cylinder and LPG, kept separate");
});

test("applied filters and the channel are labelled for the reader", () => {
  const context = buildReportFilterContext({
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    branchIds: [10],
    branchLabels: ["Manila (MNL)"],
    customerCodes: ["C-001"],
    customerLabels: ["Alpha Foods (C-001)"],
    salesmanIds: [5],
    salesmanLabels: ["Ana (S-05)"],
    classificationIds: [70],
    classificationLabels: ["Commercial"],
    channel: "LPG",
  } satisfies AppliedFilterContext);
  const byLabel = new Map(context.map((item) => [item.label, item.value]));

  assert.equal(byLabel.get("Branch"), "Manila (MNL)");
  assert.equal(byLabel.get("Customer"), "Alpha Foods (C-001)");
  assert.equal(byLabel.get("Salesman"), "Ana (S-05)");
  assert.equal(byLabel.get("Classification"), "Commercial");
  assert.equal(byLabel.get("Channel"), "Metered & weighed LPG");
});

test("a multi-select is counted and named, not silently collapsed to one", () => {
  const context = buildReportFilterContext({
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    branchIds: [10, 11],
    branchLabels: ["Manila (MNL)", "Cebu (CEB)"],
    salesmanIds: [5, 6, 7],
  } satisfies AppliedFilterContext);
  const byLabel = new Map(context.map((item) => [item.label, item.value]));

  assert.equal(byLabel.get("Branch"), "2 selected: Manila (MNL), Cebu (CEB)");
  assert.equal(
    byLabel.get("Salesman"),
    "3 selected: 5, 6, 7",
    "without labels the ids are still printed, so the page never claims All"
  );
});

test("the overview keeps one column per kg basis", () => {
  const overview = section(report(), "Overview");
  assert.deepEqual(overview.columns, [
    "Metric",
    "Cylinder / bulk purchase",
    "Metered & weighed LPG",
  ], "a single combined kg column would break ticket s8");

  const netKg = overview.rows.find((line) => line[0] === "Net kg");
  assert.deepEqual(netKg, ["Net kg", 108, 500]);
  assert.equal(
    overview.rows.some((line) => String(line[0]).toLowerCase().includes("total")),
    false
  );
});

test("the demand sheet states the kg basis on every line", () => {
  const demand = section(report(), "Demand by Customer");
  const basisIndex = demand.columns.indexOf("kg Basis");
  assert.ok(basisIndex >= 0);
  assert.equal(demand.rows[0]?.[basisIndex], "Proxy (qty x cylinder size)");

  const measured = section(report({ rows: [row({ channel: "LPG", kgIsProxy: false })] }), "Demand by Customer");
  assert.equal(measured.rows[0]?.[basisIndex], "Measured");
});

test("the demand sheet carries the provisional gas columns", () => {
  const demand = section(report(), "Demand by Customer");
  assert.deepEqual(
    demand.columns.filter((column) => /Gas Type|Size kg|Billing Mode/.test(column)),
    ["Billing Mode", "Gas Type (from category)", "Size kg"]
  );

  const columns = demand.columns;
  const unknown = row({ gasType: null, sizeKg: null, billingMode: null });
  const line = section(report({ rows: [unknown] }), "Demand by Customer").rows[0] as (string | number)[];
  assert.equal(line[columns.indexOf("Gas Type (from category)")], "", "unknown is blank, never invented");
  assert.equal(line[columns.indexOf("Size kg")], "");
});

test("numbers are exported as numbers so Excel can still sum them", () => {
  const line = section(report(), "Demand by Customer").rows[0] as (string | number)[];
  const columns = section(report(), "Demand by Customer").columns;
  assert.equal(typeof line[columns.indexOf("Net kg")], "number");
  assert.equal(line[columns.indexOf("Net kg")], 108);
  assert.equal(typeof line[columns.indexOf("Return Rate")], "string", "a rate is labelled text");
  assert.equal(line[columns.indexOf("Return Rate")], "10.0%");
});

test("the trend sheet re-splits per channel per month", () => {
  const cylinder = row();
  const lpg = row({
    channel: "LPG",
    productId: 0,
    kgIsProxy: false,
    grossKg: 500,
    returnedKg: 0,
    netKg: 500,
    monthlyTrend: [
      { yearMonth: "2026-01", orderCount: 1, orderKeys: ["LPG:1"], grossQty: 500, returnedQty: 0, grossKg: 500, returnedKg: 0, netKg: 500 },
      { yearMonth: "2026-02", orderCount: 1, orderKeys: ["LPG:2"], grossQty: 250, returnedQty: 0, grossKg: 250, returnedKg: 0, netKg: 250 },
    ],
  });

  const trend = section(report({ rows: [cylinder, lpg] }), "Monthly Trend");
  assert.deepEqual(
    trend.rows.map((line) => `${line[0]} | ${line[1]}`),
    ["Jan 2026 | Cylinder / bulk purchase", "Jan 2026 | Metered & weighed LPG", "Feb 2026 | Metered & weighed LPG"]
  );
  // Cylinder January and LPG January are separate lines, never one kg figure.
  assert.deepEqual(trend.rows[0]?.slice(5), [120, 12, 108]);
  assert.deepEqual(trend.rows[1]?.slice(5), [500, 0, 500]);
});

test("one order behind two product rows is one billing event in the trend", () => {
  const first = row({ productId: 100, grossKg: 120, netKg: 120 });
  const second = row({
    productId: 101,
    productName: "Oxygen 10KG",
    grossKg: 40,
    returnedKg: 0,
    netKg: 40,
    monthlyTrend: [
      { yearMonth: "2026-01", orderCount: 1, orderKeys: ["SO:1"], grossQty: 4, returnedQty: 0, grossKg: 40, returnedKg: 0, netKg: 40 },
    ],
  });

  const trend = section(report({ rows: [first, second] }), "Monthly Trend");
  assert.equal(trend.rows.length, 1, "both lines fall in one month and one channel");
  assert.equal(trend.rows[0]?.[2], 1, "the shared sales order is counted once");
  assert.deepEqual(trend.rows[0]?.slice(3, 5), [14, 1]);
});

test("the exceptions sheet discloses what was excluded", () => {
  const exceptions = section(report(), "Data Exceptions");
  assert.deepEqual(exceptions.columns, [
    "Code",
    "Channel",
    "Customer Code",
    "Customer",
    "Reference Type",
    "Reference",
    "Quantity",
    "kg",
    "Detail",
  ]);
  assert.deepEqual(exceptions.rows[0]?.slice(0, 6), [
    "LPG_VARIANCE",
    "Metered & weighed LPG",
    "C-001",
    "Alpha Foods",
    "LPG_TRANSACTION",
    "LPG-0001",
  ]);
});

test("an empty report still exports its structure", () => {
  const empty = report({ rows: [], exceptions: [] });
  const sections = buildReportExportSections(empty);
  assert.deepEqual(
    sections.map((item) => item.title),
    ["Overview", "Demand by Customer", "Monthly Trend", "Data Exceptions"]
  );
  assert.deepEqual(sections[1]?.rows, []);
  assert.deepEqual(sections[2]?.rows, []);
});

test("the flat sheet is exactly the demand table", () => {
  const sections = buildDemandExportSections([row()]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0]?.title, "Demand by Customer");
  assert.equal(sections[0]?.columns.length, 27);
  assert.equal(sections[0]?.rows[0]?.length, 27, "every row matches its header");
});

test("kg text is compact and never blank", () => {
  assert.equal(exportKg(1234.5), "1,234.500");
  assert.equal(exportKg(Number.NaN), "0.000");
});
