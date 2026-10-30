// src/app/api/ids/crm/customer-reports/customer-order-and-consumption-report/lookups/route.ts
// ============================================================
// Filter-bar typeahead endpoint. The lookup type is whitelisted by Zod, so
// only these four collections can ever be read.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchReportLookupOptions } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.lookups";
import { reportLookupQuerySchema } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/types/customer-order-consumption.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = reportLookupQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_LOOKUP",
        message: parsed.error.issues[0]?.message ?? "Unknown lookup type.",
        data: [],
      },
      { status: 400 }
    );
  }

  try {
    const data = await fetchReportLookupOptions(parsed.data, {
      signal: request.signal,
    });
    return NextResponse.json({ data });
  } catch (error) {
    // A failed typeahead must not look like "no such customer", so the client
    // gets a retryable status instead of an empty list.
    console.error("[CustomerOrderConsumption] lookup failed", error);
    return NextResponse.json(
      {
        ok: false,
        code: "LOOKUP_UNAVAILABLE",
        message: "Filter options are unavailable right now.",
        data: [],
      },
      { status: 502 }
    );
  }
}
