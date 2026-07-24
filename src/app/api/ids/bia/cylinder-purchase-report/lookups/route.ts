import { NextRequest, NextResponse } from "next/server";

import {
  fetchReportLookups,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.lookups";
import {
  reportLookupQuerySchema,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = reportLookupQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_LOOKUP_QUERY",
        message: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ data: await fetchReportLookups(parsed.data) });
  } catch (error) {
    console.error(
      "[CylinderPurchaseReport:Lookups]",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      {
        ok: false,
        code: "LOOKUP_UNAVAILABLE",
        message: "Unable to load filter options.",
      },
      { status: 502 },
    );
  }
}
