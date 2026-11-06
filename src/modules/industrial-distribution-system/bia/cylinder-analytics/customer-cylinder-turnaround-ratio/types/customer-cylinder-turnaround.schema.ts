// types/customer-cylinder-turnaround.schema.ts
// ──────────────────────────────────────────────────────────────────────────────
// Zod schemas for Customer Cylinder Turnaround Ratio (CTR) filter and calculation requests.
// ──────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

export type DatePresetType =
  | "TODAY"
  | "THIS_WEEK"
  | "THIS_MONTH"
  | "THIS_YEAR"
  | "CUSTOM";

export const CustomerCylinderTurnaroundFilterSchema = z.object({
  datePreset: z
    .enum(["TODAY", "THIS_WEEK", "THIS_MONTH", "THIS_YEAR", "CUSTOM"])
    .optional()
    .default("THIS_YEAR"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  periodYear: z.coerce.number().min(2020).max(2050).default(() => new Date().getFullYear()),
  periodStartMonth: z.coerce.number().min(1).max(12).default(1),
  periodEndMonth: z.coerce.number().min(1).max(12).default(10),
  branchId: z.coerce.number().optional().or(z.literal("")),
  customerCode: z.string().optional(),
  // Added UNMONITORED to schema enum for filter selection
  grade: z
    .enum(["ALL", "CTR_4", "CTR_6", "CTR_8", "SUB_STANDARD", "BASE_ZERO", "UNMONITORED"])
    .optional()
    .default("ALL"),
  status: z
    .enum(["ALL", "DRAFT", "FOR_REVIEW", "APPROVED", "LOCKED"])
    .optional()
    .default("ALL"),
  searchQuery: z.string().optional().default(""),
});

export type CustomerCylinderTurnaroundFilterInput = z.infer<
  typeof CustomerCylinderTurnaroundFilterSchema
>;
