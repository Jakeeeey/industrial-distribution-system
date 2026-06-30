// src/app/api/ids/dashboard/top-salesman/route.ts
// BFF route to query the Spring Boot view endpoint: /api/views/ids-dashboard-top-salesman
// Filters by branchId and returns sorted top 5 salesmen by total revenue.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TopSalesmanRow {
  salesmanId: number;
  salesman_id?: number;
  salesmanCode: string | null;
  salesman_code?: string | null;
  salesmanName: string | null;
  salesman_name?: string | null;
  branchId?: number | null;
  branch_id?: number | null;
  totalRevenue: number | string;
  total_revenue?: number | string;
  totalInvoices: number;
  total_invoices?: number;
}

export async function GET(req: NextRequest) {
  try {
    const token =
      req.headers.get("authorization")?.replace("Bearer ", "") ||
      req.cookies.get("vos_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: no token provided" },
        { status: 401 }
      );
    }

    const SPRING_API_BASE = process.env.SPRING_API_BASE_URL;
    if (!SPRING_API_BASE) {
      return NextResponse.json(
        { error: "Spring API base URL is not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || "all";

    const springUrl = `${SPRING_API_BASE}/api/views/ids-dashboard-top-salesman`;
    const res = await fetch(springUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `vos_access_token=${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[Top Salesman BFF] Spring view ids-dashboard-top-salesman returned ${res.status}.`);
      return NextResponse.json(
        { error: `Spring view fetch failed with status ${res.status}` },
        { status: res.status }
      );
    }

    const text = await res.text();
    let springData: unknown = null;
    try {
      springData = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        { error: "Unexpected non-JSON response from Spring Boot top-salesman API" },
        { status: 502 }
      );
    }

    let rows: TopSalesmanRow[] = [];
    if (Array.isArray(springData)) {
      rows = springData as TopSalesmanRow[];
    } else if (springData && typeof springData === "object") {
      const obj = springData as Record<string, unknown>;
      if (Array.isArray(obj.data)) {
        rows = obj.data as TopSalesmanRow[];
      }
    }

    // Filter by branchId if not 'all'
    if (branchId !== "all") {
      rows = rows.filter((row) => {
        const itemBranch = String(
          row.branchId !== undefined && row.branchId !== null
            ? row.branchId
            : row.branch_id !== undefined && row.branch_id !== null
            ? row.branch_id
            : ""
        );
        return itemBranch === branchId;
      });
    }

    // Group in memory to handle same salesman across different branches if branchId is 'all'
    const salesmanMap = new Map<string, { id: number; code: string; name: string; revenue: number; invoices: number }>();
    
    rows.forEach((row) => {
      const id = row.salesmanId ?? row.salesman_id ?? 0;
      const code = row.salesmanCode ?? row.salesman_code ?? `SM-${id}`;
      const name = row.salesmanName ?? row.salesman_name ?? "Unknown Salesman";
      const rev = Number(row.totalRevenue ?? row.total_revenue ?? 0);
      const invs = Number(row.totalInvoices ?? row.total_invoices ?? 0);

      const key = String(id);
      const existing = salesmanMap.get(key);
      if (existing) {
        existing.revenue += rev;
        existing.invoices += invs;
      } else {
        salesmanMap.set(key, { id, code, name, revenue: rev, invoices: invs });
      }
    });

    const result = Array.from(salesmanMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("[Top Salesman BFF] Route Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
