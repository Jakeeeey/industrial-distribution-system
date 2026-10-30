// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/services/stock-movement-variance.calc.ts
// ==============================================================================
// Calculation Engine for Stock Movement and Variance Report.
//
// Implements the approved business rule (spec §4):
//     Expected = opening + in − out
//     Variance = counted − expected
//
// Measurement rules that keep the arithmetic honest:
// - Balances are measured at a single cutoff (spec §8). When a committed count
//   governs the line, the cutoff is that count's own cutoff date, because
//   comparing a mid-period count against a period-end expectation would report
//   later, unrelated movement as variance.
// - Physical Inventory documents restate the system balance by their variance;
//   they never contribute to "in" or "out".
// - Quantities reconcile in BASE units (qty × unit_of_measurement_count) so boxed
//   and loose products reconcile against the same ledger.
// - Documents voided after posting are excluded from every balance and reported as
//   exceptions, because the movements view does not apply the reversal itself.
// ==============================================================================

import type {
  RawCountLine,
  RawMovementRow,
  SerialException,
  StockMovementVarianceFilters,
  StockMovementVarianceKpis,
  StockMovementVarianceRow,
  SupportingDocument,
  VarianceExceptionCode,
} from "../types/stock-movement-variance.types";

const PH_OFFSET_MS = 8 * 60 * 60 * 1000; // Philippines is UTC+8 with no DST
const EOD_MS = 24 * 60 * 60 * 1000 - 1;

// A bare date-time with no offset, e.g. "2026-10-05 10:00:00" or ISO-style with T.
const NAIVE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/;
// A bare calendar date, e.g. "2026-10-05".
const NAIVE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

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
  docNo: string;
  docType: string;
  inBase: number;
  outBase: number;
  restatement: number;
  isCount: boolean;
  unitCount: number;
  productName: string;
  branchName: string;
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
    docNo: docNo || "(no document number)",
    docType: docType || "UNKNOWN",
    inBase: isCount ? 0 : rawIn,
    outBase: isCount ? 0 : rawOut,
    restatement,
    isCount,
    unitCount,
    productName: String(row.productName ?? ""),
    branchName: String(row.branchName ?? ""),
  };
}

/**
 * Selects the governing committed count for a product: the latest count whose
 * cutoff is at or before the reporting cutoff. Ties break on the higher header id.
 */
function pickGoverningCount(
  lines: RawCountLine[],
  endMs: number
): { line: RawCountLine; cutoffMs: number | null } | null {
  const eligible = lines
    .map((line) => ({
      line,
      cutoffMs: toUtcMs(line.cutOffDate ?? "") ?? toUtcMs(line.dateEncoded ?? "") ?? null,
    }))
    .filter((entry) => entry.cutoffMs === null || entry.cutoffMs <= endMs);

  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    const aMs = a.cutoffMs ?? Number.NEGATIVE_INFINITY;
    const bMs = b.cutoffMs ?? Number.NEGATIVE_INFINITY;
    if (aMs !== bMs) return bMs - aMs;
    return b.line.phId - a.line.phId;
  });

  return eligible[0];
}

export interface VarianceCalculationInput {
  movements: RawMovementRow[];
  counts: RawCountLine[];
  productMeta: Record<number, ProductMeta>;
  filters: StockMovementVarianceFilters;
  /** Document numbers voided after posting; excluded from every balance. */
  voidedDocuments: Set<string>;
  /** Serials known to the asset register, used to validate counted serials. */
  knownSerials: Set<string>;
}

/**
 * Core reconciliation. Returns one row per product that has either movement
 * history or a committed count inside the branch scope, plus the audit trail of
 * every document excluded because a later void reversed it.
 */
export function buildVarianceRows(
  input: VarianceCalculationInput
): { rows: StockMovementVarianceRow[]; excluded: SupportingDocument[] } {
  const { movements, counts, productMeta, filters, voidedDocuments, knownSerials } = input;

  const startMs = dayBoundaryUtcMs(filters.startDate, false);
  const endMs = dayBoundaryUtcMs(filters.endDate, true);
  if (startMs === null || endMs === null) {
    return { rows: [], excluded: [] };
  }

  // Normalise the whole ledger once so the per-product loops below stay linear.
  const ledgerByProduct = new Map<number, LedgerEntry[]>();
  const voidedByProduct = new Map<number, SupportingDocument[]>();

  for (const row of movements) {
    const rawProductId = num(
      pick<number>(row as Record<string, unknown>, "productId", "product_id")
    );
    const entry = normaliseMovement(row, productMeta[rawProductId]);
    if (!entry) continue;

    if (voidedDocuments.has(entry.docNo.toUpperCase())) {
      const list = voidedByProduct.get(entry.productId) ?? [];
      list.push({
        docNo: entry.docNo,
        docType: entry.docType,
        ts: entry.timeMs === null ? "" : new Date(entry.timeMs).toISOString(),
        inBase: entry.inBase,
        outBase: entry.outBase,
        countAdjustment: entry.restatement,
        descr: String(row.descr ?? ""),
      });
      voidedByProduct.set(entry.productId, list);
      continue;
    }

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
  const excluded: SupportingDocument[] = [];

  for (const productId of productIds) {
    const meta = productMeta[productId];
    const productMovements = ledgerByProduct.get(productId) ?? [];
    const productCounts = countsByProduct.get(productId) ?? [];
    const voidedDocs = voidedByProduct.get(productId) ?? [];
    excluded.push(...voidedDocs);

    const governing = pickGoverningCount(productCounts, endMs);

    // Opening = every settled change strictly before the reporting period.
    let openingBalance = 0;
    for (const entry of productMovements) {
      if (entry.timeMs === null || entry.timeMs >= startMs) continue;
      openingBalance += entry.isCount ? entry.restatement : entry.inBase - entry.outBase;
    }

    // Measurement boundary: the count cutoff when a count governs the line.
    const boundaryMs = governing?.cutoffMs ?? endMs;
    const governingDocNo = governing?.line.phNo.toUpperCase() ?? "";

    let periodIn = 0;
    let periodOut = 0;
    let priorRestatements = 0;
    let movementAfterBoundary = 0;

    for (const entry of productMovements) {
      if (entry.timeMs === null || entry.timeMs < startMs || entry.timeMs > endMs) continue;

      if (entry.timeMs > boundaryMs) {
        movementAfterBoundary += 1;
        continue;
      }

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
    const countedClosing = governing ? num(governing.line.physicalCount) * unitCount : null;
    const variance = countedClosing === null ? null : countedClosing - expectedClosing;

    const exceptionCodes: VarianceExceptionCode[] = [];
    if (!governing) exceptionCodes.push("NO_COUNT");

    const countSourceVariance = governing ? num(governing.line.sourceVariance) * unitCount : null;

    // The count module recorded its own variance; if our expectation disagrees, the
    // two sources of truth are out of step and a supervisor must look at it.
    if (
      governing &&
      variance !== null &&
      countSourceVariance !== null &&
      Math.abs(variance - countSourceVariance) > 0.5
    ) {
      exceptionCodes.push("VARIANCE_DRIFT");
    }

    if (movementAfterBoundary > 0) exceptionCodes.push("POST_CUTOFF_MOVEMENT");
    if (voidedDocs.length > 0) exceptionCodes.push("VOID_REVERSAL");

    const serialExceptions: SerialException[] = [];
    if (governing) {
      for (const serial of governing.line.serials) {
        if (!serial.trim()) continue;
        if (!knownSerials.has(serial.trim().toUpperCase())) {
          serialExceptions.push({
            serialNumber: serial,
            phNo: governing.line.phNo,
            reason: "Counted serial is not present in the asset register or movement history",
          });
        }
      }
      if (serialExceptions.length > 0) exceptionCodes.push("UNMATCHED_SERIAL");
    }

    // Adjustment references: offset matches recorded against a count line (spec §7).
    const adjustmentReferences = Array.from(
      new Set(
        productCounts
          .filter((line) => line.offsetMatch !== null)
          .map((line) => `${line.phNo}#${line.id}`)
      )
    );

    const supportingDocuments: SupportingDocument[] = productMovements
      .filter((entry) => entry.timeMs !== null && entry.timeMs >= startMs && entry.timeMs <= endMs)
      .sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0))
      .map((entry) => ({
        docNo: entry.docNo,
        docType: entry.docType,
        ts: new Date(entry.timeMs ?? 0).toISOString(),
        inBase: entry.inBase,
        outBase: entry.outBase,
        countAdjustment: entry.restatement,
        descr: entry.isCount ? "Count restatement" : "",
      }));

    const branchId =
      productMovements.find((entry) => entry.branchId > 0)?.branchId ??
      governing?.line.branchId ??
      num(filters.branchId);

    rows.push({
      productId,
      productCode: meta?.productCode ?? null,
      productName:
        meta?.productName ||
        productMovements.find((entry) => entry.productName)?.productName ||
        `Product #${productId}`,
      branchId,
      branchName:
        productMovements.find((entry) => entry.branchName)?.branchName ??
        displayBranchName(governing?.line.branchId),
      categoryName: meta?.categoryName ?? null,
      unitCount,
      openingBalance,
      periodIn,
      periodOut,
      expectedClosing,
      countedClosing,
      variance,
      variancePercent:
        variance !== null && expectedClosing !== 0
          ? (variance / Math.abs(expectedClosing)) * 100
          : null,
      countDocNo: governing?.line.phNo ?? null,
      countCutoffDate: governing?.line.cutOffDate ?? governing?.line.dateEncoded ?? null,
      countSystemQty: governing ? num(governing.line.systemCount) * unitCount : null,
      countSourceVariance,
      exceptionCodes,
      adjustmentReferences,
      supportingDocuments,
      serialExceptions,
    });
  }

  rows.sort((a, b) => {
    const aVar = Math.abs(a.variance ?? 0);
    const bVar = Math.abs(b.variance ?? 0);
    if (aVar !== bVar) return bVar - aVar;
    return a.productName.localeCompare(b.productName);
  });

  return { rows, excluded };
}

/** Placeholder branch label when only an id is known. */
function displayBranchName(branchId: number | undefined): string {
  return branchId ? `Branch #${branchId}` : "";
}

/**
 * Aggregates the KPI strip from the reconciled rows.
 */
export function summariseKpis(
  rows: StockMovementVarianceRow[],
  excludedDocuments: SupportingDocument[]
): StockMovementVarianceKpis {
  let short = 0;
  let over = 0;
  let net = 0;
  let withVariance = 0;
  let counted = 0;
  let uncounted = 0;
  let exceptionLines = 0;
  let unmatchedSerials = 0;

  for (const row of rows) {
    if (row.variance === null) {
      uncounted += 1;
    } else {
      counted += 1;
      net += row.variance;
      if (row.variance < 0) short += row.variance;
      if (row.variance > 0) over += row.variance;
      if (Math.abs(row.variance) > 0.5) withVariance += 1;
    }

    if (row.exceptionCodes.length > 0) exceptionLines += 1;
    unmatchedSerials += row.serialExceptions.length;
  }

  return {
    totalLines: rows.length,
    linesWithVariance: withVariance,
    linesCounted: counted,
    linesUncounted: uncounted,
    netVarianceUnits: net,
    shortUnits: short,
    overUnits: over,
    exceptionLines,
    unmatchedSerials,
    voidReversalDocuments: excludedDocuments.length,
  };
}

/**
 * Applies client-side text filtering without re-querying the ledger.
 */
export function filterRows(
  rows: StockMovementVarianceRow[],
  query: string,
  onlyExceptions: boolean
): StockMovementVarianceRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (onlyExceptions && row.exceptionCodes.length === 0) return false;
    if (!needle) return true;
    return (
      row.productName.toLowerCase().includes(needle) ||
      (row.productCode ?? "").toLowerCase().includes(needle) ||
      (row.countDocNo ?? "").toLowerCase().includes(needle) ||
      row.branchName.toLowerCase().includes(needle)
    );
  });
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
