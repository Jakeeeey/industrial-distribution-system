// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/types/sales-performance.schema.ts
// ==============================================================================
// Sales Performance Report - Zod Filter Schema & Input Validation
// Handles parsing of query string filters with safe defaults and sanitization.
// ==============================================================================

import { z } from "zod";

export const SalesPerformanceFilterSchema = z.object({
  branchId: z.string().default("ALL"),
  customerCode: z.string().default("ALL"),
  productId: z.string().default("ALL"),
  salesmanId: z.string().default("ALL"),
  startDate: z.string().optional().default(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split("T")[0];
  }),
  endDate: z.string().optional().default(() => {
    return new Date().toISOString().split("T")[0];
  }),
  datePreset: z
    .enum(["today", "this_week", "this_month", "custom"])
    .default("this_month"),
  taxTreatment: z.enum(["ALL", "VAT", "NON_VAT"]).default("ALL"),
  searchQuery: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(10),
  sortBy: z.enum(["invoiceDate", "netSales", "kgSold", "customerName", "branchName"]).default("invoiceDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type SalesPerformanceFilterInput = z.infer<typeof SalesPerformanceFilterSchema>;
