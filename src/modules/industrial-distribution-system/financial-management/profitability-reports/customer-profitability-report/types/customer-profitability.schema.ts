// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/types/customer-profitability.schema.ts
// ==============================================================================
// Customer Profitability Report - Zod Validation Schema
// Validates query parameters and client filter inputs.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

import { z } from "zod";

export const CustomerProfitabilityFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  datePreset: z
    .enum(["this_month", "last_month", "qtd", "ytd", "custom"])
    .optional()
    .default("this_month"),
  branchId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "" || val === "all") return "all" as const;
      const num = Number(val);
      return isNaN(num) ? ("all" as const) : num;
    }),
  tier: z
    .enum(["all", "HIGH", "MODERATE", "MARGINAL", "LOSS", "INCOMPLETE"])
    .optional()
    .default("all"),
  searchQuery: z.string().optional().default(""),
  page: z
    .union([z.string(), z.number()])
    .optional()
    .default(1)
    .transform((val) => Math.max(1, Number(val) || 1)),
  pageSize: z
    .union([z.string(), z.number()])
    .optional()
    .default(10)
    .transform((val) => {
      const parsed = Number(val) || 10;
      return [10, 20, 50, 100].includes(parsed) ? parsed : 10;
    }),
  sortBy: z.string().optional().default("contributionMargin"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type CustomerProfitabilityFilterInput = z.infer<
  typeof CustomerProfitabilityFilterSchema
>;
