// src/app/api/ids/arf/cylinder-condition-and-compliance/cylinder-inspection-due-report/route.ts
// ==============================================================================
// BFF API Route for Cylinder Inspection and Hydrotest Due Report
// Handles query parameters parsing, lookups, on-demand movements, and report delivery.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CylinderInspectionFilterSchema } from "@/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/types/cylinder-inspection-hydrotest.schema";
import {
  fetchInspectionHydrotestReport,
  fetchInspectionHydrotestLookups,
  fetchSerialMovements,
} from "@/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/services/cylinder-inspection-hydrotest.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    // Fast-path lookup response for filter dropdowns
    if (mode === "lookups") {
      const lookups = await fetchInspectionHydrotestLookups();
      return NextResponse.json({ success: true, data: lookups });
    }

    // Extract JWT token for authenticated Spring Boot endpoints
    const cookieStore = await cookies();
    const token =
      cookieStore.get(COOKIE_NAME)?.value ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    // On-demand movement trace for drawer
    if (mode === "movements") {
      const serialNumber = searchParams.get("serialNumber") || "";
      const movements = await fetchSerialMovements(token, serialNumber);
      return NextResponse.json({ success: true, data: movements });
    }

    const parsedFilters = CylinderInspectionFilterSchema.parse({
      branchId: searchParams.get("branchId") || undefined,
      complianceStatus: searchParams.get("complianceStatus") || "ALL",
      condition: searchParams.get("condition") || "ALL",
      warningDays: searchParams.get("warningDays") || 30,
      productId: searchParams.get("productId") || undefined,
      searchQuery: searchParams.get("searchQuery") || "",
      includeRetired: searchParams.get("includeRetired") || false,
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 10,
      sortBy: searchParams.get("sortBy") || "expirationDate",
      sortOrder: searchParams.get("sortOrder") || "asc",
    });

    const report = await fetchInspectionHydrotestReport(parsedFilters);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("[Cylinder Inspection API Route] Execution Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
