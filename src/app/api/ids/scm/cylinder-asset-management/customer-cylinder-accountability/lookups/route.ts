// src/app/api/ids/scm/cylinder-asset-management/customer-cylinder-accountability/lookups/route.ts
// ==============================================================================
// BFF Lookup Route for Customer Cylinder Accountability Report (VoSync BIA Subsystem)
// Retrieves branches, customers, and ownership categories with in-memory TTL caching.
//
// Complies with VoSync standards:
// - Defensive error fallback (always returns empty array rather than 500 error)
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import type { AccountabilityLookupOptions } from "@/modules/industrial-distribution-system/supply-chain-management/cylinder-asset-management/customer-cylinder-accountability/types/customer-cylinder-accountability.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cachedLookups: AccountabilityLookupOptions | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

function getDirectusConfig() {
  const url = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).trim().replace(/\/$/, "");

  const token = (
    process.env.DIRECTUS_STATIC_TOKEN ||
    process.env.DIRECTUS_TOKEN ||
    ""
  ).trim();

  return { url: /^https?:\/\//i.test(url) ? url : `http://${url}`, token };
}

type DirectusListResponse<T> = { data?: T[] };

type BranchRow = {
  id: number;
  branch_name: string | null;
  branch_code: string | null;
  isActive: number | string | boolean | null;
};

type CustomerRow = {
  customer_code: string;
  customer_name: string | null;
  store_name: string | null;
};

/** Reads a Directus list endpoint; returns an empty array when the request fails. */
async function fetchRows<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const res = await fetch(url, { headers, cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return [];
  const json = (await res.json()) as DirectusListResponse<T>;
  return json.data ?? [];
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";
  const now = Date.now();

  if (!forceRefresh && cachedLookups && now < cacheExpiresAt) {
    return NextResponse.json(cachedLookups, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "X-Cache-Status": "HIT",
      },
    });
  }

  const { url: directusBase, token } = getDirectusConfig();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    // 1. Fetch active branches (isActive = 1)
    const branchRows = await fetchRows<BranchRow>(
      `${directusBase}/items/branches?fields=id,branch_name,branch_code,isActive&filter[isActive][_eq]=1&limit=-1`,
      headers
    );

    const branches = branchRows
      .filter((b) => b.isActive === 1 || b.isActive === "1" || b.isActive === true)
      .map((b) => ({
        id: Number(b.id),
        name: b.branch_name || `Branch #${b.id}`,
        code: b.branch_code || `BR-${b.id}`,
      }));

    // 2. Fetch active customers
    const customerRows = await fetchRows<CustomerRow>(
      `${directusBase}/items/customer?fields=customer_code,customer_name,store_name&limit=-1`,
      headers
    );

    const customers = customerRows.map((c) => ({
      code: c.customer_code,
      name: c.customer_name || `Customer ${c.customer_code}`,
      storeName: c.store_name || undefined,
    }));

    const result: AccountabilityLookupOptions = {
      branches,
      customers,
      ownerships: [
        { code: "ALL", label: "All Ownerships" },
        { code: "COMPANY", label: "Company Owned" },
        { code: "CUSTOMER", label: "Customer Owned" },
      ],
    };

    cachedLookups = result;
    cacheExpiresAt = now + CACHE_TTL_MS;

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "X-Cache-Status": "MISS",
      },
    });
  } catch (error) {
    console.error("[AccountabilityLookups] Failed to retrieve lookups:", error);
    // Return empty fallback instead of failing
    return NextResponse.json(
      {
        branches: [],
        customers: [],
        ownerships: [
          { code: "ALL", label: "All Ownerships" },
          { code: "COMPANY", label: "Company Owned" },
          { code: "CUSTOMER", label: "Customer Owned" },
        ],
      },
      { status: 200 }
    );
  }
}
