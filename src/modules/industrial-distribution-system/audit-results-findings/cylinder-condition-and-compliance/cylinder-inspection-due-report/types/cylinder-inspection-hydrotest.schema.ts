// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/types/cylinder-inspection-hydrotest.schema.ts
// ==============================================================================
// Cylinder Inspection and Hydrotest Due Report - Zod Validation Schemas
// Enforces request parameter safety and defaults for filter inputs.
// ==============================================================================

import { z } from "zod";

export const CylinderInspectionFilterSchema = z.object({
  branchId: z
    .string()
    .optional()
    .transform((val) => (val && val !== "ALL" ? val : undefined)),
  complianceStatus: z
    .enum(["ALL", "OVERDUE", "DUE_SOON", "FAILED", "MISSING_CERT", "COMPLIANT"])
    .optional()
    .default("ALL"),
  condition: z
    .enum(["ALL", "GOOD", "FOR_REPAIR", "DAMAGED", "SCRAP"])
    .optional()
    .default("ALL"),
  warningDays: z.coerce.number().int().min(7).max(365).optional().default(30),
  productId: z
    .string()
    .optional()
    .transform((val) => (val && val !== "ALL" ? Number(val) : undefined)),
  searchQuery: z.string().optional().default(""),
  includeRetired: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
      return false;
    })
    .default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(200).optional().default(10),
  sortBy: z.string().optional().default("expirationDate"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type CylinderInspectionFilterInput = z.infer<typeof CylinderInspectionFilterSchema>;
