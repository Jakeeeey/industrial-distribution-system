// src/app/api/ids/scm/inventory-management/reports/cylinder-stock-report/route.ts
// ==============================================================================
// Cylinder Stock Report - BFF API Route (Optimized)
// Handles query parameters, authorization token extraction, and service calls.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  fetchCylinderStockReport,
  fetchCylinderStockLookups,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/services/cylinder-stock-report.service";
import { cylinderStockFilterSchema } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/types/cylinder-stock-report.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // If 'lookups=true', return lightweight lookup filters (served from cache)
    if (searchParams.get("lookups") === "true") {
      const lookups = await fetchCylinderStockLookups();
      return NextResponse.json({ data: lookups });
    }

    const rawParams = {
      branchId: searchParams.get("branchId") || undefined,
      productId: searchParams.get("productId") || undefined,
      variantState: searchParams.get("variantState") || undefined,
      condition: searchParams.get("condition") || "ALL",
      status: searchParams.get("status") || "ALL",
      cutoffDate: searchParams.get("cutoffDate") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 25,
      sortField: searchParams.get("sortField") || "serialNumber",
      sortOrder: searchParams.get("sortOrder") || "asc",
    };

    const parsedFilters = cylinderStockFilterSchema.parse(rawParams);

    const report = await fetchCylinderStockReport(parsedFilters);

    return NextResponse.json(report);
  } catch (error: unknown) {
    console.error("[Cylinder Stock Report Route] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
