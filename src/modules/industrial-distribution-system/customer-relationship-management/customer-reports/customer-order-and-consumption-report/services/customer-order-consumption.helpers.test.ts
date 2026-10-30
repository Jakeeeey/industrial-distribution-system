import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReportFilename,
  computeReturnRate,
  dateOnly,
  formatGeneratedAt,
  formatKg,
  formatKgCompact,
  formatKgExact,
  formatPercent,
  formatQty,
  formatReportDate,
  formatYearMonth,
  getPeriodPreset,
  getRollingThirtyDayRange,
  isAbortError,
  isAcceptedDocument,
  isSameSelection,
  isTruthyFlag,
  monthKey,
  normalizeStatus,
  reportCalendarDate,
  safeRatio,
  safeSheetName,
  selectionSet,
  toNumber,
  zipSelection,
} from "./customer-order-consumption.helpers";

test("reportCalendarDate uses Manila, not the host zone", () => {
  // 16:00 UTC is already 00:00 the next day in Asia/Manila (UTC+8).
  assert.equal(reportCalendarDate(new Date("2026-10-14T16:00:00Z")), "2026-10-15");
  assert.equal(reportCalendarDate(new Date("2026-10-14T15:59:59Z")), "2026-10-14");
});

test("getRollingThirtyDayRange is inclusive of 30 Manila days", () => {
  const range = getRollingThirtyDayRange(new Date("2026-10-14T04:00:00Z"));
  assert.equal(range.endDate, "2026-10-14");
  assert.equal(range.startDate, "2026-09-15");
});

test("getPeriodPreset resolves every window against the Manila calendar", () => {
  const now = new Date("2026-10-23T04:00:00Z");

  assert.deepEqual(getPeriodPreset("last30", now), {
    startDate: "2026-09-24",
    endDate: "2026-10-23",
  });
  assert.deepEqual(getPeriodPreset("thisMonth", now), {
    startDate: "2026-10-01",
    endDate: "2026-10-23",
  });
  assert.deepEqual(getPeriodPreset("lastMonth", now), {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  });
  // October sits in Q4, which opens on its own month.
  assert.deepEqual(getPeriodPreset("thisQuarter", now), {
    startDate: "2026-10-01",
    endDate: "2026-10-23",
  });
  assert.deepEqual(getPeriodPreset("yearToDate", now), {
    startDate: "2026-01-01",
    endDate: "2026-10-23",
  });
});

test("getPeriodPreset rolls the year over for a January caller", () => {
  const now = new Date("2026-01-05T04:00:00Z");

  assert.deepEqual(getPeriodPreset("lastMonth", now), {
    startDate: "2025-12-01",
    endDate: "2025-12-31",
  });
  assert.deepEqual(getPeriodPreset("thisQuarter", now), {
    startDate: "2026-01-01",
    endDate: "2026-01-05",
  });
  assert.deepEqual(getPeriodPreset("yearToDate", now), {
    startDate: "2026-01-01",
    endDate: "2026-01-05",
  });
});

test("dateOnly and monthKey strip without reinterpreting the zone", () => {
  assert.equal(dateOnly("2026-10-14T23:59:59"), "2026-10-14");
  assert.equal(dateOnly("2026-10-14"), "2026-10-14");
  assert.equal(dateOnly(null), "");
  assert.equal(dateOnly("not a date"), "");
  assert.equal(monthKey("2026-10-14T23:59:59"), "2026-10");
  assert.equal(monthKey(""), "");
});

test("isTruthyFlag covers every shape a MySQL bit(1) arrives as", () => {
  for (const value of [true, 1, "1", "true", "True", "TRUE"]) {
    assert.equal(isTruthyFlag(value), true, String(value));
  }
  for (const value of [false, 0, "0", "false", null, undefined, "", "yes"]) {
    assert.equal(isTruthyFlag(value), false, String(value));
  }
});

test("normalizeStatus and isAcceptedDocument match free-text statuses", () => {
  assert.equal(normalizeStatus("  CancelLED "), "cancelled");
  assert.equal(isAcceptedDocument("Posted"), true);
  assert.equal(isAcceptedDocument("CANCELLED"), false);
  assert.equal(isAcceptedDocument("voided"), false);
  // A replacement reprint is the same sale printed twice.
  assert.equal(isAcceptedDocument("posted", true), false);
  assert.equal(isAcceptedDocument("posted", 0), true);
});

test("toNumber never lets a null or NaN reach the totals", () => {
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber(Number.NaN), 0);
  assert.equal(toNumber("12.5"), 12.5);
  assert.equal(toNumber("abc"), 0);
});

test("computeReturnRate uses the gross basis and guards division", () => {
  assert.equal(computeReturnRate(2, 8), 25);
  assert.equal(computeReturnRate(9, 8), 100);
  assert.equal(computeReturnRate(5, 0), 0);
  assert.equal(safeRatio(10, 0), 0);
  assert.equal(safeRatio(10, 4), 2.5);
});

test("formatters keep kg, qty, percent and dates stable", () => {
  assert.equal(formatKg(1234.5), "1,234.500 kg");
  assert.equal(formatKg(null), "0.000 kg");
  // Exports keep the padded 3 decimals; the screen drops padding it does not
  // need, so "1,100.000" net kg reads as "1,100" without losing 0.001 detail.
  assert.equal(formatKgExact(1234.5), "1,234.500");
  assert.equal(formatKgCompact(1234.5), "1,234.5");
  assert.equal(formatKgCompact(1100), "1,100");
  assert.equal(formatKgCompact(1.4), "1.4");
  assert.equal(formatKgCompact(0.0005), "0.001");
  assert.equal(formatKgCompact(null), "0");
  assert.equal(formatQty(12), "12");
  assert.equal(formatPercent(33.333), "33.3%");
  assert.equal(formatYearMonth("2026-01"), "Jan 2026");

  // The exact ordering is ICU's, but a report date must never carry a time.
  const dated = formatReportDate("2026-01-05T12:00:00");
  assert.match(dated, /2026/);
  assert.doesNotMatch(dated, /12:00|:\d\d/);
  assert.equal(formatReportDate(null), "—");
  assert.equal(formatGeneratedAt("nonsense"), "nonsense");
});

test("buildReportFilename embeds the cutoff and the channel scope", () => {
  const name = buildReportFilename(
    "customer_order_consumption",
    { startDate: "2026-01-01", endDate: "2026-01-31", channel: "LPG" },
    "xlsx"
  );
  assert.equal(name, "customer_order_consumption_20260131_lpg.xlsx");
  const unscoped = buildReportFilename(
    "report",
    { startDate: "2026-01-01", endDate: "2026-02-03" },
    "pdf"
  );
  assert.equal(unscoped, "report_20260203.pdf");
});

test("safeSheetName stays legal and unique under Excel's rules", () => {
  const taken = new Set<string>();
  const first = safeSheetName("Demand [by] Customer: *?", taken);
  assert.doesNotMatch(first, /[[\]:*?/\\]/);
  assert.equal(taken.has(first), true);

  const second = safeSheetName(first, taken);
  assert.notEqual(second, first);
  assert.ok(second.length <= 31);

  const long = safeSheetName("A".repeat(60), new Set());
  assert.equal(long.length, 31);
  assert.equal(safeSheetName("[]", new Set()), "Sheet");
});

test("isAbortError identifies cancellations only", () => {
  assert.equal(isAbortError(new Error("boom")), false);
  assert.equal(isAbortError(Object.assign(new Error("x"), { name: "AbortError" })), true);
  assert.equal(isAbortError(undefined), false);
});

test("selectionSet turns an empty picker into no gate", () => {
  assert.equal(selectionSet(undefined), null);
  assert.equal(selectionSet([]), null);
  assert.deepEqual([...(selectionSet([10, 11]) ?? new Set())], [10, 11]);
  assert.equal(selectionSet<string>(["C-001"])?.has("C-002"), false);
});

test("isSameSelection ignores click order and treats absent as empty", () => {
  assert.equal(isSameSelection([10, 11], [11, 10]), true);
  assert.equal(isSameSelection(undefined, []), true);
  assert.equal(isSameSelection([], undefined), true);
  assert.equal(isSameSelection([10], [10, 11]), false);
  assert.equal(isSameSelection([10, 11], [10, 12]), false);
});

test("zipSelection keeps a label for every id it can, else shows the id", () => {
  assert.deepEqual(zipSelection([10, 11], ["Manila", "Cebu"]), [
    { value: 10, label: "Manila" },
    { value: 11, label: "Cebu" },
  ]);
  assert.deepEqual(zipSelection([10, 11], ["Manila"]), [
    { value: 10, label: "Manila" },
    { value: 11, label: "11" },
  ]);
  assert.deepEqual(zipSelection(undefined, undefined), []);
});
