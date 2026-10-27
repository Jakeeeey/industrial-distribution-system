// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/types/cylinder-stock-report.schema.ts
// ==============================================================================
// Cylinder Stock Report - Validation Schemas
// Complies with VoSync development standards:
// - Comprehensive comments left behind for maintainability
// - Schema validation for search, filter query parameters with productId & variantState
// ==============================================================================

import { z } from "zod";

export const cylinderStockFilterSchema = z.object({
  branchId: z.coerce.number().optional(),
  productId: z.coerce.number().optional(),
  variantState: z.string().optional(),
  condition: z.enum(["ALL", "GOOD", "FOR_REPAIR", "DAMAGED", "SCRAP"]).default("ALL"),
  status: z
    .enum([
      "ALL",
      "AVAILABLE",
      "FULL",
      "EMPTY",
      "RESERVED",
      "LOADED",
      "WITH_CUSTOMER",
      "DAMAGED",
      "LOST",
      "RETIRED",
      "WITH_SUPPLIER",
      "UNRECEIVED/REPLACED",
      "IN_TRANSIT",
    ])
    .default("ALL"),
  cutoffDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(500).default(25),
  sortField: z.string().default("serialNumber"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type CylinderStockFilterInput = z.infer<typeof cylinderStockFilterSchema>;
