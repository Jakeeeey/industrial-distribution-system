// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/types/cylinder-utilization-report.schema.ts
// ==============================================================================
// Zod schemas for the Cylinder Utilization Report.
//
// The Architecture Rules require validation before data enters the service layer.
// This report is read-only, so the gate applies to the query string the browser
// supplies to the BFF — an unvalidated `branchId` would otherwise be interpolated
// straight into a Directus filter.
//
// Complies with VoSync standards:
// - Types are imported from the sibling `.types.ts`; this file never redeclares them
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { z } from "zod";

/** A branch or size selector: a positive integer id, or empty/"ALL" for no scoping. */
// AG-COMMENT: Supports single positive integer, ALL, NONE, or comma-separated list of IDs for multi-select
const idOrAll = z.union([z.coerce.number().int().positive(), z.literal(""), z.literal("ALL"), z.literal("NONE"), z.string()]);

/**
 * A real calendar date in YYYY-MM-DD form.
 * A shape-only regex accepted impossible dates such as `2026-13-45`, which then
 * parsed to Invalid Date and silently fell back to the default period; the round-trip
 * check rejects them at the boundary instead.
 */
const isoDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}, "must be a real calendar date in YYYY-MM-DD form");

/**
 * Validates the primary report endpoint's query string.
 * Dates stay as YYYY-MM-DD strings; the route owns the defaulting so the UI and a
 * bare URL request resolve to the same period.
 */
export const cylinderUtilizationQuerySchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  branchId: idOrAll.optional(),
  productId: idOrAll.optional(),
});

/**
 * Validates the drill-down query string. `branchId` and `productId` identify the
 * grouping the caller expanded; "ALL" and empty both mean the pseudo-grouping
 * (unassigned branch / unmapped size), which is why they are normalised in the
 * route rather than rejected here.
 */
export const cylinderUtilizationDetailSchema = z.object({
  detail: z.literal("1"),
  branchId: z.string().min(1),
  productId: z.string().min(1),
  bucket: z
    .enum(["CIRCULATING", "AVAILABLE", "IDLE", "MAINTENANCE", "UNAVAILABLE", "UNCLASSIFIED", "ALL"])
    .optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});

export type CylinderUtilizationQuery = z.infer<typeof cylinderUtilizationQuerySchema>;
export type CylinderUtilizationDetailQuery = z.infer<typeof cylinderUtilizationDetailSchema>;
