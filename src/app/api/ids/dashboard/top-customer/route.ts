// src/app/api/ids/dashboard/top-customer/route.ts
// BFF route to query the Spring Boot view endpoint: /api/views/ids-dashboard-top-customer
// Filters by branchId and returns sorted top 5 customers by total revenue.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TopCustomerRow {
  customer_code: string | null;
  customerCode?: string | null;
  customer_name: string | null;
  customerName?: string | null;
  store_name: string | null;
  storeName?: string | null;
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

    const springUrl = `${SPRING_API_BASE}/api/views/ids-dashboard-top-customer`;
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
      console.warn(`[Top Customer BFF] Spring view ids-dashboard-top-customer returned ${res.status}.`);
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
        { error: "Unexpected non-JSON response from Spring Boot top-customer API" },
        { status: 502 }
      );
    }

    let rows: TopCustomerRow[] = [];
    if (Array.isArray(springData)) {
      rows = springData as TopCustomerRow[];
    } else if (springData && typeof springData === "object") {
      const obj = springData as Record<string, unknown>;
      if (Array.isArray(obj.data)) {
        rows = obj.data as TopCustomerRow[];
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

    // Group in memory to handle same customer across different branches if branchId is 'all'
    const customerMap = new Map<string, { code: string; name: string; storeName: string; revenue: number; invoices: number }>();
    
    rows.forEach((row) => {
      const code = row.customerCode ?? row.customer_code ?? "N/A";
      const name = row.customerName ?? row.customer_name ?? "Unknown Customer";
      const storeName = row.storeName ?? row.store_name ?? "";
      const rev = Number(row.totalRevenue ?? row.total_revenue ?? 0);
      const invs = Number(row.totalInvoices ?? row.total_invoices ?? 0);

      const key = code;
      const existing = customerMap.get(key);
      if (existing) {
        existing.revenue += rev;
        existing.invoices += invs;
      } else {
        customerMap.set(key, { code, name, storeName, revenue: rev, invoices: invs });
      }
    });

    const result = Array.from(customerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("[Top Customer BFF] Route Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
