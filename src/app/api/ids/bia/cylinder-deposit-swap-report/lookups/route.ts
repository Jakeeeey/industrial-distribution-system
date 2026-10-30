// src/app/api/ids/bia/cylinder-deposit-swap-report/lookups/route.ts
// ==============================================================================
// BFF Lookup Route for Cylinder Deposit and Swap Report.
// Retrieves filter metadata from Directus with server-side caching:
// 1. Branches: Filters only active branches (isActive = 1)
// 2. Products: Filters only serialized active products (is_serialized = 1, isActive = 1)
//    and includes product description for rich, user-friendly labels.
// 3. Customers: Active commercial & retail customer accounts (isActive = 1)
//
// Performance:
// Includes an in-memory server-side cache with a 15-minute TTL to minimize
// Directus database load, speed up UI rendering, and provide zero-latency responses.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import type { CylinderDepositSwapLookupOptions } from "@/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/types/cylinder-deposit-swap.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory cache store
let cachedLookups: CylinderDepositSwapLookupOptions | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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

const INDUSTRIAL_BRANCH_IDS = new Set([196, 197, 278, 279, 280]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";
  const now = Date.now();

  // In development, invalidate in-memory cache to guarantee instant updates
  if (process.env.NODE_ENV === "development") {
    cachedLookups = null;
    cacheExpiresAt = 0;
  }

  // Return warm cache if still valid and forceRefresh is not requested
  if (!forceRefresh && cachedLookups && now < cacheExpiresAt) {
    return NextResponse.json(cachedLookups, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "X-Cache-Status": "HIT",
      },
    });
  }

  const { url: directusBase, token } = getDirectusConfig();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const [branchesRes, productsRes, customersRes] = await Promise.all([
      // 1. Branches: Filter for active branches in the Industrial Division (division_id = 1, isActive = 1)
      fetch(
        `${directusBase}/items/branches?filter[isActive][_eq]=1&filter[division_id][_eq]=1&fields=id,branch_code,branch_name,division_id&limit=-1&sort=branch_name`,
        { headers, cache: "no-store" }
      ).catch(() => null),

      // 2. Products: Filter for serialized products only (is_serialized = 1, isActive = 1)
      // Retrieve 'description' for primary display, with product_name as fallback
      fetch(
        `${directusBase}/items/products?filter[is_serialized][_eq]=1&filter[isActive][_eq]=1&fields=product_id,product_code,product_name,description,product_weight&limit=-1&sort=description`,
        { headers, cache: "no-store" }
      ).catch(() => null),

      // 3. Customers: Filter for active customers only (isActive = 1)
      fetch(
        `${directusBase}/items/customer?filter[isActive][_eq]=1&fields=customer_code,customer_name,store_name&limit=-1&sort=customer_name`,
        { headers, cache: "no-store" }
      ).catch(() => null),
    ]);

    const branchesJson = branchesRes && branchesRes.ok ? await branchesRes.json() : { data: [] };
    const productsJson = productsRes && productsRes.ok ? await productsRes.json() : { data: [] };
    const customersJson = customersRes && customersRes.ok ? await customersRes.json() : { data: [] };

    // AG-COMMENT: Strictly filter branches to Industrial Division (division_id = 1)
    const industrialBranches = (Array.isArray(branchesJson?.data) ? branchesJson.data : []).filter(
      (b: { id: number; division_id?: number | null }) => {
        if (b.division_id !== undefined && b.division_id !== null) {
          return Number(b.division_id) === 1;
        }
        return INDUSTRIAL_BRANCH_IDS.has(Number(b.id));
      }
    );

    const lookups: CylinderDepositSwapLookupOptions = {
      branches: industrialBranches,
      products: Array.isArray(productsJson?.data) ? productsJson.data : [],
      customers: Array.isArray(customersJson?.data) ? customersJson.data : [],
    };

    // Update in-memory server cache
    cachedLookups = lookups;
    cacheExpiresAt = now + CACHE_TTL_MS;

    return NextResponse.json(lookups, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "X-Cache-Status": "MISS",
      },
    });
  } catch (error) {
    console.error("[CylinderDepositSwap:Lookups] Failed to fetch filter lookups:", error);
    // If cache exists even if expired, fall back to it gracefully
    if (cachedLookups) {
      return NextResponse.json(cachedLookups, {
        headers: { "X-Cache-Status": "STALE_FALLBACK" },
      });
    }

    return NextResponse.json({
      branches: [],
      products: [],
      customers: [],
    });
  }
}
