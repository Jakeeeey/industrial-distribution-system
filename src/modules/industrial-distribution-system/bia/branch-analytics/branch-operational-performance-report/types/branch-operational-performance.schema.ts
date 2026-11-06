// types/branch-operational-performance.schema.ts
// ──────────────────────────────────────────────────────────────────────────────
// Zod runtime validation schema for query parameters and filter options.
// ──────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

export const branchOperationalFilterSchema = z
  .object({
    branchId: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === "" || val === "all") return undefined;
        const parsed = Number(val);
        return isNaN(parsed) ? undefined : parsed;
      }),
    custodianCode: z
      .string()
      .optional()
      .transform((val) => (val && val !== "all" ? val.trim() : undefined)),
    incidentType: z
      .enum(["CYLINDER_LOST", "CYLINDER_DAMAGED", "UNRETURNED_AGING", "DELIVERY_VARIANCE", "all"])
      .optional()
      .transform((val) => (val === "all" ? undefined : val)),
    recoveryStatus: z
      .enum(["IN_CUSTODY", "PENDING_RECOVERY", "RECOVERED", "WRITTEN_OFF", "all"])
      .optional()
      .transform((val) => (val === "all" ? undefined : val)),
    chargeStatus: z
      .enum(["UNCHARGED", "ASSESSED", "CHARGED", "WAIVED", "all"])
      .optional()
      .transform((val) => (val === "all" ? undefined : val)),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return data.startDate <= data.endDate;
    },
    {
      message: "Start date cannot be after end date.",
      path: ["startDate"],
    }
  );

export type BranchOperationalFilterInput = z.infer<typeof branchOperationalFilterSchema>;
