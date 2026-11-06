// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.helpers.ts
// ==============================================================================
// Pure utility helpers for the Cylinder Utilization Report.
// No side effects, no fetch, no React — usable from the BFF route and the UI.
//
// Complies with VoSync standards:
// - Centralized formatting: every displayed metric goes through @/lib/utils
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { formatNumber } from "@/lib/utils";

/** Whole days in the Philippine reporting timezone used for generated-at stamps. */
const MANILA_LOCALE = "en-US";
const MANILA_TIMEZONE = "Asia/Manila";

/** One day in milliseconds; date-only strings are whole-day aligned anyway. */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Parses a Directus date or timestamp into epoch milliseconds.
 * Returns null for anything unusable so callers can branch on "no date resolved"
 * instead of silently comparing against 1970.
 */
export function toMillis(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Whole days elapsed from `fromMs` up to `toMs`.
 * Clamped at 0: a record stamped after the reporting cutoff is treated as fully
 * recent rather than producing a negative dormancy figure.
 */
export function daysBetween(fromMs: number | null, toMs: number): number | null {
  if (fromMs === null) return null;
  const diff = Math.floor((toMs - fromMs) / MS_PER_DAY);
  return diff > 0 ? diff : 0;
}

/**
 * Normalizes a serial number for cross-collection matching.
 * Serials are keyed on `cylinder_assets.serial_number` (unique) but are copied as
 * free text into movement rows, so casing and padding must be reconciled first.
 */
export function normalizeSerial(serial?: string | null): string {
  return (serial || "").trim().toUpperCase();
}

/** Normalizes a customer code, collapsing the internal spaces in "MAIN - 33315". */
export function normalizeCustomerCode(code?: string | null): string {
  return (code || "").replace(/\s+/g, "").toUpperCase();
}

/** Coerces a Directus number-or-string id into a number, or null when unusable. */
export function toId(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Coerces the loose `is_deleted` column (bigint 0/1, sometimes stringified). */
export function isDeletedFlag(value?: number | string | null): boolean {
  return Number(value ?? 0) === 1;
}

/**
 * Builds the "cylinder size" label (spec §11 column) from the product master.
 * AG-COMMENT: Displays products.description as product name per ids-guide rule and user prompt.
 * Falls back to product code, then to an identifiable stub ("Unmapped size").
 */
export function buildSizeLabel(
  productName?: string | null,
  productCode?: string | null
): string {
  const name = (productName || "").trim();
  const code = (productCode || "").trim();
  const label = name || code;

  if (!label) return code ? `Size ${code}` : "Unmapped size";

  return label;
}

/** Count formatter — integers, thousands separated. */
export function formatCount(value: number): string {
  return formatNumber(Number.isFinite(value) ? value : 0, MANILA_LOCALE, 0);
}

/** Percentage formatter — one decimal place, consistent with the table and exports. */
export function formatPercent(value: number): string {
  return `${formatNumber(Number.isFinite(value) ? value : 0, MANILA_LOCALE, 1)}%`;
}

/** Renders a YYYY-MM-DD string as "Apr 14, 2026"; returns an em dash when absent. */
export function formatCutoffLabel(isoDate?: string | null): string {
  const ms = toMillis(isoDate);
  if (ms === null) return "—";
  return new Date(ms).toLocaleDateString(MANILA_LOCALE, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** Generation timestamp for the audit footer, always in the reporting timezone. */
export function formatGeneratedAt(date: Date): string {
  return date.toLocaleString(MANILA_LOCALE, {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
