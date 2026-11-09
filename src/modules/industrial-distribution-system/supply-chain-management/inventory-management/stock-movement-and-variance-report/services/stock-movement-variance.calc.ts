// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/services/stock-movement-variance.calc.ts
// ==============================================================================
// Calculation Engine for Stock Movement and Variance Report.
//
// Implements the approved business rule (spec §4):
//     Expected = opening + in − out
//     Variance = counted − expected
//
// Measurement rules that keep the arithmetic honest:
// - A committed count only governs a line when its cutoff falls inside the
//   reported period, and then the whole line is measured at that cutoff:
//   movements booked after the count are excluded from "in" and "out", because
//   comparing a mid-period count against a period-end expectation would report
//   later, unrelated movement as variance. They are still listed separately in
//   the drawer, so excluded stock is never mistaken for no stock.
// - That cutoff is read as Philippines wall clock, like the ledger timestamps.
//   Directus suffixes its naive datetime columns with a synthetic "Z", and an
//   8-hour-late cutoff quietly re-admits the post-count movement it should cut.
// - A count from an earlier period is shown as context only. Using it as the
//   period's count would publish the drift accumulated since that count —
//   including the count's own months — as this period's variance.
// - Physical Inventory documents restate the system balance by their variance;
//   they never contribute to "in" or "out".
// - Quantities reconcile in BASE units (qty × unit_of_measurement_count) so boxed
//   and loose products reconcile against the same ledger.
// - Documents voided after posting are excluded from every balance, because the
//   movements view does not apply the reversal itself.
// ==============================================================================

import type {
  RawCountLine,
  RawMovementRow,
  StockMovementVarianceFilters,
  StockMovementVarianceKpis,
  StockMovementVarianceRow,
  SupportingDocument,
} from "../types/stock-movement-variance.types";

const PH_OFFSET_MS = 8 * 60 * 60 * 1000; // Philippines is UTC+8 with no DST
const EOD_MS = 24 * 60 * 60 * 1000 - 1;

// A bare date-time with no offset, e.g. "2026-10-05 10:00:00" or ISO-style with T.
const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/;
// A bare calendar date, e.g. "2026-10-05".
const NAIVE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * Product master metadata required to resolve units and display names.
 */
export interface ProductMeta {
  productCode: string | null;
  productName: string;
  unitCount: number;
  categoryId: number | null;
  categoryName: string | null;
}

/**
 * Builds a UTC instant from Philippines wall-clock components. Components are
 * parsed by hand so the result never shifts with the host machine's timezone.
 */
function phWallClockToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number
): number {
  return Date.UTC(year, month - 1, day, hour, minute, second, ms) - PH_OFFSET_MS;
}

/**
 * Normalises a movement timestamp to true UTC milliseconds.
 *
 * The movements view returns Philippines local wall-clock strings with no
 * timezone suffix; Node parses those as UTC, which is 8 hours ahead of reality.
 * Already-suffixed values and epoch numbers are trusted as-is.
 */
export function toUtcMs(ts: string | number | undefined | null): number | null {
  if (ts === undefined || ts === null || ts === "") return null;
  if (typeof ts === "number") return Number.isFinite(ts) ? ts : null;

  const raw = String(ts).trim();
  if (!raw) return null;

  if (raw.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(raw)) {
    const anchored = new Date(raw).getTime();
    return Number.isNaN(anchored) ? null : anchored;
  }

  const dateTime = NAIVE_DATETIME.exec(raw);
  if (dateTime) {
    const [, year, month, day, hour, minute, secondsPart] = dateTime;
    const seconds = Number(secondsPart ?? 0);
    const wholeSeconds = Math.floor(seconds);
    const ms = Math.round((seconds - wholeSeconds) * 1000);
    return phWallClockToUtcMs(
      Number(year), Number(month), Number(day),
      Number(hour), Number(minute), wholeSeconds, ms
    );
  }

  const date = NAIVE_DATE.exec(raw);
  if (date) {
    return phWallClockToUtcMs(
      Number(date[1]), Number(date[2]), Number(date[3]), 0, 0, 0, 0
    );
  }

  const fallback = new Date(raw).getTime();
  return Number.isNaN(fallback) ? null : fallback;
}

/**
 * Reads a Directus user-entered date column as the instant it represents.
 *
 * Directus serialises naive MySQL `datetime` columns with a synthetic trailing
 * "Z", so a count cutoff keyed in as 11:02 Philippines time arrives as
 * "2026-10-13T11:02:00.000Z". toUtcMs rightly trusts a suffixed value as real
 * UTC, which would place that cutoff eight hours late and let movement booked
 * after the count into Expected. The suffix is dropped here and the wall-clock
 * components re-read, so the cutoff and the ledger share one frame.
 *
 * Directus' own UTC columns (`committed_at` and friends) are NOT read through
 * this, because for them the suffix is real.
 */
export function directusWallClockToUtcMs(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  if (!raw) return null;
  const stripped = raw.replace(/(?:Z|[+-]\d{2}:?\d{2})$/, "");
  return toUtcMs(stripped) ?? toUtcMs(raw);
}

/**
 * Converts a YYYY-MM-DD filter value into its PH-local instant, either at the
 * very start or the very end of that day.
 */
export function dayBoundaryUtcMs(dateStr: string, endOfDay: boolean): number | null {
  const date = NAIVE_DATE.exec(String(dateStr).trim());
  if (!date) return null;
  const asUtc = phWallClockToUtcMs(
    Number(date[1]), Number(date[2]), Number(date[3]), 0, 0, 0, 0
  );
  return endOfDay ? asUtc + EOD_MS : asUtc;
}

/**
 * Coerces any numeric-ish value coming out of Directus or the movements view.
 */
function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Reads a field that the view has historically returned in two casings. */
function pick<T>(row: Record<string, unknown>, camel: string, snake: string): T | undefined {
  const camelValue = row[camel];
  if (camelValue !== undefined && camelValue !== null) return camelValue as T;
  const snakeValue = row[snake];
  if (snakeValue !== undefined && snakeValue !== null) return snakeValue as T;
  return undefined;
}

/**
 * Resolves the effective base-unit multiplier for a movement row.
 * Prefers the product master, then the row itself, then 1.
 */
function resolveUnitCount(row: RawMovementRow, meta?: ProductMeta): number {
  const fromRow = num(pick<number>(row as Record<string, unknown>, "unitCount", "unit_count"));
  const candidate = meta?.unitCount ?? fromRow;
  return candidate > 0 ? candidate : 1;
}

/** Identifies the documents that restate a balance rather than move stock. */
function isPhysicalInventoryDoc(docType: string, docNo: string): boolean {
  return docType === "PHYSICAL INVENTORY" || docNo.startsWith("PH");
}

/** A movement row after field normalisation, ready for arithmetic. */
interface LedgerEntry {
  productId: number;
  branchId: number;
  timeMs: number | null;
  /** Blank when the source document was posted without a number. */
  docNo: string;
  docType: string;
  supplierName: string;
  /** Purchase order resolved by the BFF for an unnumbered receipt. */
  receiptRef: string;
  inBase: number;
  outBase: number;
  restatement: number;
  isCount: boolean;
  unitCount: number;
  productName: string;
  branchName: string;
}

/**
 * Names a ledger document for display. Some purchase receipts are posted with
 * an empty number, and a blank cell reads as missing data rather than as an
 * unnumbered document. The BFF resolves the purchase order behind such a
 * receipt and that number is printed as-is; failing that, the counterparty is
 * used. Only purchase receipts name a supplier: the view carries the same
 * supplier on every row, including transfers and adjustments, where it means
 * nothing.
 */
export function documentLabel(
  doc: Pick<LedgerEntry, "docNo" | "docType" | "supplierName" | "receiptRef">
): string {
  if (doc.docNo) return doc.docNo;
  if (doc.receiptRef) return doc.receiptRef;
  const type = doc.docType.toLowerCase();
  if (doc.docType === "PURCHASE RECEIPT" && doc.supplierName) {
    return `Unnumbered receipt from ${doc.supplierName}`;
  }
  return `Unnumbered ${type || "document"}`;
}

/**
 * Second-precision identity shared by the movements view and the receiving
 * rows: the view stamps a receipt with the same wall clock the stock was
 * received at, to the second, and both sides are Philippines local time.
 */
export function receiptMatchKey(branchId: number, productId: number, stamp: unknown): string {
  return `${branchId}|${productId}|${String(stamp ?? "").replace("T", " ").slice(0, 19)}`;
}

/**
 * Builds the base-unit change contributed by one movement row.
 */
function normaliseMovement(row: RawMovementRow, meta?: ProductMeta): LedgerEntry | null {
  const productId = num(pick<number>(row as Record<string, unknown>, "productId", "product_id"));
  if (!productId) return null;

  const docNo = String(pick<string>(row as Record<string, unknown>, "docNo", "doc_no") ?? "").trim();
  const docType = String(row.docType ?? "").trim().toUpperCase();
  const unitCount = resolveUnitCount(row, meta);

  const rawIn = num(pick<number>(row as Record<string, unknown>, "inBase", "in_base"));
  const rawOut = num(pick<number>(row as Record<string, unknown>, "outBase", "out_base"));

  const isCount = isPhysicalInventoryDoc(docType, docNo.toUpperCase());

  // A count restates the balance by its own variance and never moves stock in/out.
  const restatement = isCount ? num(row.variance) * unitCount : 0;

  return {
    productId,
    branchId: num(pick<number>(row as Record<string, unknown>, "branchId", "branch_id")),
    timeMs: toUtcMs(row.ts),
    docNo,
    docType: docType || "UNKNOWN",
    supplierName: String(row.supplierName ?? "").trim(),
    receiptRef: String(row.receiptRef ?? "").trim(),
    inBase: isCount ? 0 : rawIn,
    outBase: isCount ? 0 : rawOut,
    restatement,
    isCount,
    unitCount,
    // The view carries both the master name and the description; only the
    // description is a label an operator recognises.
    productName: productDisplayName(row.descr, row.productName),
    branchName: String(row.branchName ?? ""),
  };
}

/**
 * Selects the count that governs a product's line.
 *
 * A count governs only when its cutoff falls inside the reported period: it is
 * the period's closing measurement, and §4 compares it with the balance the
 * ledger says the system held at that same instant.
 *
 * A committed count whose cutoff precedes the period still gets reported, but
 * only as context (`inPeriod: false`). Treating it as the period's count would
 * compare, for example, a June count against the ledger balance on 1 October and
 * publish nine months of unrelated movement as variance.
 */
function pickGoverningCount(
  lines: RawCountLine[],
  startMs: number,
  endMs: number
): { line: RawCountLine; cutoffMs: number | null; inPeriod: boolean } | null {
  const scored = lines.map((line) => ({
    line,
    cutoffMs:
      directusWallClockToUtcMs(line.cutOffDate) ?? directusWallClockToUtcMs(line.dateEncoded),
  }));

  // An undated sheet cannot be placed inside the period, so it never governs.
  const inPeriod = scored.filter(
    (entry) =>
      entry.cutoffMs !== null && entry.cutoffMs >= startMs && entry.cutoffMs <= endMs
  );
  if (inPeriod.length > 0) {
    return { ...sortNewestFirst(inPeriod)[0], inPeriod: true };
  }

  const prior = scored.filter(
    (entry) => entry.cutoffMs === null || entry.cutoffMs < startMs
  );
  if (prior.length === 0) return null;

  return { ...sortNewestFirst(prior)[0], inPeriod: false };
}

/** Newest cutoff first, breaking ties on the higher header id. */
function sortNewestFirst(
  entries: { line: RawCountLine; cutoffMs: number | null }[]
): { line: RawCountLine; cutoffMs: number | null }[] {
  return [...entries].sort((a, b) => {
    const aMs = a.cutoffMs ?? Number.NEGATIVE_INFINITY;
    const bMs = b.cutoffMs ?? Number.NEGATIVE_INFINITY;
    if (aMs !== bMs) return bMs - aMs;
    return b.line.phId - a.line.phId;
  });
}

export interface VarianceCalculationInput {
  movements: RawMovementRow[];
  counts: RawCountLine[];
  productMeta: Record<number, ProductMeta>;
  filters: StockMovementVarianceFilters;
  /** Branch label for this run; the view sometimes returns movements without one. */
  scopeBranchName?: string;
  /** Document numbers voided after posting; excluded from every balance. */
  voidedDocuments: Set<string>;
}

/**
 * Core reconciliation. Returns one row per product that has either movement
 * history or a committed count inside the branch scope.
 */
export function buildVarianceRows(input: VarianceCalculationInput): StockMovementVarianceRow[] {
  const { movements, counts, productMeta, filters, scopeBranchName, voidedDocuments } = input;

  const startMs = dayBoundaryUtcMs(filters.startDate, false);
  const endMs = dayBoundaryUtcMs(filters.endDate, true);
  if (startMs === null || endMs === null) return [];

  // Normalise the whole ledger once so the per-product loops below stay linear.
  const ledgerByProduct = new Map<number, LedgerEntry[]>();

  for (const row of movements) {
    const rawProductId = num(
      pick<number>(row as Record<string, unknown>, "productId", "product_id")
    );
    const entry = normaliseMovement(row, productMeta[rawProductId]);
    if (!entry) continue;

    // The view still lists a document that was voided later, so its whole effect
    // is removed here rather than allowed into any balance.
    if (voidedDocuments.has(entry.docNo.toUpperCase())) continue;

    const list = ledgerByProduct.get(entry.productId) ?? [];
    list.push(entry);
    ledgerByProduct.set(entry.productId, list);
  }

  const countsByProduct = new Map<number, RawCountLine[]>();
  for (const line of counts) {
    const bucket = countsByProduct.get(line.productId);
    if (bucket) bucket.push(line);
    else countsByProduct.set(line.productId, [line]);
  }

  // Union of every product touched by the ledger or by a count sheet.
  const productIds = new Set<number>([...ledgerByProduct.keys(), ...countsByProduct.keys()]);

  const rows: StockMovementVarianceRow[] = [];

  for (const productId of productIds) {
    const meta = productMeta[productId];
    const productMovements = ledgerByProduct.get(productId) ?? [];
    const productCounts = countsByProduct.get(productId) ?? [];

    const governing = pickGoverningCount(productCounts, startMs, endMs);
    const countApplies = governing?.inPeriod === true;

    // Opening = every settled change strictly before the reporting period.
    let openingBalance = 0;
    for (const entry of productMovements) {
      if (entry.timeMs === null || entry.timeMs >= startMs) continue;
      openingBalance += entry.isCount ? entry.restatement : entry.inBase - entry.outBase;
    }

    // Measurement boundary: the count cutoff when a count governs the line.
    const boundaryMs = countApplies ? (governing?.cutoffMs ?? endMs) : endMs;
    const governingDocNo = countApplies ? governing?.line.phNo.toUpperCase() ?? "" : "";

    let periodIn = 0;
    let periodOut = 0;
    let priorRestatements = 0;

    for (const entry of productMovements) {
      if (entry.timeMs === null || entry.timeMs < startMs || entry.timeMs > endMs) continue;

      // Anything past the boundary belongs to the next reconciliation, not this one.
      if (entry.timeMs > boundaryMs) continue;

      if (entry.isCount) {
        // The governing count is the thing under test, so it is not pre-applied.
        if (entry.docNo.toUpperCase() !== governingDocNo) priorRestatements += entry.restatement;
        continue;
      }

      periodIn += entry.inBase;
      periodOut += entry.outBase;
    }

    const expectedClosing = openingBalance + periodIn - periodOut + priorRestatements;

    const unitCount = meta?.unitCount ?? productMovements[0]?.unitCount ?? 1;
    const countedClosing =
      countApplies && governing ? num(governing.line.physicalCount) * unitCount : null;
    const variance = countedClosing === null ? null : countedClosing - expectedClosing;

    const countSourceVariance = governing ? num(governing.line.sourceVariance) * unitCount : null;

    const toDocument = (entry: LedgerEntry): SupportingDocument => ({
      docNo: entry.docNo,
      label: documentLabel(entry),
      docType: entry.docType,
      ts: new Date(entry.timeMs ?? 0).toISOString(),
      branchId: entry.branchId || num(filters.branchId),
      branchName: entry.branchName || scopeBranchName || "",
      inBase: entry.inBase,
      outBase: entry.outBase,
      countAdjustment: entry.restatement,
      descr: entry.isCount ? "Count restatement" : "",
    });

    const byTime = (a: LedgerEntry, b: LedgerEntry) => (a.timeMs ?? 0) - (b.timeMs ?? 0);

    const supportingDocuments = productMovements
      .filter(
        (entry) =>
          entry.timeMs !== null &&
          entry.timeMs >= startMs &&
          entry.timeMs <= endMs &&
          // A movement booked after the closing count did not participate in the
          // comparison, so it is not listed here either.
          entry.timeMs <= boundaryMs &&
          // The count under test is reported in its own section; listing it here
          // would show a restatement that the Expected figure deliberately ignores.
          entry.docNo.toUpperCase() !== governingDocNo
      )
      .sort(byTime)
      .map(toDocument);

    // The governing count is the newest in-period sheet, so nothing else in this
    // window can be a count — these are movement documents only.
    const documentsAfterCount = productMovements
      .filter(
        (entry) =>
          countApplies &&
          entry.timeMs !== null &&
          entry.timeMs > boundaryMs &&
          entry.timeMs <= endMs
      )
      .sort(byTime)
      .map(toDocument);

    const branchId =
      productMovements.find((entry) => entry.branchId > 0)?.branchId ??
      governing?.line.branchId ??
      num(filters.branchId);

    const rowBranchName =
      productMovements.find((entry) => entry.branchName)?.branchName ??
      scopeBranchName ??
      displayBranchName(governing?.line.branchId);

    rows.push({
      productId,
      productCode: meta?.productCode ?? null,
      productName:
        meta?.productName ||
        productMovements.find((entry) => entry.productName)?.productName ||
        `Product #${productId}`,
      branchId,
      branchName: rowBranchName,
      categoryName: meta?.categoryName ?? null,
      unitCount,
      openingBalance,
      periodIn,
      periodOut,
      expectedClosing,
      countedClosing,
      variance,
      variancePercent: percentOfExpected(variance, expectedClosing),
      countDocNo: governing?.line.phNo ?? null,
      // Published as the resolved instant, not the source string, so the cutoff
      // the screen shows is exactly the one Expected was measured at.
      countCutoffDate:
        governing && governing.cutoffMs !== null
          ? new Date(governing.cutoffMs).toISOString()
          : null,
      countSystemQty: governing ? num(governing.line.systemCount) * unitCount : null,
      countSourceVariance,
      countInPeriod: countApplies,
      supportingDocuments,
      documentsAfterCount,
    });
  }

  rows.sort((a, b) => {
    const aVar = Math.abs(a.variance ?? 0);
    const bVar = Math.abs(b.variance ?? 0);
    if (aVar !== bVar) return bVar - aVar;
    const branchOrder = a.branchName.localeCompare(b.branchName);
    if (branchOrder !== 0) return branchOrder;
    return a.productName.localeCompare(b.productName);
  });

  return rows;
}

/** Placeholder branch label when only an id is known. */
function displayBranchName(branchId: number | undefined): string {
  return branchId ? `Branch #${branchId}` : "";
}

/**
 * Aggregates the KPI strip from the reconciled rows.
 */
export function summariseKpis(
  rows: StockMovementVarianceRow[]
): StockMovementVarianceKpis {
  let short = 0;
  let over = 0;
  let net = 0;
  let withVariance = 0;
  let shortLines = 0;
  let overLines = 0;
  let counted = 0;
  let uncounted = 0;
  let countedEarlier = 0;

  for (const row of rows) {
    if (row.variance === null) {
      uncounted += 1;
      if (row.countDocNo !== null) countedEarlier += 1;
    } else {
      counted += 1;
      net += row.variance;
      if (row.variance < 0) {
        short += row.variance;
        shortLines += 1;
      }
      if (row.variance > 0) {
        over += row.variance;
        overLines += 1;
      }
      if (Math.abs(row.variance) > 0.5) withVariance += 1;
    }
  }

  return {
    totalLines: rows.length,
    linesWithVariance: withVariance,
    linesCounted: counted,
    linesUncounted: uncounted,
    linesCountedEarlier: countedEarlier,
    netVarianceUnits: net,
    shortUnits: short,
    overUnits: over,
    shortLines,
    overLines,
  };
}

/**
 * Applies client-side text filtering without re-querying the ledger.
 */
export function filterRows(
  rows: StockMovementVarianceRow[],
  query: string
): StockMovementVarianceRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    return (
      row.productName.toLowerCase().includes(needle) ||
      (row.productCode ?? "").toLowerCase().includes(needle) ||
      (row.countDocNo ?? "").toLowerCase().includes(needle) ||
      row.branchName.toLowerCase().includes(needle)
    );
  });
}

/**
 * Formats any source timestamp as a Philippines wall-clock reading. The ledger
 * view returns PH local time with no offset, and Directus wall-clock columns
 * are resolved into true UTC instants before they reach a row, so everything
 * displayed here is already in one frame.
 */
export function formatPhDateTime(value: string | number | null | undefined): string {
  const ms = toUtcMs(value);
  if (ms === null) return "—";
  const ph = new Date(ms + PH_OFFSET_MS);
  const month = MONTH_ABBR[ph.getUTCMonth()];
  const day = String(ph.getUTCDate()).padStart(2, "0");
  const hour = String(ph.getUTCHours()).padStart(2, "0");
  const minute = String(ph.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${ph.getUTCFullYear()} ${hour}:${minute}`;
}

/**
 * The label a product is shown under, everywhere in this report.
 *
 * ids-guide rule: `products.description` is the name operators read; the master
 * `product_name` is only the key the movements ledger is queried with, so it is
 * never what the screen displays. Values are taken in priority order and empty
 * or missing ones fall through, finally returning "".
 */
export function productDisplayName(...parts: unknown[]): string {
  for (const part of parts) {
    // Only text (or a numeric code) can name a product; booleans, objects and
    // nulls are skipped rather than stringified into a label.
    if (typeof part !== "string" && typeof part !== "number") continue;
    const value = String(part).trim();
    if (value) return value;
  }
  return "";
}

/**
 * Formats a base-unit quantity for display, keeping decimals only when needed.
 */
export function formatQty(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(2);
}

/**
 * Signed variance formatting so shortages and overages read at a glance.
 */
export function formatSigned(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return "0";
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${Math.abs(rounded).toLocaleString()}`;
}

/**
 * A share of expected stock is only meaningful against a positive base. Zero has
 * no denominator, and a negative balance — the ledger has issued more of the
 * product than it ever received — inflates a small difference into a figure like
 * 550%, which reads as a defect rather than as an overdrawn line. The unit
 * variance still carries those lines and is the number to act on.
 */
function percentOfExpected(
  variance: number | null,
  expectedClosing: number
): number | null {
  if (variance === null || expectedClosing <= 0) return null;
  return (variance / expectedClosing) * 100;
}

/**
 * Renders the percentage the same way on every surface, keeping an uncounted
 * line ("—") distinguishable from a counted line with no usable base ("n/a").
 */
export function formatVariancePercent(
  row: Pick<StockMovementVarianceRow, "variance" | "variancePercent">
): string {
  if (row.variance === null) return "—";
  if (row.variancePercent === null) return "n/a";
  return `${Math.round(row.variancePercent * 10) / 10}%`;
}
