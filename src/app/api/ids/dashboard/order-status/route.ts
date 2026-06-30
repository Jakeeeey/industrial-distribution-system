// src/app/api/ids/dashboard/order-status/route.ts
// BFF route: queries Directus sales_order collection and aggregates counts per order_status.
// Supports optional branchId filter. Does NOT require Spring Boot token — uses Directus static token.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pipeline-relevant statuses (exclude terminal/noise statuses from the widget)
const PIPELINE_STATUSES = [
  "Draft",
  "Pending",
  "For Approval",
  "For Consolidation",
  "For Picking",
  "For Invoicing",
  "For Loading",
  "For Shipping",
  "En Route",
  "Delivered",
  "On Hold",
];

function getDirectusBase(): string {
  const raw = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (!raw) throw new Error("Directus base URL is not configured.");
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

function getDirectusHeaders(): Record<string, string> {
  const token = (
    process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || ""
  ).trim();
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

interface DirectusSalesOrderRow {
  order_status: string;
  branch_id: number | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || "all";

    const base = getDirectusBase();

    // Fetch all sales_order rows with just the two fields we need.
    // Use limit=-1 to get all records. We aggregate in memory to avoid
    // relying on Directus aggregation quirks across versions.
    let url = `${base}/items/sales_order?limit=-1&fields=order_status,branch_id&filter[branch_id]=196`;

    // Filter to pipeline-relevant statuses only
    PIPELINE_STATUSES.forEach((s, i) => {
      url += `&filter[order_status][_in][${i}]=${encodeURIComponent(s)}`;
    });

    // Apply branch filter server-side if specific branch requested
    if (branchId !== "all") {
      url += `&filter[branch_id][_eq]=${encodeURIComponent(branchId)}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers: getDirectusHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Order Status BFF] Directus error ${res.status}:`, errText);
      return NextResponse.json(
        { error: `Directus request failed: ${res.status}` },
        { status: res.status }
      );
    }

    const payload = await res.json();
    const rows: DirectusSalesOrderRow[] = Array.isArray(payload.data)
      ? payload.data
      : [];

    // Aggregate counts per order_status in memory
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const status = row.order_status || "Unknown";
      counts[status] = (counts[status] ?? 0) + 1;
    }

    // Return as flat array sorted by pipeline order
    const result = PIPELINE_STATUSES.map((status) => ({
      status,
      count: counts[status] ?? 0,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("[Order Status BFF] Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
