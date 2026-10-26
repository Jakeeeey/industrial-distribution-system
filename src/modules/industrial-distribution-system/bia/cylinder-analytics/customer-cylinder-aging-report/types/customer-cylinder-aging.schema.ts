// types/customer-cylinder-aging.schema.ts
// ──────────────────────────────────────────────────────────────────────────────
// Zod schemas for Customer Cylinder Aging Report filters and API parameters.
// ──────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

export const CustomerCylinderAgingFilterSchema = z.object({
  asOfDate: z
    .string()
    .optional()
    .default(() => new Date().toISOString().split("T")[0]),
  branchId: z.coerce.number().optional().or(z.literal("")),
  customerCode: z.string().optional(),
  productId: z.coerce.number().optional().or(z.literal("")),
  agingBucket: z
    .enum([
      "ALL",
      "OVERDUE_ONLY",
      "0_15_DAYS",
      "16_30_DAYS",
      "31_60_DAYS",
      "61_90_DAYS",
      "90_PLUS_DAYS",
    ])
    .optional()
    .default("ALL"),
  agingThreshold: z.coerce.number().min(1).max(365).optional().default(30),
  searchQuery: z.string().optional().default(""),
});

export type CustomerCylinderAgingFilterInput = z.infer<
  typeof CustomerCylinderAgingFilterSchema
>;
