// src/app/api/ids/dashboard/activity-feed/route.ts
// BFF route to query the Spring Boot view endpoint: /api/views/ids-dashboard-activity-feed
// Filters by branchId if provided (and not 'all'), sorts by timestamp descending, and limits to 25 items.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ActivityLogRaw {
  id: string;
  timestamp: string | null;
  type: string | null;
  message: string | null;
  module: string | null;
  branchId?: number | null;
  branch_id?: number | null;
}

export async function GET(req: NextRequest) {
  try {
    // 1. Auth check
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

    // Query the Spring Boot view endpoint
    const springUrl = `${SPRING_API_BASE}/api/views/ids-dashboard-activity-feed`;

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
      const text = await res.text();
      console.error(`[Activity Feed BFF] Spring Boot returned ${res.status}:`, text);
      return NextResponse.json(
        { error: `Backend request failed: ${text || res.statusText}` },
        { status: res.status }
      );
    }

    const text = await res.text();
    let springData: unknown = null;
    try {
      springData = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        { error: "Unexpected non-JSON response from Spring Boot View API" },
        { status: 502 }
      );
    }

    let rows: ActivityLogRaw[] = [];
    if (Array.isArray(springData)) {
      rows = springData as ActivityLogRaw[];
    } else if (springData && typeof springData === "object" && springData !== null) {
      const obj = springData as Record<string, unknown>;
      if (Array.isArray(obj.data)) {
        rows = obj.data as ActivityLogRaw[];
      }
    }


    // Filter by branch_id if not 'all' (defends against camelCase/snakeCase mismatches)
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

    // Sort descending by timestamp (latest first)
    const sorted = rows.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    // Limit to top 25 items for dashboard feed performance
    const limited = sorted.slice(0, 25);

    return NextResponse.json(limited);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("[Activity Feed BFF] Route Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
