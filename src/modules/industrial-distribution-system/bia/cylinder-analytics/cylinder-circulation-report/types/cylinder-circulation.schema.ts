// types/cylinder-circulation.schema.ts
// ──────────────────────────────────────────────────────────────────────────────
// Zod schema validation for query inputs and runtime API payloads
// ──────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

export const cylinderCirculationFilterSchema = z.object({
  branchId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === "" || val === null) return "";
      const num = Number(val);
      return isNaN(num) ? "" : num;
    }),
  productId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === "" || val === null) return "";
      const num = Number(val);
      return isNaN(num) ? "" : num;
    }),
  circulationStatus: z
    .enum([
      "ALL",
      "BREAKS_ONLY",
      "HEALTHY",
      "BREAK_MISSING_RETURN",
      "BREAK_UNVERIFIED_TRANSIT",
      "BREAK_LOCATION_CONFLICT",
      "BREAK_ORPHAN_RETURN",
      "BREAK_STATUS_MISMATCH",
    ])
    .optional()
    .default("ALL"),
  serialNumber: z.string().optional().default(""),
  serialNumbers: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
});

export type CylinderCirculationFilterInput = z.infer<typeof cylinderCirculationFilterSchema>;
