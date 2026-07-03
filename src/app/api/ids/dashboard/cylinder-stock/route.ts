// src/app/api/ids/dashboard/cylinder-stock/route.ts
// BFF route to query Directus cylinder_assets, filter by branchId (current_branch_id), and aggregate totals by cylinder_status.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CylinderAssetRaw {
  id: number;
  cylinder_status: string | null;
  cylinder_condition: string | null;
  current_branch_id: number | { id: number } | null;
  is_deleted?: number | boolean;
}

function getDirectusBase(): string {
  const raw = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (!raw) throw new Error("Directus URL is not configured.");
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

function getDirectusToken(): string {
  return (
    process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || ""
  ).trim();
}

function getDirectusHeaders(): Record<string, string> {
  const token = getDirectusToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || "all";

    const directusBase = getDirectusBase();
    const targetUrl = `${directusBase}/items/cylinder_assets?limit=-1&fields=id,cylinder_status,cylinder_condition,current_branch_id`;

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: getDirectusHeaders(),
      cache: "no-store",
    });

    let rows: CylinderAssetRaw[] = [];

    if (res.ok) {
      const payload = await res.json();
      if (payload && Array.isArray(payload.data)) {
        rows = payload.data;
      }
    } else {
      console.warn(`[Cylinder Stock BFF] Failed to query Directus: ${res.status}`);
    }

    // Safely extract branch id whether it is nested object or number
    const getBranchId = (row: CylinderAssetRaw): string => {
      if (!row.current_branch_id) return "";
      if (typeof row.current_branch_id === "object") {
        return String(row.current_branch_id.id || "");
      }
      return String(row.current_branch_id);
    };

    // Filter by branchId if not 'all'
    if (branchId !== "all") {
      rows = rows.filter((row) => getBranchId(row) === branchId);
    }

    // Aggregate counts in memory
    let available = 0;
    let empty = 0;
    let full = 0;
    let loaded = 0;
    let withCustomer = 0;
    let damaged = 0;
    let lost = 0;

    rows.forEach((row) => {
      if (isDeleted(row)) return;

      const status = (row.cylinder_status || "").trim().toUpperCase();

      if (status === "AVAILABLE") {
        available++;
      } else if (status === "EMPTY") {
        empty++;
      } else if (status === "FULL") {
        full++;
      } else if (status === "LOADED") {
        loaded++;
      } else if (status === "WITH_CUSTOMER") {
        withCustomer++;
      } else if (status === "DAMAGED") {
        damaged++;
      } else if (status === "LOST") {
        lost++;
      }
    });

    // Helper check for soft delete if exposed in fields
    function isDeleted(row: CylinderAssetRaw) {
      return row.is_deleted === true || row.is_deleted === 1;
    }

    const data = [
      { name: "Available", value: available, color: "#10b981" },
      { name: "Empty", value: empty, color: "#94a3b8" },
      { name: "Full", value: full, color: "#06b6d4" },
      { name: "Loaded", value: loaded, color: "#f59e0b" },
      { name: "With Customer", value: withCustomer, color: "#6366f1" },
      { name: "Damaged", value: damaged, color: "#ef4444" },
      { name: "Lost", value: lost, color: "#7c2d12" },
    ];

    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("[Cylinder Stock BFF] Route Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
