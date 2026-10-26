// src/app/api/ids/arf/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/route.ts
// ==============================================================================
// BFF API Route for Lost and Damaged Cylinder Report
// Handles query parameters parsing, token forwarding, and response delivery.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LostDamagedFilterSchema } from "@/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/types/lost-damaged-cylinder.schema";
import {
  fetchLostDamagedReport,
  fetchLostDamagedLookups,
} from "@/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/services/lost-damaged-cylinder.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "lookups") {
      const lookups = await fetchLostDamagedLookups();
      return NextResponse.json({ success: true, data: lookups });
    }

    const cookieStore = await cookies();
    const token =
      cookieStore.get(COOKIE_NAME)?.value ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    const parsedFilters = LostDamagedFilterSchema.parse({
      branchId: searchParams.get("branchId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      datePreset: searchParams.get("datePreset") || undefined,
      incidentCategory: searchParams.get("incidentCategory") || undefined,
      condition: searchParams.get("condition") || undefined,
      status: searchParams.get("status") || undefined,
      chargeStatus: searchParams.get("chargeStatus") || undefined,
      searchQuery: searchParams.get("searchQuery") || undefined,
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 10,
      sortBy: searchParams.get("sortBy") || "incidentDate",
      sortOrder: searchParams.get("sortOrder") || "desc",
    });

    const report = await fetchLostDamagedReport(parsedFilters, token);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
