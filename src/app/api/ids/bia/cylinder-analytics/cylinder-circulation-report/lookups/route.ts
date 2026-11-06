// src/app/api/ids/bia/cylinder-analytics/cylinder-circulation-report/lookups/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// BFF route for branch and product dropdown lookups
// ──────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getCylinderCirculationLookups } from "@/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-circulation-report/services/cylinder-circulation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const lookups = await getCylinderCirculationLookups();
    return NextResponse.json({ ok: true, data: lookups });
  } catch (error) {
    console.error("[Cylinder Circulation Lookups Error]:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load lookups",
      },
      { status: 500 }
    );
  }
}
