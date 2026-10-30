// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.rules.ts
// ==============================================================================
// Utilization Rules — pure, side-effect free classification logic.
//
// Imported by BOTH the BFF route (to compute figures) and the UI rule legend (to
// display them), which is what keeps the published rule and the applied rule from
// drifting apart. Spec §4 asks for the eligible statuses and idle threshold to be
// "defined in settings"; the platform has no settings collection, so the rules are
// declared here as named constants and surfaced verbatim in the report legend.
//
// Source domain verified against the `cylinder_assets` DDL:
//   cylinder_status    ENUM('AVAILABLE','FULL','EMPTY','RESERVED','LOADED',
//                           'WITH_CUSTOMER','DAMAGED','LOST','RETIRED')
//   cylinder_condition ENUM('GOOD','FOR_REPAIR','DAMAGED','SCRAP')
// Any value outside those ENUM domains is not silently coerced — it is reported
// as UNCLASSIFIED so a data exception stays visible (spec §8).
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// - Pure TypeScript (no React, no fetch) so it runs on server and client
// ==============================================================================

import type { UtilizationBucket, UtilizationRuleSnapshot } from "../types/cylinder-utilization-report.types";

// ── Idle threshold ───────────────────────────────────────────────────────────
// 30 days matches the first stagnation tier already published by the Cylinder
// Deposit & Swap report, so the two BIA reports agree on what "idle" means.
export const IDLE_THRESHOLD_DAYS = 30;

// ── Status sets (mutually exclusive by precedence, see classifyAsset) ────────
/** Deployed out and earning: at a customer, or loaded onto a delivery route. */
export const CIRCULATING_STATUSES: readonly string[] = ["WITH_CUSTOMER", "LOADED"];

/** Physically held in a branch yard and still counted as eligible fleet. */
export const YARD_STATUSES: readonly string[] = ["AVAILABLE", "FULL", "EMPTY", "RESERVED"];

/** A repairable defect — eligible fleet, but not able to circulate. */
export const MAINTENANCE_STATUSES: readonly string[] = ["DAMAGED"];
export const MAINTENANCE_CONDITIONS: readonly string[] = ["FOR_REPAIR", "DAMAGED"];

/** Written off the fleet entirely; excluded from the utilization denominator. */
export const UNAVAILABLE_STATUSES: readonly string[] = ["LOST", "RETIRED"];
export const UNAVAILABLE_CONDITIONS: readonly string[] = ["SCRAP"];

/** Every status the source ENUM can legally hold. */
export const KNOWN_STATUSES: readonly string[] = [
  ...CIRCULATING_STATUSES,
  ...YARD_STATUSES,
  ...MAINTENANCE_STATUSES,
  ...UNAVAILABLE_STATUSES,
];

/** Human labels for the legend, table badges and exports. */
export const BUCKET_LABELS: Record<UtilizationBucket, string> = {
  CIRCULATING: "Circulating",
  AVAILABLE: "Available",
  IDLE: "Idle",
  MAINTENANCE: "Maintenance",
  UNAVAILABLE: "Unavailable",
  UNCLASSIFIED: "Unclassified",
};

/** Buckets that belong in the utilization denominator. */
const ELIGIBLE_BUCKETS: readonly UtilizationBucket[] = ["CIRCULATING", "AVAILABLE", "IDLE", "MAINTENANCE"];

/**
 * Upper-cases and trims a raw Directus status/condition value. Returns an empty
 * string for null, blank or whitespace-only input so callers can distinguish a
 * genuinely missing status from an unrecognised one.
 */
export function normalizeCode(value?: string | null): string {
  return (value || "").trim().toUpperCase();
}

/** True when a bucket counts toward the eligible fleet denominator. */
export function isEligibleBucket(bucket: UtilizationBucket): boolean {
  return ELIGIBLE_BUCKETS.includes(bucket);
}

/**
 * Resolves one asset to exactly one bucket.
 *
 * Precedence is deliberately ordered so the categories stay mutually exclusive
 * (spec §8 "do not count a cylinder in multiple categories"):
 *   1. UNCLASSIFIED — status missing or outside the ENUM domain (data exception)
 *   2. UNAVAILABLE  — written off (lost / retired / scrapped)
 *   3. MAINTENANCE  — a repairable defect beats every other reading, including
 *                     "circulating": a damaged cylinder reported as WITH_CUSTOMER
 *                     is still out of service, not earning.
 *   4. CIRCULATING  — deployed with a customer or loaded for delivery
 *   5. IDLE / AVAILABLE — a yard asset is idle once dormant past the threshold
 *
 * @param status       raw `cylinder_status`
 * @param condition    raw `cylinder_condition`
 * @param idleDays     whole days between last activity and the reporting cutoff,
 *                     or null when no activity date could be resolved
 */
export function classifyAsset(
  status?: string | null,
  condition?: string | null,
  idleDays: number | null = null
): UtilizationBucket {
  const stat = normalizeCode(status);
  const cond = normalizeCode(condition);

  if (!stat || !KNOWN_STATUSES.includes(stat)) return "UNCLASSIFIED";
  if (UNAVAILABLE_STATUSES.includes(stat) || UNAVAILABLE_CONDITIONS.includes(cond)) return "UNAVAILABLE";
  if (MAINTENANCE_STATUSES.includes(stat) || MAINTENANCE_CONDITIONS.includes(cond)) return "MAINTENANCE";
  if (CIRCULATING_STATUSES.includes(stat)) return "CIRCULATING";

  // YARD_STATUSES only reach here; an unresolvable date is treated as fresh so a
  // missing timestamp never inflates the idle figure.
  if (idleDays !== null && idleDays > IDLE_THRESHOLD_DAYS) return "IDLE";
  return "AVAILABLE";
}

/**
 * Utilization = circulating ÷ eligible fleet × 100 (spec §4).
 * Returns 0 rather than NaN when the eligible fleet is empty.
 */
export function computeUtilization(circulating: number, eligibleFleet: number): number {
  if (!Number.isFinite(eligibleFleet) || eligibleFleet <= 0) return 0;
  return roundRatio((circulating / eligibleFleet) * 100);
}

/** Rate helper for the secondary ratios (idle rate, maintenance rate). */
export function computeRate(numerator: number, eligibleFleet: number): number {
  if (!Number.isFinite(eligibleFleet) || eligibleFleet <= 0) return 0;
  return roundRatio((numerator / eligibleFleet) * 100);
}

/** Percentages are shown at one decimal place everywhere, including exports. */
export function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

/**
 * The rule set actually applied, echoed into the API response so the UI legend
 * and the exports always state the same definitions the figures were built from.
 */
export function getRuleSnapshot(): UtilizationRuleSnapshot {
  return {
    idleThresholdDays: IDLE_THRESHOLD_DAYS,
    circulatingStatuses: [...CIRCULATING_STATUSES],
    yardStatuses: [...YARD_STATUSES],
    maintenanceStatuses: [...MAINTENANCE_STATUSES],
    maintenanceConditions: [...MAINTENANCE_CONDITIONS],
    unavailableStatuses: [...UNAVAILABLE_STATUSES],
    unavailableConditions: [...UNAVAILABLE_CONDITIONS],
    activityBasis: [
      "cylinder_assets.modified_date (audit stamp, ON UPDATE CURRENT_TIMESTAMP)",
      "sales_order_details_serial.delivery_date (verified orders only)",
      "lpg_customer_site_cylinders.installed_date / removed_date",
    ],
  };
}
