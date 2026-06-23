// services/customer-cylinder-aging.helpers.ts
// ──────────────────────────────────────────────────────────────────────────────
// Pure utility functions — zero side effects, no fetch calls.
// All aging-related display logic lives here so components stay thin.
// ──────────────────────────────────────────────────────────────────────────────

import type {
  RecommendedAction,
  CustomerActivityStatus,
  AgingBasisSource,
} from "../types/customer-cylinder-aging.types";

// ── Aging severity thresholds ─────────────────────────────────────────────────
// 0-30 days   → low risk (default/green)
// 31-90 days  → medium risk (warning/amber)
// >90 days    → high risk (destructive/red)
const MEDIUM_THRESHOLD = 31;
const HIGH_THRESHOLD = 91;

/** Returns a Shadcn Badge variant string based on aging severity. */
export function resolveAgingBadgeVariant(
  days: number | null
): "default" | "secondary" | "destructive" {
  if (days === null) return "secondary";
  if (days >= HIGH_THRESHOLD) return "destructive";
  if (days >= MEDIUM_THRESHOLD) return "secondary";
  return "default";
}

/**
 * Returns a CSS class for aging day count text color — used in table cells.
 * Complements resolveAgingBadgeVariant for non-badge contexts.
 */
export function resolveAgingTextClass(days: number | null): string {
  if (days === null) return "text-muted-foreground";
  if (days >= HIGH_THRESHOLD) return "text-destructive font-bold";
  if (days >= MEDIUM_THRESHOLD) return "text-amber-500 font-semibold";
  return "text-emerald-500 font-medium";
}

/**
 * Formats daysWithCustomer as a human-readable string.
 * @example formatDaysWithCustomer(5)  → "5 days"
 * @example formatDaysWithCustomer(null) → "N/A"
 */
export function formatDaysWithCustomer(days: number | null): string {
  if (days === null || days === undefined) return "N/A";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/**
 * Maps RecommendedAction enum to a human-readable label.
 */
export function formatRecommendedAction(action: RecommendedAction | null): string {
  if (!action) return "—";
  const MAP: Record<RecommendedAction, string> = {
    OK: "OK",
    FOLLOW_UP: "Follow Up",
    RETRIEVE: "Retrieve",
    VERIFY_CUSTOMER: "Verify Customer",
  };
  return MAP[action] ?? action;
}

/**
 * Maps CustomerActivityStatus to a human-readable label.
 */
export function formatActivityStatus(status: CustomerActivityStatus | null): string {
  if (!status) return "—";
  const MAP: Record<CustomerActivityStatus, string> = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    NO_TRANSACTION_RECORD: "No Transaction",
  };
  return MAP[status] ?? status;
}

/**
 * Maps AgingBasisSource to a short descriptive label for the UI.
 * Explains to the user WHY this particular date was used as the aging basis.
 */
export function formatAgingBasisSource(source: AgingBasisSource | null): string {
  if (!source) return "—";
  const MAP: Record<AgingBasisSource, string> = {
    DEPLOYED_DATE: "Deploy Date",
    LAST_TRANSACTION_DATE: "Last Transaction",
    CYLINDER_MODIFIED_DATE_FALLBACK: "Modified Date (Fallback)",
  };
  return MAP[source] ?? source;
}

/**
 * Formats a YYYY-MM-DD string to a locale date string.
 * Returns "—" for null/empty.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Returns badge variant for CustomerActivityStatus.
 */
export function resolveActivityStatusVariant(
  status: CustomerActivityStatus | null
): "default" | "secondary" | "destructive" {
  if (!status) return "secondary";
  if (status === "ACTIVE") return "default";
  if (status === "NO_TRANSACTION_RECORD") return "destructive";
  return "secondary";
}

/**
 * Returns badge variant for RecommendedAction.
 */
export function resolveActionVariant(
  action: RecommendedAction | null
): "default" | "secondary" | "destructive" {
  if (!action) return "secondary";
  if (action === "OK") return "default";
  if (action === "RETRIEVE" || action === "VERIFY_CUSTOMER") return "destructive";
  return "secondary";
}
