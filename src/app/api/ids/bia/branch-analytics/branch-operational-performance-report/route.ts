// app/api/ids/bia/branch-analytics/branch-operational-performance-report/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// BFF route for Branch Operational Performance Report.
// Extracts vos_access_token JWT cookie and passes it to query Spring views.
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { branchOperationalFilterSchema } from "@/modules/industrial-distribution-system/bia/branch-analytics/branch-operational-performance-report/types/branch-operational-performance.schema";
import { getBranchOperationalDashboard } from "@/modules/industrial-distribution-system/bia/branch-analytics/branch-operational-performance-report/services/branch-operational-performance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = branchOperationalFilterSchema.safeParse(searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_FILTERS",
        message: parsed.error.issues[0]?.message || "Invalid filter parameters provided.",
      },
      { status: 400 }
    );
  }

  try {
    const data = await getBranchOperationalDashboard(parsed.data, token);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[Branch Operational Report API]", error);
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Failed to generate branch operational performance report.",
      },
      { status: 500 }
    );
  }
}
