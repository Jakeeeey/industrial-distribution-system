import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReportFilename,
  claimStatusLabel,
  dateOnly,
  deriveClaimStatus,
  eligibleSizeLabel,
  getCurrentQuarterRange,
  getPeriodPreset,
  isAbortError,
  isAcceptedDocument,
  isSameSelection,
  isTruthyFlag,
  isVoidedMemoStatus,
  parseCategorySizeKg,
  releasedAmountOf,
  reportCalendarDate,
  resolveSizeKg,
  round2,
  safeRatio,
  safeSheetName,
  toClaimStatus,
} from "./customer-incentive.helpers";

test("reportCalendarDate uses Manila, not the host zone", () => {
  // 16:00 UTC is already 00:00 the next day in Asia/Manila (UTC+8).
  assert.equal(reportCalendarDate(new Date("2026-10-14T16:00:00Z")), "2026-10-15");
  assert.equal(reportCalendarDate(new Date("2026-10-14T15:59:59Z")), "2026-10-14");
});

test("getCurrentQuarterRange opens on the quarter being assessed", () => {
  const range = getCurrentQuarterRange(new Date("2026-07-05T04:00:00Z"));
  assert.equal(range.startDate, "2026-07-01");
  assert.equal(range.endDate, "2026-07-05");
});

test("getPeriodPreset lastQuarter closes the previous quarter exactly", () => {
  const midYear = getPeriodPreset("lastQuarter", new Date("2026-07-05T04:00:00Z"));
  assert.deepEqual(midYear, { startDate: "2026-04-01", endDate: "2026-06-30" });

  // The first quarter of a year must roll back into the previous year.
  const earlyYear = getPeriodPreset("lastQuarter", new Date("2026-02-10T04:00:00Z"));
  assert.deepEqual(earlyYear, { startDate: "2025-10-01", endDate: "2025-12-31" });
});

test("getPeriodPreset last30 is inclusive of 30 Manila days", () => {
  const range = getPeriodPreset("last30", new Date("2026-10-14T04:00:00Z"));
  assert.equal(range.endDate, "2026-10-14");
  assert.equal(range.startDate, "2026-09-15");
});

test("getPeriodPreset resolves the month and year windows", () => {
  const now = new Date("2026-10-23T04:00:00Z");
  assert.deepEqual(getPeriodPreset("thisMonth", now), {
    startDate: "2026-10-01",
    endDate: "2026-10-23",
  });
  assert.deepEqual(getPeriodPreset("thisQuarter", now), {
    startDate: "2026-10-01",
    endDate: "2026-10-23",
  });
  assert.deepEqual(getPeriodPreset("yearToDate", now), {
    startDate: "2026-01-01",
    endDate: "2026-10-23",
  });
});

test("toClaimStatus maps only the statuses the memo enum actually holds", () => {
  assert.equal(toClaimStatus("FOR APPROVAL"), "FOR_REVIEW");
  assert.equal(toClaimStatus("approved"), "APPROVED");
  assert.equal(toClaimStatus("Partially Applied"), "PARTIALLY_RELEASED");
  assert.equal(toClaimStatus("APPLIED"), "RELEASED");
  assert.equal(toClaimStatus("rejected"), "REJECTED");
  // Anything else is reported, never mapped to the nearest-looking state.
  assert.equal(toClaimStatus("PAID"), null);
  assert.equal(toClaimStatus(null), null);
});

test("claimStatusLabel names the absence of a claim", () => {
  assert.equal(claimStatusLabel("NO_CLAIM"), "No claim");
  assert.equal(claimStatusLabel("PARTIALLY_RELEASED"), "Partially Released");
});

test("isVoidedMemoStatus matches the enum regardless of case", () => {
  // A guard that never fires would let a withdrawn claim keep its money.
  assert.equal(isVoidedMemoStatus("DELETED"), true);
  assert.equal(isVoidedMemoStatus("deleted"), true);
  assert.equal(isVoidedMemoStatus(" APPROVED "), false);
  assert.equal(isVoidedMemoStatus(null), false);
});

test("isAcceptedDocument excludes cancelled, voided and replaced documents", () => {
  assert.equal(isAcceptedDocument("POSTED"), true);
  assert.equal(isAcceptedDocument("cancelled"), false);
  assert.equal(isAcceptedDocument("VOIDED"), false);
  assert.equal(isAcceptedDocument("POSTED", true), false);
});

test("isTruthyFlag coerces every MySQL bit(1) shape", () => {
  assert.equal(isTruthyFlag(true), true);
  assert.equal(isTruthyFlag(1), true);
  assert.equal(isTruthyFlag("1"), true);
  assert.equal(isTruthyFlag("true"), true);
  assert.equal(isTruthyFlag(0), false);
  assert.equal(isTruthyFlag(null), false);
  // The shape a sibling report met on a bit(1) column; unread, a reprint would
  // look "not replaced" and keep earning beside the document it replaced.
  assert.equal(isTruthyFlag({ data: [1] }), true);
  assert.equal(isTruthyFlag({ data: [0] }), false);
  assert.equal(isTruthyFlag({ data: false }), false);
  assert.equal(isTruthyFlag({}), false);
  assert.equal(isTruthyFlag([1]), true);
});

test("releasedAmountOf falls back to the transmittal trail", () => {
  // Some memos settle without ever writing applied_amount.
  assert.equal(releasedAmountOf(0, 1500), 1500);
  assert.equal(releasedAmountOf(1200, 500), 1200);
});

test("resolveSizeKg only falls back when no usable size was given", () => {
  assert.equal(resolveSizeKg(undefined), 11);
  assert.equal(resolveSizeKg(0), 11);
  assert.equal(resolveSizeKg(-5), 11);
  assert.equal(resolveSizeKg(45), 45);
});

test("parseCategorySizeKg reads only an explicit kilogram figure", () => {
  assert.equal(parseCategorySizeKg("LPG 11KG"), 11);
  assert.equal(parseCategorySizeKg("LPG 1.4KG"), 1.4);
  assert.equal(parseCategorySizeKg("Acetylene 14 kg"), 14);
  assert.equal(parseCategorySizeKg("LPG 11"), null, "no unit is not a size");
  assert.equal(parseCategorySizeKg("Regulators"), null);
  assert.equal(parseCategorySizeKg(null), null);
});

test("eligibleSizeLabel names the categories that scoped the report", () => {
  assert.equal(eligibleSizeLabel({ sizeKg: 11 }), "11 kg");
  assert.equal(
    eligibleSizeLabel({ categoryIds: [500], categoryLabels: ["LPG 11KG"], sizeKg: 11 }),
    "LPG 11KG"
  );
  assert.equal(
    eligibleSizeLabel({
      categoryIds: [500, 501],
      categoryLabels: ["LPG 11KG", "LPG 45KG"],
      sizeKg: 11,
    }),
    "LPG 11KG, LPG 45KG"
  );
  // An id with no label still says what was filtered, not nothing.
  assert.equal(eligibleSizeLabel({ categoryIds: [500], sizeKg: 45 }), "Category 500");
  assert.equal(
    eligibleSizeLabel({
      categoryIds: [500, 501, 502, 503],
      categoryLabels: ["A", "B", "C", "D"],
      sizeKg: 11,
    }),
    "A +3 more"
  );
});

test("isSameSelection compares a multi-pick as a set", () => {
  assert.ok(isSameSelection([1, 2], [2, 1]), "re-ordering is not a new filter");
  assert.ok(isSameSelection(undefined, []), "absent and empty both mean everything");
  assert.ok(isSameSelection(undefined, undefined));
  assert.ok(!isSameSelection([1], [1, 2]));
  assert.ok(!isSameSelection([1], []), "dropping the last pick IS a change");
  // Codes are text and ids are numbers; a text draft against a parsed list
  // must still read as the same selection.
  assert.ok(isSameSelection(["11", "12"], [11, 12]));
});

test("round2 and safeRatio keep derived money stable", () => {  assert.equal(round2(45.454545), 45.45);
  assert.equal(safeRatio(100, 0), 0);
  assert.equal(safeRatio(100, 4), 25);
});

test("dateOnly never reinterprets the value in another zone", () => {
  assert.equal(dateOnly("2026-07-10T18:30:00Z"), "2026-07-10");
  assert.equal(dateOnly("2026-07-10"), "2026-07-10");
  assert.equal(dateOnly(null), "");
});

test("buildReportFilename embeds the cutoff and the eligible size", () => {
  const name = buildReportFilename(
    "customer_incentive",
    { startDate: "2026-07-01", endDate: "2026-09-30", sizeKg: 11 },
    "xlsx"
  );
  assert.equal(name, "customer_incentive_20260930_11kg.xlsx");
});

test("buildReportFilename says which category a scoped export covers", () => {
  const name = buildReportFilename(
    "customer_incentive",
    {
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      sizeKg: 11,
      categoryIds: [500],
      categoryLabels: ["LPG 11 KG!"],
    },
    "xlsx"
  );
  assert.equal(name, "customer_incentive_20260930_LPG_11_KG.xlsx");
});

test("buildReportFilename names a multi-pick by its first category plus the count", () => {
  const name = buildReportFilename(
    "customer_incentive",
    {
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      sizeKg: 11,
      categoryIds: [500, 501, 502],
      categoryLabels: ["LPG 11KG", "LPG 45KG", "CO2 14KG"],
    },
    "xlsx"
  );
  // A filename cannot hold a list, but it must not imply a single category
  // either — two categories can share a size.
  assert.equal(name, "customer_incentive_20260930_LPG_11KG_plus-2-more.xlsx");
});

test("safeSheetName strips illegal characters and de-duplicates", () => {
  const taken = new Set<string>();
  assert.equal(safeSheetName("Claims [2026]", taken), "Claims  2026");
  assert.equal(safeSheetName("Claims [2026]", taken), "Claims  2026 2");
  assert.equal(safeSheetName("", taken), "Sheet");
});

test("isAbortError recognises a cancelled request", () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(isAbortError(controller.signal.reason), true);
  assert.equal(isAbortError(new Error("boom")), false);
});

test("deriveClaimStatus follows the money without downgrading the source", () => {
  assert.equal(deriveClaimStatus("APPROVED", 4000, 0), "APPROVED");
  assert.equal(deriveClaimStatus("APPROVED", 4000, 1500), "PARTIALLY_RELEASED");
  assert.equal(deriveClaimStatus("APPROVED", 4000, 4000), "RELEASED");
  // Settlement running ahead of approval is still a released claim; the
  // OVER_RELEASED exception is what reports the gap.
  assert.equal(deriveClaimStatus("APPROVED", 1000, 1200), "RELEASED");
  // A source that already records the release keeps it, money traced or not.
  assert.equal(deriveClaimStatus("RELEASED", 4000, 0), "RELEASED");
  assert.equal(
    deriveClaimStatus("PARTIALLY_RELEASED", 4000, 0),
    "PARTIALLY_RELEASED"
  );
  // Never approved, so it cannot be released whatever the ledger says.
  assert.equal(deriveClaimStatus("FOR_REVIEW", 4000, 4000), "FOR_REVIEW");
  assert.equal(deriveClaimStatus("REJECTED", 4000, 100), "REJECTED");
  // A zero-approved memo must not read as Released off the tolerance.
  assert.equal(deriveClaimStatus("APPROVED", 0, 0), "APPROVED");
});
