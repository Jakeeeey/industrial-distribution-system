// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/types/lost-damaged-cylinder.schema.ts
// ==============================================================================
// Lost and Damaged Cylinder Report - Zod Validation Schemas
// Validates filter and query parameters for BFF API requests.
// ==============================================================================

import { z } from "zod";

export const LostDamagedFilterSchema = z.object({
  branchId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  datePreset: z.string().optional(),
  incidentCategory: z.enum(["ALL", "LOST", "DAMAGED"]).optional().default("ALL"),
  condition: z.enum(["ALL", "GOOD", "FOR_REPAIR", "DAMAGED", "SCRAP"]).optional().default("ALL"),
  status: z.enum(["ALL", "REPORTED", "VERIFIED", "WRITTEN_OFF", "RECOVERED"]).optional().default("ALL"),
  chargeStatus: z.enum(["ALL", "UNCHARGED", "ASSESSED", "BILLED", "SETTLED", "WAIVED"]).optional().default("ALL"),
  searchQuery: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(10),
  sortBy: z.string().optional().default("incidentDate"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type LostDamagedFilterInput = z.infer<typeof LostDamagedFilterSchema>;
