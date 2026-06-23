// types/customer-cylinder-aging.schema.ts
// ──────────────────────────────────────────────────────────────────────────────
// Zod schemas for the filter form.
// Imports type aliases from .types.ts for alignment.
// ──────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

/**
 * Zod schema for the filter bar form.
 * All fields are optional — the endpoint accepts any combination.
 * Date fields are validated as YYYY-MM-DD strings.
 */
export const customerCylinderAgingFilterSchema = z.object({
  // Spring accepts productId as an integer query param
  productId: z
    .union([z.number().int().positive(), z.literal("")])
    .optional(),

  // Free-text customer code (e.g., "MAIN - 31593")
  customerCode: z.string().optional(),

  // ISO date strings — validated loosely; Spring does the real validation
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .or(z.literal("")),

  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
});

export type CustomerCylinderAgingFilterForm = z.infer<
  typeof customerCylinderAgingFilterSchema
>;
