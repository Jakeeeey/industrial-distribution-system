// src/app/api/ids/scm/fleet-and-logistics/delivery-performance-report/route.ts
// ==============================================================================
// Delivery Performance Report - BFF API Endpoint
// Supports ?mode=lookups for filter dropdowns and report query aggregation.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { DeliverPerformanceFilterSchema } from "@/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/types/deliver-performance.schema";
import {
  fetchDeliverPerformanceLookups,
  fetchDeliverPerformanceReport,
} from "@/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/services/deliver-performance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    // 1. Fast lookup mode for filter dropdowns
    if (mode === "lookups") {
      const lookups = await fetchDeliverPerformanceLookups();
      return NextResponse.json({ success: true, data: lookups });
    }

    // 2. Report aggregation mode
    const rawParams: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      rawParams[key] = val;
    });

    const parsed = DeliverPerformanceFilterSchema.safeParse(rawParams);
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

    const report = await fetchDeliverPerformanceReport(parsed.data);
    return NextResponse.json({ success: true, data: report });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DeliverPerformanceReport API] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate delivery performance report",
        details: msg,
      },
      { status: 500 }
    );
  }
}

