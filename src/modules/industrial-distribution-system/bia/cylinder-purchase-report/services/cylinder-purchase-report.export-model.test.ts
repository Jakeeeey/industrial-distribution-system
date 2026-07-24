import assert from "node:assert/strict";
import test from "node:test";

import type {
  CylinderPurchaseRow,
  CustomerPurchaseSummary,
} from "../types/cylinder-purchase-report.types";
import {
  buildConsolidatedExportSections,
  buildDashboardExportSections,
} from "./cylinder-purchase-report.export-model";
import { aggregateCylinderPurchases } from "./cylinder-purchase-report.helpers";

const row = (patch: Partial<CylinderPurchaseRow> = {}): CylinderPurchaseRow => ({
  customerCode: "C-001",
  customerName: "Alpha Store",
  invoiceDate: "2026-07-01",
  productId: 11,
  productCode: "LPG-11",
  productName: "LPG 11KG",
  branchId: 1,
  branchCode: "B01",
  branchName: "Main",
  salesmanId: 7,
  salesmanCode: "S07",
  salesmanName: "Ana",
  grossPurchasedQty: 10,
  returnedQty: 2,
  netPurchasedQty: 8,
  ...patch,
});

const reportFixture = aggregateCylinderPurchases(
  [
    row(),
    row({
      customerCode: "C-002",
      customerName: "Beta Store",
      productId: 50,
      productCode: "LPG-50",
      productName: "LPG 50KG",
    }),
    row({
      customerCode: null,
      customerName: null,
      grossPurchasedQty: 0,
      returnedQty: 1,
      netPurchasedQty: -1,
    }),
  ],
  { startDate: "2026-06-23", endDate: "2026-07-22" },
  "2026-07-22T10:00:00.000Z",
);

test("active customer export contains every filtered customer, not one screen page", () => {
  const sections = buildDashboardExportSections(reportFixture, "customers");

  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, "Customer Cylinder Ranking");
  assert.equal(sections[0].rows.length, reportFixture.customerRanking.length);
});

test("each active dashboard exports its complete aggregated dataset", () => {
  const expectedRows = {
    customers: reportFixture.customerRanking.length,
    products: reportFixture.productPerformance.length,
    returns:
      reportFixture.returnAnalysis.byCustomer.length +
      reportFixture.returnAnalysis.byProduct.length +
      reportFixture.returnAnalysis.byBranch.length +
      reportFixture.returnAnalysis.bySalesperson.length,
    branches: reportFixture.branchPerformance.length,
    salespeople: reportFixture.salespersonPerformance.length,
  } as const;

  for (const [view, rowCount] of Object.entries(expectedRows)) {
    const [section] = buildDashboardExportSections(
      reportFixture,
      view as keyof typeof expectedRows,
    );
    assert.equal(section.rows.length, rowCount, view);
  }
});

test("selected customer export uses the complete product detail breakdown", () => {
  const selectedCustomer = reportFixture.customerRanking.find(
    (customer) => customer.customerCode === "C-001",
  ) as CustomerPurchaseSummary;
  const [section] = buildDashboardExportSections(
    reportFixture,
    "customers",
    selectedCustomer,
  );

  assert.equal(section.title, "Customer Purchase Detail");
  assert.equal(section.rows.length, selectedCustomer.productBreakdown.length);
  assert.ok(
    section.rows.every(
      (detailRow) =>
        detailRow[0] === selectedCustomer.customerCode &&
        detailRow[1] === selectedCustomer.customerName,
    ),
  );
});

test("consolidated export contains all seven named views", () => {
  const sections = buildConsolidatedExportSections(reportFixture);

  assert.deepEqual(
    sections.map((section) => section.title),
    [
      "Cylinder Purchase Overview",
      "Customer Cylinder Ranking",
      "Customer Purchase Detail",
      "Cylinder Product Performance",
      "Cylinder Return Analysis",
      "Branch Performance",
      "Salesperson Performance",
    ],
  );
});

test("consolidated customer detail flattens every customer's product rows", () => {
  const detailSection = buildConsolidatedExportSections(reportFixture)[2];
  const expectedRows = reportFixture.customerRanking.reduce(
    (count, customer) => count + customer.productBreakdown.length,
    0,
  );

  assert.equal(detailSection.rows.length, expectedRows);
  assert.ok(
    detailSection.rows.every(
      (detailRow) => typeof detailRow[0] === "string" && detailRow[0].length > 0,
    ),
  );
});

test("export rows preserve raw numeric values for renderer formatting", () => {
  const customer = reportFixture.customerRanking[0];
  const customerSection = buildDashboardExportSections(
    reportFixture,
    "customers",
  )[0];

  assert.deepEqual(customerSection.rows[0].slice(3), [
    customer.grossPurchasedQty,
    customer.returnedQty,
    customer.netPurchasedQty,
    customer.returnRate,
  ]);
  assert.ok(customerSection.rows[0].slice(3).every((value) => typeof value === "number"));
});

test("renderer-neutral export context prefers business labels over raw identifiers", async () => {
  const exportModelModule = (await import(
    "./cylinder-purchase-report.export-model"
  )) as Record<string, unknown>;
  const buildFilterContext = exportModelModule.buildReportFilterContext as
    | ((filters: typeof reportFixture.filters) => Array<{ label: string; value: string }>)
    | undefined;

  assert.equal(typeof buildFilterContext, "function");
  if (!buildFilterContext) return;

  const context = buildFilterContext({
    ...reportFixture.filters,
    customerCode: "C-001",
    customerLabel: "Alpha Store (C-001)",
    productId: 11,
    productLabel: "LPG 11KG (LPG-11)",
    branchId: 1,
    branchLabel: "Main Branch (B01)",
    salesmanId: 7,
    salespersonLabel: "Ana (S07)",
  });
  const values = Object.fromEntries(
    context.map((item) => [item.label, item.value]),
  );

  assert.equal(values.Customer, "Alpha Store (C-001)");
  assert.equal(values.Product, "LPG 11KG (LPG-11)");
  assert.equal(values.Branch, "Main Branch (B01)");
  assert.equal(values.Salesperson, "Ana (S07)");
  assert.notEqual(values.Product, "11");
  assert.notEqual(values.Branch, "1");
  assert.notEqual(values.Salesperson, "7");
});
