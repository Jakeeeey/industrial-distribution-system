// src/app/api/ids/scm/inventory-management/reports/cylinder-stock-report/movements/route.ts
// ==============================================================================
// Cylinder Stock Report - Individual Serial Movements API Route
// Retrieves audit timeline for a specific serial number using JWT authorization.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchSerialMovements } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/services/cylinder-stock-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serial = searchParams.get("serialNumber");

    if (!serial) {
      return NextResponse.json({ error: "serialNumber query parameter is required" }, { status: 400 });
    }

    const token = request.cookies.get("vos_access_token")?.value;
    const movements = await fetchSerialMovements(token, serial);

    return NextResponse.json({ data: movements });
  } catch (error: unknown) {
    console.error("[Cylinder Stock Movements Route] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
