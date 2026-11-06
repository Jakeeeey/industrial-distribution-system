// src/app/api/ids/bia/cylinder-analytics/customer-cylinder-aging-report/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// BFF Route for Customer Cylinder Aging Report (BIA Cylinder Analytics).
// Provides analytical aggregation without modifying inventory, charges, or release payments.
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CustomerCylinderAgingFilterSchema } from "@/modules/industrial-distribution-system/bia/cylinder-analytics/customer-cylinder-aging-report/types/customer-cylinder-aging.schema";
import {
  fetchCustomerCylinderAgingReport,
  fetchCustomerCylinderAgingLookups,
} from "@/modules/industrial-distribution-system/bia/cylinder-analytics/customer-cylinder-aging-report/services/customer-cylinder-aging.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "lookups") {
      const lookups = await fetchCustomerCylinderAgingLookups();
      return NextResponse.json({ success: true, data: lookups });
    }

    const cookieStore = await cookies();
    const token =
      cookieStore.get(COOKIE_NAME)?.value ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    const parsedFilters = CustomerCylinderAgingFilterSchema.parse({
      asOfDate: searchParams.get("asOfDate") || undefined,
      branchId: searchParams.get("branchId") || undefined,
      customerCode: searchParams.get("customerCode") || undefined,
      productId: searchParams.get("productId") || undefined,
      agingBucket: searchParams.get("agingBucket") || undefined,
      agingThreshold: searchParams.get("agingThreshold") || undefined,
      searchQuery: searchParams.get("searchQuery") || undefined,
    });

    const report = await fetchCustomerCylinderAgingReport(parsedFilters, token);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
