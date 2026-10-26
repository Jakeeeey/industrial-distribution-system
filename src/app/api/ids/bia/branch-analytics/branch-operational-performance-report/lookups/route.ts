// app/api/ids/bia/branch-analytics/branch-operational-performance-report/lookups/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// Lookups API endpoint for Branch and Custodian SearchableSelect filters.
// ──────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getBranchOperationalLookups } from "@/modules/industrial-distribution-system/bia/branch-analytics/branch-operational-performance-report/services/branch-operational-performance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const lookups = await getBranchOperationalLookups();
    return NextResponse.json(lookups, { status: 200 });
  } catch (error) {
    console.error("[Branch Operational Lookups API]", error);
    return NextResponse.json(
      {
        branches: [],
        custodians: [],
      },
      { status: 500 }
    );
  }
}
