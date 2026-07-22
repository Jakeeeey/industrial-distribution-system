import type {
  CylinderPurchaseReportFilters,
  CylinderPurchaseRow,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportLookupQuerySchema = z.object({
  type: z.enum(["customers", "products", "branches", "salespeople"]),
  q: z.string().trim().max(100).default(""),
});

export const cylinderPurchaseFilterSchema = z
  .object({
    customerCode: z.string().trim().min(1).optional(),
    productId: z.coerce.number().int().positive().optional(),
    branchId: z.coerce.number().int().positive().optional(),
    salesmanId: z.coerce.number().int().positive().optional(),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "startDate must be on or before endDate",
    path: ["startDate"],
  }) satisfies z.ZodType<CylinderPurchaseReportFilters>;

export const cylinderPurchaseRowSchema = z.object({
  customerCode: z.string().nullable(),
  customerName: z.string().nullable(),
  invoiceDate: isoDate,
  productId: z.number().int().positive(),
  productCode: z.string(),
  productName: z.string(),
  branchId: z.number().int().positive(),
  branchCode: z.string(),
  branchName: z.string(),
  salesmanId: z.number().int().positive(),
  salesmanCode: z.string(),
  salesmanName: z.string(),
  grossPurchasedQty: z.number().finite().nonnegative(),
  returnedQty: z.number().finite().nonnegative(),
  netPurchasedQty: z.number().finite(),
}) satisfies z.ZodType<CylinderPurchaseRow>;

export const cylinderPurchaseRowsSchema = z.array(cylinderPurchaseRowSchema);
