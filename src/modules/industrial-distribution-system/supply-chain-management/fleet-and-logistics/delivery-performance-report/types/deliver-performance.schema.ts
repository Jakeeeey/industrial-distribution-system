// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/types/deliver-performance.schema.ts
// ==============================================================================
// Delivery Performance Report - Zod Validation Schemas
// Defines parameters for querying the delivery performance BFF API.
// ==============================================================================

import { z } from "zod";

export const DeliverPerformanceFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  branchId: z.string().optional(),
  customerCode: z.string().optional(),
  driverId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional().default("dispatch_date"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type DeliverPerformanceFilterInput = z.infer<typeof DeliverPerformanceFilterSchema>;

