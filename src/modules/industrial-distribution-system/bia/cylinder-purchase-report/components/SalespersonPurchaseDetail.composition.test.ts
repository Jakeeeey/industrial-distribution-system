import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const readSource = (path: string): string =>
  existsSync(path) ? readFileSync(path, "utf8") : "";

const componentRoot =
  "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/components";
const providerPath =
  "src/modules/industrial-distribution-system/bia/cylinder-purchase-report/providers/CylinderPurchaseReportProvider.tsx";

test("salesperson performance exposes an accessible detail action", () => {
  const source = readSource(`${componentRoot}/SalespersonPerformanceView.tsx`);

  assert.match(source, /View purchase details/);
  assert.match(source, /openSalespersonDetail/);
  assert.match(source, /SalespersonPurchaseDetail/);
  assert.match(source, /onRowClick=\{\(row\) => openSalespersonDetail\(row\.data\)\}/);
  assert.match(source, /rowActionLabel=\{\(row\) =>/);
  assert.doesNotMatch(source, /key:\s*"actions"/);
});

test("salesperson detail presents customer, cylinder, and customer cylinder tabs", () => {
  const source = readSource(`${componentRoot}/SalespersonPurchaseDetail.tsx`);

  assert.match(source, /value="customers"/);
  assert.match(source, /value="products"/);
  assert.match(source, /value="customer-products"/);
  assert.match(source, /selectedSalesperson\.customerBreakdown/);
  assert.match(source, /selectedSalesperson\.productBreakdown/);
  assert.match(source, /selectedSalesperson\?\.customerProductBreakdown/);
});

test("customer rows drill into filtered cylinders in the same dialog", () => {
  const source = readSource(`${componentRoot}/SalespersonPurchaseDetail.tsx`);

  assert.match(source, /onRowClick=\{openCustomerCylinders\}/);
  assert.match(source, /View cylinders purchased by/);
  assert.match(source, /value=\{activeTab\}/);
  assert.match(source, /onValueChange=\{handleTabChange\}/);
  assert.match(source, /Cylinders purchased by/);
  assert.match(source, /Show all customers/);
  assert.match(source, /filteredCustomerProducts/);
});

test("report provider owns salesperson detail selection state", () => {
  const source = readSource(providerPath);

  assert.match(source, /selectedSalesperson/);
  assert.match(source, /openSalespersonDetail/);
  assert.match(source, /closeSalespersonDetail/);
});
