// src/app/api/ids/bia/cylinder-analytics/customer-cylinder-turnaround-ratio/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// Next.js BFF API Route for Customer Cylinder Turnaround Ratio (CTR) Module.
// Provides lookups, report calculation, and workflow transition management.
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  CustomerCylinderTurnaroundFilterSchema,
  TurnaroundWorkflowActionSchema,
} from "@/modules/industrial-distribution-system/bia/cylinder-analytics/customer-cylinder-turnaround-ratio/types/customer-cylinder-turnaround.schema";
import {
  fetchCustomerCylinderTurnaroundReport,
  fetchCustomerCylinderTurnaroundLookups,
  executeTurnaroundWorkflowAction,
} from "@/modules/industrial-distribution-system/bia/cylinder-analytics/customer-cylinder-turnaround-ratio/services/customer-cylinder-turnaround.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "lookups") {
      const lookups = await fetchCustomerCylinderTurnaroundLookups();
      return NextResponse.json({ success: true, data: lookups });
    }

    const cookieStore = await cookies();
    const token =
      cookieStore.get(COOKIE_NAME)?.value ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    const parsedFilters = CustomerCylinderTurnaroundFilterSchema.parse({
      datePreset: searchParams.get("datePreset") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      periodYear: searchParams.get("periodYear") || undefined,
      periodStartMonth: searchParams.get("periodStartMonth") || undefined,
      periodEndMonth: searchParams.get("periodEndMonth") || undefined,
      branchId: searchParams.get("branchId") || undefined,
      customerCode: searchParams.get("customerCode") || undefined,
      grade: searchParams.get("grade") || undefined,
      status: searchParams.get("status") || undefined,
      searchQuery: searchParams.get("searchQuery") || undefined,
    });

    const report = await fetchCustomerCylinderTurnaroundReport(parsedFilters, token);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedAction = TurnaroundWorkflowActionSchema.parse(body);

    const result = await executeTurnaroundWorkflowAction(parsedAction);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow Action Failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
