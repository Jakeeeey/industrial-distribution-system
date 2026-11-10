// =============================================================================
// Price Monitoring — Matrix & KPI Utility Functions
// Layer  : utils (pure functions — no side effects, no React imports)
// Spec   : §8.2 Matrix and Chart Rules
// =============================================================================

import type {
  ViewPriceMonitoringRow,
  PriceTypeGroup,
  MonthlyMatrixEntry,
  AnnualSummary,
  OverallSummary,
  PriceMovement,
} from "../types";

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Groups rows by priceTypeId and sorts groups ascending by priceTypeSort.
 * Within each group, rows remain in their original API order (priceChangeDatetime ASC).
 */
export function groupByPriceType(rows: ViewPriceMonitoringRow[]): PriceTypeGroup[] {
  const map = new Map<number, PriceTypeGroup>();

  // Sort rows ascending chronologically so carry-forward and latest-overrides work correctly
  const sortedRows = [...rows].sort((a, b) => {
    const tA = new Date(a.priceChangeDatetime ?? a.approvedAt ?? 0).getTime();
    const tB = new Date(b.priceChangeDatetime ?? b.approvedAt ?? 0).getTime();
    if (tA !== tB) return tA - tB;

    const sA = a.priceTypeSort ?? 0;
    const sB = b.priceTypeSort ?? 0;
    if (sA !== sB) return sA - sB;

    return a.requestId - b.requestId;
  });

  for (const row of sortedRows) {
    const id = row.priceTypeId;
    if (!map.has(id)) {
      map.set(id, {
        priceTypeId: id,
        priceTypeName: row.priceTypeName ?? `#${id}`,
        priceTypeSort: row.priceTypeSort ?? 999,
        rows: [],
      });
    }
    map.get(id)!.rows.push(row);
  }

  return Array.from(map.values()).sort(
    (a, b) => a.priceTypeSort - b.priceTypeSort,
  );
}

// ---------------------------------------------------------------------------
// Year extraction
// ---------------------------------------------------------------------------

/**
 * Returns a deduplicated, ascending list of years present in priceChangeDatetime.
 * Frontend uses this to build year tabs.
 */
export function getUniqueYears(rows: ViewPriceMonitoringRow[]): number[] {
  const yearSet = new Set<number>();
  for (const row of rows) {
    const dt = row.priceChangeDatetime ?? row.approvedAt;
    if (!dt) continue;
    const y = new Date(dt).getFullYear();
    if (Number.isFinite(y)) yearSet.add(y);
  }
  return Array.from(yearSet).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Monthly matrix build (carry-forward logic)
// ---------------------------------------------------------------------------

/**
 * Builds the 12-month (Jan–Dec) price series for a single price-type group
 * within a given year, applying carry-forward from prior months/years.
 *
 * Rules (spec §8.2):
 * - Use priceChangeDatetime as the time axis.
 * - When a month has no change, carry forward the last effective price.
 * - Show null only when no prior price exists at all.
 * - When multiple changes occur in a single month, the LAST event wins.
 *
 * @param group  All rows for one priceTypeId (API-ordered, chronological).
 * @param year   The selected year to build the matrix for.
 * @param allRows All rows for all price types (needed for carry-forward seed
 *               from before Jan 1 of the selected year).
 * @param dateFrom Optional client-side start date filter.
 * @param dateTo Optional client-side end date filter.
 */
export function buildMonthlyMatrix(
  group: PriceTypeGroup,
  year: number,
  allRows: ViewPriceMonitoringRow[],
  dateFrom?: Date,
  dateTo?: Date,
): MonthlyMatrixEntry {
  // Find the most recent newPrice for this price type BEFORE the selected year.
  // This is the opening / carry-forward seed price.
  const priorRows = allRows
    .filter(
      (r) =>
        r.priceTypeId === group.priceTypeId &&
        r.priceChangeDatetime !== null &&
        r.requestStatus === "APPROVED" &&
        new Date(r.priceChangeDatetime!).getFullYear() < year,
    )
    .sort(
      (a, b) =>
        new Date(a.priceChangeDatetime!).getTime() -
        new Date(b.priceChangeDatetime!).getTime(),
    );

  const seedPrice: number | null =
    priorRows.length > 0
      ? (priorRows[priorRows.length - 1].newPrice ?? null)
      : null;

  // Build a map of month-index → list of rows for this year (chronological order)
  // month-index: 0 = Jan, 11 = Dec
  const monthlyEventsMap = new Map<number, ViewPriceMonitoringRow[]>();

  for (const row of group.rows) {
    if (row.requestStatus !== "APPROVED") continue;
    const dt = row.priceChangeDatetime ?? row.approvedAt;
    if (!dt) continue;
    const date = new Date(dt);
    if (date.getFullYear() !== year) continue;

    const monthIdx = date.getMonth(); // 0-based
    if (!monthlyEventsMap.has(monthIdx)) {
      monthlyEventsMap.set(monthIdx, []);
    }
    monthlyEventsMap.get(monthIdx)!.push(row);
  }

  // Build the 12-month carry-forward series
  const monthlyPrices: (number | null)[] = new Array(12).fill(null);
  const changedMonths: boolean[] = new Array(12).fill(false);
  const changeEvents: (ViewPriceMonitoringRow[] | null)[] = new Array(12).fill(null);

  const isWithinRange = (dtStr: string | null) => {
    if (!dtStr) return false;
    const t = new Date(dtStr).getTime();
    if (dateFrom) {
      const fromTime = dateFrom.getTime();
      if (t < fromTime) return false;
    }
    if (dateTo) {
      const toTime = new Date(dateTo.getTime()).setHours(23, 59, 59, 999);
      if (t > toTime) return false;
    }
    return true;
  };

  let carry: number | null = seedPrice;
  let activeEvent: ViewPriceMonitoringRow | null =
    seedPrice !== null && priorRows.length > 0
      ? priorRows[priorRows.length - 1]
      : null;
  let activeEventsList: ViewPriceMonitoringRow[] | null =
    activeEvent !== null ? [activeEvent] : null;

  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth(); // 0 = Jan, 11 = Dec

  for (let m = 0; m < 12; m++) {
    // If this month is in the future relative to current local time, do not carry forward!
    if (year === currentYear && m > currentMonthIdx) {
      monthlyPrices[m] = null;
      changeEvents[m] = null;
      continue;
    }

    const monthStart = new Date(year, m, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);

    // If this month is completely outside the user's selected date range, show null (dash)
    if (dateFrom && monthEnd < dateFrom) {
      monthlyPrices[m] = null;
      changeEvents[m] = null;
      continue;
    }
    if (dateTo && monthStart > dateTo) {
      monthlyPrices[m] = null;
      changeEvents[m] = null;
      continue;
    }

    if (monthlyEventsMap.has(m)) {
      const eventsInMonth = monthlyEventsMap.get(m) || [];
      const validEvents = eventsInMonth.filter((row) => {
        const dt = row.priceChangeDatetime ?? row.approvedAt ?? null;
        return isWithinRange(dt);
      });

      if (validEvents.length > 0) {
        changedMonths[m] = true;
        const lastEvent = validEvents[validEvents.length - 1];
        carry = lastEvent.newPrice ?? carry;
        activeEvent = lastEvent;
        activeEventsList = validEvents;
      } else {
        // If there were changes in this month but they are outside the custom date filter range:
        // We still carry forward the last actual change in this month (since they happened),
        // but we don't highlight the month as changed in the current filter window.
        const lastEvent = eventsInMonth[eventsInMonth.length - 1];
        carry = lastEvent.newPrice ?? carry;
        activeEvent = lastEvent;
        activeEventsList = [lastEvent];
      }
    }

    monthlyPrices[m] = carry;
    changeEvents[m] = activeEventsList;
  }

  // currentLivePrice: from the latest row for this price type overall
  const approvedRows = group.rows.filter((r) => r.requestStatus === "APPROVED");
  const latestRow = approvedRows[approvedRows.length - 1] ?? null;
  const currentLivePrice = latestRow?.currentLivePrice ?? null;

  return {
    priceTypeId: group.priceTypeId,
    priceTypeName: group.priceTypeName,
    priceTypeSort: group.priceTypeSort,
    monthlyPrices,
    changedMonths,
    changeEvents,
    currentLivePrice,
  };
}

// ---------------------------------------------------------------------------
// Annual KPI summary
// ---------------------------------------------------------------------------

/**
 * Computes annual KPI values from all rows for the selected year.
 * Uses newPrice for highest/lowest/average calculations.
 */
export function computeAnnualSummary(
  rows: ViewPriceMonitoringRow[],
  year: number,
): AnnualSummary {
  const yearRows = rows.filter((r) => {
    const dt = r.priceChangeDatetime ?? r.approvedAt;
    if (!dt) return false;
    return new Date(dt).getFullYear() === year;
  });

  const prices = yearRows
    .map((r) => r.newPrice)
    .filter((p): p is number => p !== null && Number.isFinite(p));

  if (prices.length === 0) {
    return { highestPrice: null, lowestPrice: null, averagePrice: null, totalChanges: 0 };
  }

  const highestPrice = Math.max(...prices);
  const lowestPrice = Math.min(...prices);
  const averagePrice = prices.reduce((s, v) => s + v, 0) / prices.length;

  return {
    highestPrice,
    lowestPrice,
    averagePrice: Math.round(averagePrice * 100) / 100,
    totalChanges: yearRows.length,
  };
}

/**
 * Computes overall KPI summary from all rows across all years.
 * Calculates current price, last updated date, and overall min/max with year of occurrence.
 */
export function computeOverallSummary(rows: ViewPriceMonitoringRow[]): OverallSummary {
  const approvedRows = rows.filter((r) => r.requestStatus === "APPROVED");

  if (approvedRows.length === 0) {
    return {
      currentPrice: null,
      lastUpdated: null,
      highestPrice: null,
      highestPriceYear: null,
      lowestPrice: null,
      lowestPriceYear: null,
      averagePrice: null,
      totalChanges: 0,
    };
  }

  // Sort by date ASC to find the latest update
  const sorted = [...approvedRows].sort((a, b) => {
    const tA = new Date(a.priceChangeDatetime ?? a.approvedAt ?? 0).getTime();
    const tB = new Date(b.priceChangeDatetime ?? b.approvedAt ?? 0).getTime();
    return tA - tB;
  });

  const latestRow = sorted[sorted.length - 1];
  const currentPrice = latestRow.newPrice;
  const lastUpdated = latestRow.priceChangeDatetime ?? latestRow.approvedAt;

  const validPrices = approvedRows
    .map((r) => {
      const dt = r.priceChangeDatetime ?? r.approvedAt;
      return {
        price: r.newPrice,
        year: dt ? new Date(dt).getFullYear() : null,
      };
    })
    .filter(
      (item): item is { price: number; year: number } =>
        item.price !== null &&
        item.price > 0 &&           // exclude zero-value rows (NEW PRICE with no prior price)
        Number.isFinite(item.price) &&
        item.year !== null &&
        Number.isFinite(item.year),
    );

  if (validPrices.length === 0) {
    return {
      currentPrice,
      lastUpdated,
      highestPrice: null,
      highestPriceYear: null,
      lowestPrice: null,
      lowestPriceYear: null,
      averagePrice: null,
      totalChanges: approvedRows.length,
    };
  }

  let highest = validPrices[0];
  let lowest = validPrices[0];

  for (const item of validPrices) {
    if (item.price > highest.price) highest = item;
    if (item.price < lowest.price) lowest = item;
  }

  // Calculate the average of the current (most recent/live) price for each distinct price type.
  // We sum the latest valid prices of Price Types A, B, C, D, and E, and divide by 5.
  const sortedForLatest = [...approvedRows].sort((a, b) => {
    const tA = new Date(a.priceChangeDatetime ?? a.approvedAt ?? 0).getTime();
    const tB = new Date(b.priceChangeDatetime ?? b.approvedAt ?? 0).getTime();
    if (tA !== tB) return tA - tB;
    return a.requestId - b.requestId;
  });

  const tierPrices = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const r of sortedForLatest) {
    if (r.newPrice === null || r.newPrice <= 0 || !Number.isFinite(r.newPrice)) {
      continue;
    }
    const cleanName = r.priceTypeName?.trim().toUpperCase() ?? "";
    if (cleanName === "A" || cleanName.includes("PRICE A") || cleanName.includes("TIER A") || cleanName.includes("DEALER")) {
      tierPrices.A = r.newPrice;
    } else if (cleanName === "B" || cleanName.includes("PRICE B") || cleanName.includes("TIER B") || cleanName.includes("SUB-DEALER")) {
      tierPrices.B = r.newPrice;
    } else if (cleanName === "C" || cleanName.includes("PRICE C") || cleanName.includes("TIER C") || cleanName.includes("RTO")) {
      tierPrices.C = r.newPrice;
    } else if (cleanName === "D" || cleanName.includes("PRICE D") || cleanName.includes("TIER D") || cleanName.includes("COMMERCIAL")) {
      tierPrices.D = r.newPrice;
    } else if (cleanName === "E" || cleanName.includes("PRICE E") || cleanName.includes("TIER E") || cleanName.includes("WALK-IN")) {
      tierPrices.E = r.newPrice;
    }
  }

  const sumOfTiers = tierPrices.A + tierPrices.B + tierPrices.C + tierPrices.D + tierPrices.E;
  const averagePrice = Math.round((sumOfTiers / 5) * 100) / 100;

  return {
    currentPrice,
    lastUpdated,
    highestPrice: highest.price,
    highestPriceYear: highest.year,
    lowestPrice: lowest.price,
    lowestPriceYear: lowest.year,
    averagePrice,
    totalChanges: rows.length,
  };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** Philippine Peso currency format: ₱ #,##0.00 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Percentage format with sign: +5.26% / -2.10% */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Movement badge styling helpers
// ---------------------------------------------------------------------------

/** Returns Tailwind class names for movement badge background + text color. */
export function movementBadgeClass(movement: PriceMovement | null | undefined): string {
  switch (movement) {
    case "INCREASE":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    case "DECREASE":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    case "NEW PRICE":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    case "NO CHANGE":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Returns a hex color string for chart lines per price type sort order. */
export const PRICE_TYPE_COLORS: Record<number, string> = {
  1: "#6366f1", // indigo
  2: "#f59e0b", // amber
  3: "#10b981", // emerald
  4: "#ef4444", // red
  5: "#8b5cf6", // violet
  6: "#06b6d4", // cyan
  7: "#f97316", // orange
  8: "#84cc16", // lime
  9: "#ec4899", // pink
  10: "#14b8a6", // teal
};

/** Returns a color for a price type by its sort order. Cycles after 10. */
export function getPriceTypeColor(sort: number): string {
  return PRICE_TYPE_COLORS[(((sort - 1) % 10) + 1)] ?? "#6366f1";
}

/** Short month labels for matrix columns. */
export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
