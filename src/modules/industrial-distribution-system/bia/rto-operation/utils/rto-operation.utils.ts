// utils/rto-operation.utils.ts
// ──────────────────────────────────────────────────────────────────────────────
// Pure utility functions for the BIA RTO Operation module.
// Zero side effects — no API calls, no React.
// ──────────────────────────────────────────────────────────────────────────────

import type {
  RTODealerRecord,
  RTOKPISummary,
  MissingStatus,
  BalanceStatus,
} from "../types";

// ── Risk classification ────────────────────────────────────────────────────────

/**
 * Classifies the number of missing tanks into a risk tier.
 *   normal   → 0–50
 *   warning  → 51–100
 *   critical → >100
 */
export function computeMissingStatus(missingTanks: number): MissingStatus {
  if (missingTanks > 100) return "critical";
  if (missingTanks > 50) return "warning";
  return "normal";
}

/**
 * Classifies unpaid balance into a payment risk tier.
 *   paid → balance === 0
 *   low  → 0 < balance < 60,000
 *   high → balance >= 60,000
 */
export function computeBalanceStatus(unpaidBalance: number): BalanceStatus {
  if (unpaidBalance <= 0) return "paid";
  if (unpaidBalance < 100_000) return "low";
  return "high";
}

// ── KPI aggregation ───────────────────────────────────────────────────────────

/**
 * Computes module-level KPI cards from the full dealer list.
 */
export function computeRTOKPIs(dealers: RTODealerRecord[]): RTOKPISummary {
  let criticalDealers = 0;
  let warningDealers = 0;
  let totalMissingTanks = 0;
  let totalFinancialExposure = 0;
  let totalUnpaidBalance = 0;

  for (const d of dealers) {
    if (d.missingStatus === "critical") criticalDealers++;
    else if (d.missingStatus === "warning") warningDealers++;
    totalMissingTanks += d.missingTanks;
    totalFinancialExposure += d.financialExposure ?? 0;
    totalUnpaidBalance += d.unpaidBalance;
  }

  return {
    totalDealers: dealers.length,
    criticalDealers,
    warningDealers,
    totalMissingTanks,
    totalFinancialExposure,
    totalUnpaidBalance,
  };
}

// ── Badge / color helpers ──────────────────────────────────────────────────────

/** Returns a Tailwind CSS class string for the missing-status badge. */
export function resolveMissingStatusBadgeClass(status: MissingStatus): string {
  switch (status) {
    case "critical":
      return "bg-red-100 text-red-700 border-red-200";
    case "warning":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "normal":
    default:
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
}

/** Returns a Tailwind CSS class string for the balance-status badge. */
export function resolveBalanceStatusBadgeClass(status: BalanceStatus): string {
  switch (status) {
    case "high":
      return "bg-red-100 text-red-700 border-red-200";
    case "low":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "paid":
    default:
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
}

/** Human-readable label for missing status. */
export function formatMissingStatus(status: MissingStatus): string {
  switch (status) {
    case "critical": return "Critical";
    case "warning":  return "Warning";
    case "normal":   return "Normal";
  }
}

/** Human-readable label for balance status. */
export function formatBalanceStatus(status: BalanceStatus): string {
  switch (status) {
    case "high": return "High Balance";
    case "low":  return "Low Balance";
    case "paid": return "Paid";
  }
}

// ── Currency / number formatting ───────────────────────────────────────────────

/**
 * Formats a number as Philippine Peso currency.
 * e.g.  112500 → "₱112,500.00"
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) to a human-readable form.
 * e.g. "2024-05-01" → "May 1, 2024"
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Debounce utility — delays execution until delay ms after the last call.
 * Used in search input components.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
