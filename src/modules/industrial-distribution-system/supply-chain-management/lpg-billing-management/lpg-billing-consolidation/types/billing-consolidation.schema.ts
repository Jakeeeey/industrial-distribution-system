// ─── billing-consolidation.schema.ts ─────────────────────────────────────────
// Zod schemas for POST/PATCH validation in the API route layer.
// These enforce that reviewer adjustments always include required fields and
// that values are within sane numeric ranges before hitting the service layer.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ─── Meter Reading Adjustment ─────────────────────────────────────────────────

export const MeterReadingAdjustSchema = z.object({
  transactionId: z.number().int().positive(),
  meterReadingId: z.number().int().positive(),
  /** Corrected current reading value from the reviewer (must be >= 0) */
  new_current_reading: z.number().min(0),
  adjustment_reason: z.string().min(1, "Adjustment reason is required"),
  modified_by: z.number().int().positive(),
});

export type MeterReadingAdjustInput = z.infer<typeof MeterReadingAdjustSchema>;

// ─── WIWO Detail Adjustment ───────────────────────────────────────────────────

export const WiwoDetailAdjustSchema = z.object({
  transactionId: z.number().int().positive(),
  wiwoDetailId: z.number().int().positive(),
  wiwoHeaderId: z.number().int().positive(),
  /** Corrected returned gross weight in kg (must be >= 0) */
  new_returned_gross_weight_kg: z.number().min(0),
  adjustment_reason: z.string().min(1, "Adjustment reason is required"),
  modified_by: z.number().int().positive(),
});

export type WiwoDetailAdjustInput = z.infer<typeof WiwoDetailAdjustSchema>;

// ─── Approve Header ───────────────────────────────────────────────────────────

export const ApproveHeaderSchema = z.object({
  headerId: z.number().int().positive(),
  approved_by: z.number().int().positive(),
});

export type ApproveHeaderInput = z.infer<typeof ApproveHeaderSchema>;
