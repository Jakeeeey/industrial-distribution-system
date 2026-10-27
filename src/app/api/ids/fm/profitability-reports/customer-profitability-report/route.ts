// src/app/api/ids/fm/profitability-reports/customer-profitability-report/route.ts
// ==============================================================================
// BFF API Route for Customer Profitability Report
// Handles query parameters parsing, lookups, and customer drilldown.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { CustomerProfitabilityFilterSchema } from "@/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/types/customer-profitability.schema";
import {
  fetchCustomerProfitabilityReport,
  fetchProfitabilityLookups,
  fetchCustomerProfitabilityDrilldown,
} from "@/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/services/customer-profitability.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    // 1. Lookups mode (branches)
    if (mode === "lookups") {
      const lookups = await fetchProfitabilityLookups();
      return NextResponse.json({ success: true, data: lookups });
    }

    // 2. Customer Drilldown mode
    if (mode === "drilldown") {
      const customerCode = searchParams.get("customerCode");
      if (!customerCode) {
        return NextResponse.json(
          { success: false, error: "Missing customerCode parameter" },
          { status: 400 }
        );
      }
      const drilldown = await fetchCustomerProfitabilityDrilldown(customerCode);
      return NextResponse.json({ success: true, data: drilldown });
    }

    // 3. Main Report Generation mode
    const parsedFilters = CustomerProfitabilityFilterSchema.parse({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      datePreset: searchParams.get("datePreset") || undefined,
      branchId: searchParams.get("branchId") || undefined,
      tier: searchParams.get("tier") || undefined,
      searchQuery: searchParams.get("searchQuery") || undefined,
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 10,
      sortBy: searchParams.get("sortBy") || "contributionMargin",
      sortOrder: searchParams.get("sortOrder") || "desc",
    });

    const report = await fetchCustomerProfitabilityReport(parsedFilters);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
