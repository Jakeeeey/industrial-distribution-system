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
  grade: z
    .enum(["ALL", "CTR_4", "CTR_6", "CTR_8", "SUB_STANDARD", "BASE_ZERO"])
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

export const TurnaroundWorkflowActionSchema = z.object({
  assessmentNo: z.string().optional(),
  targetStatus: z.enum(["DRAFT", "FOR_REVIEW", "APPROVED", "LOCKED"]),
  userRole: z.enum(["Sales", "Inventory", "Finance", "Management", "Administrator"]),
  userName: z.string().default("System User"),
  reason: z.string().min(3, "A valid reason is required for status updates"),
});

export type TurnaroundWorkflowActionInput = z.infer<
  typeof TurnaroundWorkflowActionSchema
>;
