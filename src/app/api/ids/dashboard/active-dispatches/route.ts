// src/app/api/ids/dashboard/active-dispatches/route.ts
// BFF route to fetch dispatches from SCM dispatch-summary and format them for the LogisticsTripsWidget.
// Filters by branchId.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DispatchSummaryItem {
  id: string;
  dpNumber: string;
  driverName: string;
  vehiclePlateNo: string;
  startingPoint: string; // branchId
  status: string;
  createdAt: string;
  helpers: string[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || "all";

    // Extract authorization headers to propagate session down to the sub-BFF route
    const authHeader = req.headers.get("authorization") || "";
    const cookieHeader = req.headers.get("cookie") || "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers["Authorization"] = authHeader;
    if (cookieHeader) headers["Cookie"] = cookieHeader;

    // Fetch from existing SCM dispatch-summary BFF route
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.nextUrl.protocol || "http:";
    const targetUrl = `${protocol}//${host}/api/ids/scm/fleet-management/trip-management/dispatch-summary`;

    const res = await fetch(targetUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("[Active Dispatches BFF] Sub-BFF request failed:", text);
      return NextResponse.json(
        { error: `SCM dispatch summary fetch failed with status ${res.status}` },
        { status: res.status }
      );
    }

    const payload = await res.json();
    let data: DispatchSummaryItem[] = [];
    if (payload && Array.isArray(payload.data)) {
      data = payload.data;
    }

    // Filter by branchId if not 'all'
    // startingPoint in post_dispatch_plan is the branch_id
    if (branchId !== "all") {
      data = data.filter((item) => String(item.startingPoint) === branchId);
    }

    // Map to layout shape needed by widget
    const formatted = data.map((item) => {
      let relativeTime = "Just now";
      if (item.createdAt) {
        const d = new Date(item.createdAt);
        if (!isNaN(d.getTime())) {
          const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const timePart = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          relativeTime = `Scheduled/Created: ${datePart}, ${timePart}`;
        }
      }

      let priority = "Normal";
      if (item.status === "Pending") priority = "Normal";
      else if (item.status === "Approved") priority = "High";
      else if (item.status === "Picking") priority = "High";
      else if (item.status === "Rejected") priority = "Critical";

      return {
        dispatchNo: item.dpNumber || `PDP-000${item.id}`,
        driverName: item.driverName || "Unknown Driver",
        vehiclePlate: item.vehiclePlateNo || "Unknown Plate",
        route: `Warehouse Branch ${item.startingPoint || "N/A"}`,
        status: item.status || "Pending",
        time: relativeTime,
        priority,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("[Active Dispatches BFF] Route Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
