// src/app/api/ids/bia/cylinder-analytics/cylinder-circulation-report/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// BFF route for Cylinder Circulation Report.
// Validates filter query params, retrieves JWT, and invokes the service layer.
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { cylinderCirculationFilterSchema } from "@/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-circulation-report/types/cylinder-circulation.schema";
import { generateCylinderCirculationReport } from "@/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-circulation-report/services/cylinder-circulation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const url = new URL(req.url);

    const rawParams = {
      branchId: url.searchParams.get("branchId") || undefined,
      productId: url.searchParams.get("productId") || undefined,
      circulationStatus: url.searchParams.get("circulationStatus") || "ALL",
      serialNumber: url.searchParams.get("serialNumber") || undefined,
      startDate: url.searchParams.get("startDate") || undefined,
      endDate: url.searchParams.get("endDate") || undefined,
    };

    const parsedFilters = cylinderCirculationFilterSchema.parse(rawParams);
    const reportData = await generateCylinderCirculationReport(parsedFilters, token);

    return NextResponse.json({ ok: true, data: reportData });
  } catch (error) {
    console.error("[Cylinder Circulation Report API Error]:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
