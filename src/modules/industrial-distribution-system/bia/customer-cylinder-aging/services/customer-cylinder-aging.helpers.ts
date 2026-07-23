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
 * Values match the SQL CASE thresholds exactly.
 */
export function formatRecommendedAction(action: RecommendedAction | null): string {
  if (!action) return "—";
  const MAP: Record<RecommendedAction, string> = {
    NO_ACTION_REQUIRED: "No Action Required",
    MONITOR_CUSTOMER: "Monitor Customer",
    FOLLOW_UP_CUSTOMER: "Follow Up Customer",
    FOR_PULL_OUT_REVIEW: "For Pull-Out Review",
    VERIFY_CUSTOMER: "Verify Customer",
  };
  return MAP[action] ?? action;
}

/**
 * Maps CustomerActivityStatus to a human-readable label.
 * Values match the SQL CASE thresholds exactly.
 */
export function formatActivityStatus(status: CustomerActivityStatus | null): string {
  if (!status) return "—";
  const MAP: Record<CustomerActivityStatus, string> = {
    ACTIVE: "Active",
    MONITORING: "Monitoring",
    WARNING: "Warning",
    INACTIVE: "Inactive",
    CRITICAL: "Critical",
    NO_TRANSACTION_RECORD: "No Transaction",
    UNKNOWN: "Unknown",
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
    CYLINDER_CREATED_DATE_FALLBACK: "Created Date (Fallback)",
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
 * ACTIVE = green (default), MONITORING/WARNING = amber (secondary),
 * INACTIVE/CRITICAL/NO_TRANSACTION_RECORD = red (destructive).
 */
export function resolveActivityStatusVariant(
  status: CustomerActivityStatus | null
): "default" | "secondary" | "destructive" {
  if (!status) return "secondary";
  if (status === "ACTIVE") return "default";
  if (status === "MONITORING" || status === "WARNING") return "secondary";
  return "destructive"; // INACTIVE, CRITICAL, NO_TRANSACTION_RECORD, UNKNOWN
}

/**
 * Returns badge variant for RecommendedAction.
 * NO_ACTION_REQUIRED = green, MONITOR_CUSTOMER/FOLLOW_UP_CUSTOMER = amber,
 * FOR_PULL_OUT_REVIEW/VERIFY_CUSTOMER = red.
 */
export function resolveActionVariant(
  action: RecommendedAction | null
): "default" | "secondary" | "destructive" {
  if (!action) return "secondary";
  if (action === "NO_ACTION_REQUIRED") return "default";
  if (action === "FOR_PULL_OUT_REVIEW" || action === "VERIFY_CUSTOMER") return "destructive";
  return "secondary"; // MONITOR_CUSTOMER, FOLLOW_UP_CUSTOMER
}

export type CustomerSegment = "COMMERCIAL" | "RETAIL" | "RESIDENTIAL";

export interface SegmentInfo {
  segment: CustomerSegment;
  limitDays: number;
  label: string;
  badgeColor: string;
}

export function resolveCustomerSegment(
  name: string | null,
  store: string | null
): SegmentInfo {
  const haystack = `${name || ""} ${store || ""}`.toLowerCase();

  if (
    haystack.includes("restaurant") ||
    haystack.includes("industrial") ||
    haystack.includes("corp") ||
    haystack.includes("inc") ||
    haystack.includes("co") ||
    haystack.includes("hotel") ||
    haystack.includes("kitchen") ||
    haystack.includes("cafe") ||
    haystack.includes("grill") ||
    haystack.includes("food") ||
    haystack.includes("lpg") ||
    haystack.includes("distributor") ||
    haystack.includes("factory") ||
    haystack.includes("plant") ||
    haystack.includes("engineering")
  ) {
    return {
      segment: "COMMERCIAL",
      limitDays: 15,
      label: "Commercial",
      badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20 font-bold tracking-wider",
    };
  }

  if (
    haystack.includes("store") ||
    haystack.includes("sari-sari") ||
    haystack.includes("retail") ||
    haystack.includes("mart") ||
    haystack.includes("market") ||
    haystack.includes("shop") ||
    haystack.includes("gas") ||
    haystack.includes("bakery") ||
    haystack.includes("grocery")
  ) {
    return {
      segment: "RETAIL",
      limitDays: 20,
      label: "Retail",
      badgeColor: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20 hover:bg-indigo-500/20 font-bold tracking-wider",
    };
  }

  return {
    segment: "RESIDENTIAL",
    limitDays: 40,
    label: "Residential",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 font-bold tracking-wider",
  };
}
