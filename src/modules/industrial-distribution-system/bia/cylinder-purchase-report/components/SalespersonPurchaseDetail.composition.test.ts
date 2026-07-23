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

  assert.match(source, /View details/);
  assert.match(source, /openSalespersonDetail/);
  assert.match(source, /SalespersonPurchaseDetail/);
});

test("salesperson detail presents customer, cylinder, and customer cylinder tabs", () => {
  const source = readSource(`${componentRoot}/SalespersonPurchaseDetail.tsx`);

  assert.match(source, /value="customers"/);
  assert.match(source, /value="products"/);
  assert.match(source, /value="customer-products"/);
  assert.match(source, /selectedSalesperson\.customerBreakdown/);
  assert.match(source, /selectedSalesperson\.productBreakdown/);
  assert.match(source, /selectedSalesperson\.customerProductBreakdown/);
});

test("report provider owns salesperson detail selection state", () => {
  const source = readSource(providerPath);

  assert.match(source, /selectedSalesperson/);
  assert.match(source, /openSalespersonDetail/);
  assert.match(source, /closeSalespersonDetail/);
});
