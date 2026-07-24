import assert from "node:assert/strict";
import test from "node:test";

import type {
  AppliedFilterContext,
  ReportLookupOption,
  ReportLookupType,
} from "../types/cylinder-purchase-report.types";

type ApplySelection = (
  filters: AppliedFilterContext,
  type: ReportLookupType,
  option?: ReportLookupOption,
) => AppliedFilterContext;

test("lookup selections update and clear their stable value and display label together", async () => {
  const filterContextModule = (await import(
    "./cylinder-purchase-report.filter-context"
  ).catch(() => null)) as Record<string, unknown> | null;

  assert.ok(filterContextModule);
  if (!filterContextModule) return;

  const applySelection =
    filterContextModule.applyReportLookupSelection as ApplySelection;
  assert.equal(typeof applySelection, "function");

  const initial: AppliedFilterContext = {
    startDate: "2026-06-23",
    endDate: "2026-07-22",
    branchId: 1,
    branchLabel: "Main Branch (B01)",
  };
  const selected = applySelection(initial, "customers", {
    value: "C-001",
    label: "Alpha Store",
    code: "C-001",
  });

  assert.deepEqual(selected, {
    ...initial,
    customerCode: "C-001",
    customerLabel: "Alpha Store (C-001)",
  });
  assert.deepEqual(applySelection(selected, "customers"), initial);
});

test("numeric lookup selections preserve labels and reject invalid identifiers", async () => {
  const filterContextModule = (await import(
    "./cylinder-purchase-report.filter-context"
  ).catch(() => null)) as Record<string, unknown> | null;

  assert.ok(filterContextModule);
  if (!filterContextModule) return;

  const applySelection =
    filterContextModule.applyReportLookupSelection as ApplySelection;
  const initial: AppliedFilterContext = {
    startDate: "2026-06-23",
    endDate: "2026-07-22",
  };

  assert.deepEqual(
    applySelection(initial, "products", {
      value: "11",
      label: "LPG 11KG",
      code: "LPG-11",
    }),
    {
      ...initial,
      productId: 11,
      productLabel: "LPG 11KG (LPG-11)",
    },
  );
  assert.deepEqual(
    applySelection(
      { ...initial, salesmanId: 7, salespersonLabel: "Ana (S07)" },
      "salespeople",
      { value: "not-an-id", label: "Invalid" },
    ),
    initial,
  );
});
