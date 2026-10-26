// src/app/api/ids/bia/sales-analytics/sales-performance-report/route.ts
// ==============================================================================
// Sales Performance Report - BFF API Endpoint
// Route: /api/ids/bia/sales-analytics/sales-performance-report
// Supports ?mode=lookups and paginated report queries with Zod validation.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { SalesPerformanceFilterSchema } from "@/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/types/sales-performance.schema";
import {
  fetchSalesPerformanceLookups,
  fetchSalesPerformanceReport,
} from "@/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/services/sales-performance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    // 1. Fast lookup mode for filter dropdowns
    if (mode === "lookups") {
      const lookups = await fetchSalesPerformanceLookups();
      return NextResponse.json({ success: true, data: lookups });
    }

    // 2. Report aggregation mode
    const rawParams: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      rawParams[key] = val;
    });

    const parsed = SalesPerformanceFilterSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const report = await fetchSalesPerformanceReport(parsed.data);
    return NextResponse.json({ success: true, data: report });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SalesPerformanceReport API] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate sales performance report",
        details: msg,
      },
      { status: 500 }
    );
  }
}
