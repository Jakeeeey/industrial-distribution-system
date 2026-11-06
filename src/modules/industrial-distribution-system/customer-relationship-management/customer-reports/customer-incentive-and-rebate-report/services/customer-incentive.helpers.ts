// ============================================================
// customer-incentive.helpers.ts
// Pure, side-effect-free utilities. No fetch, no React, no state.
// ============================================================

import type {
  AppliedFilterContext,
  ClaimStatus,
} from "../types/customer-incentive.types";
import {
  CLAIM_STATUS_LABELS,
  DEFAULT_ELIGIBLE_SIZE_KG,
  VOID_MEMO_STATUSES,
} from "../types/customer-incentive.types";

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
 * Strips the time component from any date-bearing string without
 * reinterpreting it in another zone.
 */
export function dateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match ? match[1] : "";
}

/**
 * A quarter-to-date window is the natural default for a rebate review, so
 * the opening view already matches how the scheme is assessed.
 */
export function getCurrentQuarterRange(
  now: Date = new Date()
): Pick<AppliedFilterContext, "startDate" | "endDate"> {
  const today = reportCalendarDate(now);
  const anchor = new Date(`${today}T00:00:00Z`);
  const month = anchor.getUTCMonth();
  const firstQuarterMonth = month - (month % 3);
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), firstQuarterMonth, 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: today };
}

export type ReportPeriodPreset =
  | "thisQuarter"
  | "lastQuarter"
  | "thisMonth"
  | "last30"
  | "yearToDate";

/**
 * One-click reporting windows, resolved against the Manila calendar. A closed
 * quarter is offered alongside the open one because a claim can only be
 * settled for a period that has finished.
 */
export function getPeriodPreset(
  preset: ReportPeriodPreset,
  now: Date = new Date()
): Pick<AppliedFilterContext, "startDate" | "endDate"> {
  const today = reportCalendarDate(now);
  const anchor = new Date(`${today}T00:00:00Z`);
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();

  const iso = (date: Date): string => date.toISOString().slice(0, 10);
  const firstOfMonth = (y: number, m: number): Date => new Date(Date.UTC(y, m, 1));
  const firstQuarterMonth = month - (month % 3);

  switch (preset) {
    case "last30":
      // 29 days back is a 30-day window with both ends inclusive.
      return {
        startDate: iso(new Date(anchor.getTime() - 29 * 86_400_000)),
        endDate: today,
      };
    case "thisMonth":
      return { startDate: iso(firstOfMonth(year, month)), endDate: today };
    case "thisQuarter":
      return { startDate: iso(firstOfMonth(year, firstQuarterMonth)), endDate: today };
    case "lastQuarter":
      // Day 0 of the current quarter is the previous quarter's last day; the
      // negative month index rolls the year over in the first quarter.
      return {
        startDate: iso(firstOfMonth(year, firstQuarterMonth - 3)),
        endDate: iso(new Date(Date.UTC(year, firstQuarterMonth, 0))),
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
  if (typeof value === "string")
    return value.trim() === "1" || value.toLowerCase() === "true";
  if (Array.isArray(value)) return value.some(isTruthyFlag);
  // A sibling report has met a bit(1) column delivered as { data: [1] }. An
  // object left unread would look "not replaced" and let a reprint keep
  // earning beside the invoice it replaced.
  if (value && typeof value === "object") {
    const data = (value as { data?: unknown }).data;
    return data === undefined ? false : isTruthyFlag(data);
  }
  return false;
}

export function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * A voided memo is compared case-insensitively: the enum stores DELETED while
 * Directus has been seen to return either case, and a guard that silently
 * never matches would let a withdrawn claim keep its approved amount.
 */
export function isVoidedMemoStatus(value: string | null | undefined): boolean {
  return VOID_MEMO_STATUSES.has(String(value ?? "").trim().toUpperCase());
}

/**
 * A sales document counts toward the incentive unless it was cancelled or is
 * a replacement print. Voided records must never earn, so this is the §4 rule
 * applied to every invoice and return line.
 */
export function isAcceptedDocument(
  status: string | null | undefined,
  isReplaced?: unknown
): boolean {
  if (isTruthyFlag(isReplaced)) return false;
  const normalized = normalizeStatus(status);
  return normalized !== "cancelled" && normalized !== "voided";
}

/**
 * customers_memo.status -> the §6 business state. DELETED is voided and is
 * dropped upstream before this is ever called, so it has no label.
 */
const MEMO_STATUS_MAP: Record<string, ClaimStatus> = {
  "for approval": "FOR_REVIEW",
  approved: "APPROVED",
  "partially applied": "PARTIALLY_RELEASED",
  applied: "RELEASED",
  rejected: "REJECTED",
};

export function toClaimStatus(
  status: string | null | undefined
): ClaimStatus | null {
  return MEMO_STATUS_MAP[normalizeStatus(status)] ?? null;
}

export function claimStatusLabel(status: ClaimStatus | "NO_CLAIM"): string {
  if (status === "NO_CLAIM") return "No claim";
  return CLAIM_STATUS_LABELS[status];
}

/**
 * Money already settled against a memo. `applied_amount` is the ledger figure;
 * the transmittal rows are the payment trail that explains it.
 */
export function releasedAmountOf(
  appliedAmount: number,
  transmittalTotal: number
): number {
  // Some memos are settled without ever writing applied_amount, so the
  // transmittal total is used as a floor rather than being ignored.
  return Math.max(appliedAmount, transmittalTotal);
}

/**
 * The §6 state a claim is actually in, given what has been paid against it.
 *
 * `customers_memo.status` is an enum that does include 'PARTIALLY APPLIED' and
 * 'APPLIED', but nothing in the application writes them: the memo flow only
 * ever sets 'FOR APPROVAL' then 'APPROVED', and settlement is recorded in
 * `applied_amount` and the transmittal rows instead. Reading the column alone
 * would therefore leave Released and Partially Released unreachable and keep
 * showing a fully paid claim as Approved, one column away from its own
 * released amount. Only an approved claim advances, and no state is ever
 * downgraded, so a memo the source already calls APPLIED stays Released even if
 * its money has not been traced yet.
 */
export function deriveClaimStatus(
  status: ClaimStatus,
  approvedAmount: number,
  releasedAmount: number
): ClaimStatus {
  if (status !== "APPROVED") return status;
  if (approvedAmount > 0 && releasedAmount >= approvedAmount - 0.005) {
    return "RELEASED";
  }
  if (releasedAmount > 0) return "PARTIALLY_RELEASED";
  return "APPROVED";
}

export function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round2(value: number): number {
  return Math.round(toNumber(value) * 100) / 100;
}

/** Division guard for the per-kg derived figures. */
export function safeRatio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

/**
 * Resolves the eligible cylinder size, falling back to the 11 kg scheme.
 */
export function resolveSizeKg(value: number | undefined): number {
  const size = toNumber(value);
  return size > 0 ? size : DEFAULT_ELIGIBLE_SIZE_KG;
}

/**
 * Reads the cylinder size out of `categories.category_name`.
 *
 * The categories table has no numeric size column, and serialized cylinder
 * products commonly carry 0 in `products.product_weight`, so the size is
 * encoded in the category name instead ("LPG 11KG", "LPG 1.4KG"). Only an
 * explicit "<n>KG" figure is accepted; anything else returns null rather than
 * guessing a size. Same rule the customer order and consumption report uses.
 */
export function parseCategorySizeKg(
  categoryName: string | null | undefined
): number | null {
  const match = /(\d+(?:\.\d+)?)\s*kgs?\b/i.exec(String(categoryName ?? ""));
  if (!match) return null;
  const size = Number.parseFloat(match[1] ?? "");
  return Number.isFinite(size) && size > 0 ? size : null;
}

/**
 * How the eligible volume is described wherever a reader sees it.
 *
 * With no category chosen the bare kilogram figure is the whole rule. Once
 * categories are chosen they are the rule — and each one states its own size in
 * its name, which is why the filter offers only those it can read a size from.
 * A long multi-pick is counted rather than listed, because these strings appear
 * in a KPI chip and a PDF footer.
 */
export function eligibleSizeLabel(
  filters: Pick<
    AppliedFilterContext,
    "categoryIds" | "categoryLabels" | "sizeKg"
  >
): string {
  const ids = filters.categoryIds ?? [];
  if (ids.length === 0) {
    return filters.sizeKg ? `${filters.sizeKg} kg` : "All cylinders";
  }
  // Paired positionally so a picker that only kept the ids still names the
  // scope by id rather than falling back to a size it did not use.
  const labels = ids.map(
    (id, index) => (filters.categoryLabels ?? [])[index] || `Category ${id}`
  );
  if (labels.length === 1) return labels[0];
  if (labels.length <= 3) return labels.join(", ");
  return `${labels[0]} +${labels.length - 1} more`;
}

/**
 * Compares two filter selections as sets. A multi-select appends in the order
 * the reader clicked, so re-ordering a selection is not a change to what is
 * read and must not flag the draft as pending.
 */
export function isSameSelection(
  a: readonly (string | number)[] | undefined,
  b: readonly (string | number)[] | undefined
): boolean {
  const left = [...new Set((a ?? []).map(String))].sort();
  const right = [...new Set((b ?? []).map(String))].sort();
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

// ------------------------------------------------------------
// Display formatting
// ------------------------------------------------------------

const unitsFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 3,
});

const kgFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const rateFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatQty(value: number | null | undefined): string {
  return unitsFormatter.format(toNumber(value));
}

export function formatKg(value: number | null | undefined): string {
  return kgFormatter.format(toNumber(value));
}

export function formatAmount(value: number | null | undefined): string {
  return currencyFormatter.format(toNumber(value));
}

/** Peso-per-kilogram rate, prefixed so a derived rate reads differently. */
export function formatRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${rateFormatter.format(value)}/kg`;
}

export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatReportDate(value: string | null | undefined): string {
  const iso = dateOnly(value);
  if (!iso) return "—";
  const parsed = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(parsed);
}

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

export function buildReportFilename(
  prefix: string,
  filters: AppliedFilterContext,
  extension: string
): string {
  const cutoff = (
    filters.endDate || reportCalendarDate(new Date())
  ).replace(/[^0-9]/g, "");
  // The category names go first because two industrial categories can share a
  // size ("LPG 14KG" and "CO2 14KG"), and an export named only by kg would not
  // say which answer it carries. A multi-pick is named by its first entry plus
  // the count, because a filename cannot hold a list.
  const count = filters.categoryIds?.length ?? 0;
  const first =
    (filters.categoryLabels ?? []).find(Boolean) ??
    (count > 0 ? `category-${filters.categoryIds?.[0]}` : "");
  const scope = first
    ? `${first
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")}${count > 1 ? `_plus-${count - 1}-more` : ""}`
    : filters.sizeKg ? `${resolveSizeKg(filters.sizeKg)}kg` : "all_cylinders";
  return `${prefix}_${cutoff}_${scope}.${extension}`;
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
