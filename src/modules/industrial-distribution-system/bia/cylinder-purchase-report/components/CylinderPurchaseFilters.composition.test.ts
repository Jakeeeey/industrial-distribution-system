import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const filtersSource = readFileSync(
  new URL("./CylinderPurchaseFilters.tsx", import.meta.url),
  "utf8",
);
const providerSource = readFileSync(
  new URL("../providers/CylinderPurchaseReportProvider.tsx", import.meta.url),
  "utf8",
);
const typesSource = readFileSync(
  new URL("../types/cylinder-purchase-report.types.ts", import.meta.url),
  "utf8",
);

test("draft and applied report filters carry optional lookup labels", () => {
  assert.match(typesSource, /interface AppliedFilterContext/);
  for (const labelKey of [
    "customerLabel",
    "productLabel",
    "branchLabel",
    "salespersonLabel",
  ]) {
    assert.match(typesSource, new RegExp(`${labelKey}\\?:\\s*string`));
  }
  assert.match(
    providerSource,
    /draftFilters:\s*AppliedFilterContext/,
  );
  assert.match(
    providerSource,
    /appliedFilters:\s*AppliedFilterContext/,
  );
});

test("every lookup control uses the shared selection helper to keep values and labels synchronized", () => {
  assert.match(filtersSource, /applyReportLookupSelection/);
  for (const lookupType of [
    "customers",
    "products",
    "branches",
    "salespeople",
  ]) {
    assert.match(
      filtersSource,
      new RegExp(`applyReportLookupSelection\\([\\s\\S]*"${lookupType}"`),
    );
  }
});

test("the filter component stays below the component architecture guardrail", () => {
  assert.ok(
    filtersSource.split(/\r?\n/).length <= 300,
    "CylinderPurchaseFilters.tsx must stay at or below 300 lines",
  );
});
