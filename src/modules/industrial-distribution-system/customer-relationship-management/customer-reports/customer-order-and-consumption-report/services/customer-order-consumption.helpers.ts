// ============================================================
// customer-order-consumption.helpers.ts
// Pure, side-effect-free utilities. No fetch, no React, no state.
// ============================================================

import type { AppliedFilterContext } from "../types/customer-order-consumption.types";

// The whole deployment reports in Philippine time; using the server's
// local zone would shift the cutoff for anyone hosting outside Asia.
const REPORT_TIME_ZONE = "Asia/Manila";

// ------------------------------------------------------------
// Date helpers
// ------------------------------------------------------------

/**
 * Converts an instant to a YYYY-MM-DD string in the report time zone.
 * Built from formatToParts + Date.UTC so the result never depends on the
 * host machine's zone.
 */
export function reportCalendarDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const pick = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const shifted = new Date(Date.UTC(pick("year"), pick("month") - 1, pick("day")));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Strips the time component from any date-bearing string ("2026-10-14T23:59:59"
 * or "2026-10-14") without reinterpreting it in another zone.
 */
export function dateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match ? match[1] : "";
}

/**
 * Month bucket ("YYYY-MM") for a date-bearing string, used for the trend.
 */
export function monthKey(value: string | null | undefined): string {
  const iso = dateOnly(value);
  return iso ? iso.slice(0, 7) : "";
}

/**
 * Default 30-day rolling window ending today (Manila), inclusive.
 */
export function getRollingThirtyDayRange(now: Date = new Date()): AppliedFilterContext {
  const today = reportCalendarDate(now);
  const anchor = new Date(`${today}T00:00:00Z`);
  const start = new Date(anchor);
  start.setUTCDate(start.getUTCDate() - 29);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: today,
  };
}

export type ReportPeriodPreset =
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "yearToDate";

/**
 * One-click reporting windows, resolved against the Manila calendar so the
 * answer does not depend on where the server runs. Boundaries are inclusive
 * plain dates, exactly what the filter schema accepts.
 */
export function getPeriodPreset(
  preset: ReportPeriodPreset,
  now: Date = new Date()
): AppliedFilterContext {
  if (preset === "last30") return getRollingThirtyDayRange(now);

  const today = reportCalendarDate(now);
  const anchor = new Date(`${today}T00:00:00Z`);
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth(); // 0-based

  const iso = (date: Date): string => date.toISOString().slice(0, 10);
  const firstOfMonth = (y: number, m: number): Date => new Date(Date.UTC(y, m, 1));

  switch (preset) {
    case "thisMonth":
      return { startDate: iso(firstOfMonth(year, month)), endDate: today };
    case "lastMonth":
      // Day 0 of the current month is the last day of the previous one; the
      // negative month index rolls the year over for January.
      return {
        startDate: iso(firstOfMonth(year, month - 1)),
        endDate: iso(new Date(Date.UTC(year, month, 0))),
      };
    case "thisQuarter":
      return {
        startDate: iso(firstOfMonth(year, month - (month % 3))),
        endDate: today,
      };
    case "yearToDate":
      return { startDate: iso(firstOfMonth(year, 0)), endDate: today };
  }
}

// ------------------------------------------------------------
// Directus payload coercion
// ------------------------------------------------------------

/**
 * MySQL `bit(1)` columns arrive from Directus as true/false, 1/0 or "1".
 * Treating anything non-truthy as false keeps flags from silently inverting.
 */
export function isTruthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value.trim() === "1" || value.toLowerCase() === "true";
  return false;
}

/**
 * Status columns on sales_return / sales_invoice are free-text varchar, so
 * comparison is trimmed + lower-cased rather than assuming enum casing.
 */
export function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * A document counts toward reporting unless it was explicitly cancelled or
 * is a replacement print. Matches the predicate the production
 * v_bia_cylinder_purchases view applies.
 */
export function isAcceptedDocument(
  status: string | null | undefined,
  isReplaced?: unknown
): boolean {
  if (isTruthyFlag(isReplaced)) return false;
  const normalized = normalizeStatus(status);
  return normalized !== "cancelled" && normalized !== "voided";
}

export function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ------------------------------------------------------------
// KG formatting helpers
// ------------------------------------------------------------

// Two kg formatters, deliberately. An export is an audit record and keeps a
// fixed 3 decimals; on screen the trailing ".000" made every whole cylinder
// figure unreadable, so display drops zeros it does not need.
const kgExactFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const kgDisplayFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const qtyFormatter = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 3 });

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

/** Formats a decimal KG value with 3 decimals and the unit suffix. */
export function formatKg(value: number | null | undefined): string {
  return `${kgExactFormatter.format(toNumber(value))} kg`;
}

/** Formats a KG value to 3 fixed decimals, for exports and audit text. */
export function formatKgExact(value: number | null | undefined): string {
  return kgExactFormatter.format(toNumber(value));
}

/** Formats a KG value for on-screen cells and charts, without padding zeros. */
export function formatKgCompact(value: number | null | undefined): string {
  return kgDisplayFormatter.format(toNumber(value));
}

/** Formats a piece count, dropping trailing zeros for whole numbers. */
export function formatQty(value: number | null | undefined): string {
  return qtyFormatter.format(toNumber(value));
}

/** Formats a peso amount using the shared currency style. */
export function formatAmount(value: number | null | undefined): string {
  return currencyFormatter.format(toNumber(value));
}

/** Formats a ratio already expressed in percent with one decimal. */
export function formatPercent(value: number | null | undefined): string {
  return `${toNumber(value).toFixed(1)}%`;
}

// ------------------------------------------------------------
// Business-rule helpers
// ------------------------------------------------------------

/**
 * Return rate on a GROSS basis: returned / gross * 100, clamped to [0,100].
 * Gross is used so the rate stays meaningful when returns exceed sales in a
 * partial period.
 */
export function computeReturnRate(returned: number, gross: number): number {
  if (gross <= 0) return 0;
  return Math.min(100, (returned / gross) * 100);
}

/** Division guard for "average order size"-style metrics. */
export function safeRatio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

/**
 * Builds the YYYY-MM label used by chart axes.
 */
export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/**
 * Human date for the drawer and exports; falls back to the raw string when
 * the source value is not a parseable date.
 */
export function formatReportDate(value: string | null | undefined): string {
  const iso = dateOnly(value);
  if (!iso) return "—";
  const parsed = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(parsed);
}

/**
 * Timestamp shown in the header / export footers.
 */
export function formatGeneratedAt(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: REPORT_TIME_ZONE,
  }).format(parsed);
}

// ------------------------------------------------------------
// Export naming
// ------------------------------------------------------------

/**
 * Deterministic report filename. The cutoff is embedded so re-downloads of
 * the same window sort together.
 */
export function buildReportFilename(
  prefix: string,
  filters: AppliedFilterContext,
  extension: string
): string {
  const cutoff = (filters.endDate || reportCalendarDate(new Date())).replace(/[^0-9]/g, "");
  const scope = filters.channel ? `_${filters.channel.toLowerCase()}` : "";
  return `${prefix}_${cutoff}${scope}.${extension}`;
}

/**
 * Excel caps sheet names at 31 characters and rejects duplicates and
 * []:*?/\ — this sanitises a label into a legal sheet name.
 */
export function safeSheetName(label: string, taken: Set<string>): string {
  const cleaned = label.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = cleaned;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${cleaned.slice(0, 28)} ${suffix}`;
    suffix += 1;
  }
  taken.add(candidate);
  return candidate;
}

// ------------------------------------------------------------
// Error classification
// ------------------------------------------------------------

/** True when `error` is an AbortError, i.e. the request was cancelled. */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

// ------------------------------------------------------------
// Multi-select filter helpers
// ------------------------------------------------------------

/**
 * An absent or empty selection means "everything", so the gates in the
 * channel passes only exist when the reader actually picked something.
 */
export function selectionSet<T extends string | number>(
  values?: readonly T[] | null
): Set<T> | null {
  if (!values || values.length === 0) return null;
  return new Set(values);
}

/**
 * Two selections are the same when they hold the same values, in any order.
 * Ordering is a UI artefact of the sequence someone clicked, not a change of
 * what gets read.
 */
export function isSameSelection(
  a: readonly (string | number)[] | undefined,
  b: readonly (string | number)[] | undefined
): boolean {
  if (a === b) return true;
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  const seen = new Set(left.map((value) => String(value)));
  return right.every((value) => seen.has(String(value)));
}

/**
 * Pairs an id list with its label list for the trigger button and chips.
 * Labels are positionally parallel, so a short list only decorates what it
 * can and falls back to the raw value.
 */
export function zipSelection<T extends string | number>(
  values: readonly T[] | undefined,
  labels: readonly string[] | undefined
): { value: T; label: string }[] {
  return (values ?? []).map((value, index) => ({
    value,
    label: labels?.[index] || String(value),
  }));
}
