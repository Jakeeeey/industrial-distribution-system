// src/app/api/ids/bia/cylinder-analytics/cylinder-utilization-report/lookups/route.ts
// ==============================================================================
// BFF Lookup Route: Cylinder Utilization Report (IDS BIA Subsystem)
// Supplies the two filter vocabularies the report scopes by:
// - `branches`: the authorized branch selector (spec §2)
// - `sizes`:    the cylinder sizes, i.e. serialized products (spec §11 column)
//
// Read-only. Cached in-process for the TTL below because neither vocabulary moves
// during a reporting session.
//
// Complies with VoSync standards:
// - Defensive fallback: a failed collection read yields an empty list, never a 500
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
 
import type { UtilizationLookupOptions } from "@/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/types/cylinder-utilization-report.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** In-process cache window for the lookup vocabulary. */
const CACHE_TTL_MS = 15 * 60 * 1000;

let cached: { payload: UtilizationLookupOptions; expiresAt: number } | null = null;

/** Reads Directus coordinates, tolerating both public and server env names. */
function getDirectusConfig(): { url: string; token: string } {
  const url = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  const token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || "").trim();

  return { url: /^https?:\/\//i.test(url) ? url : `http://${url}`, token };
}

function getDirectusHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** A failed lookup read degrades to an empty list rather than failing the request. */
async function fetchRows<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const res = await fetch(url, { headers, cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return [];
  const json = (await res.json()) as { data?: T[] };
  return json.data ?? [];
}

/**
 * GET /api/ids/bia/cylinder-analytics/cylinder-utilization-report/lookups
 * `?refresh=true` bypasses the in-process cache.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";

  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  const { url: directusBase, token } = getDirectusConfig();
  const headers = getDirectusHeaders(token);

  // ── Branches: only active ones are selectable ──────────────────────────────
  const branchRows = await fetchRows<{
    id: number;
    branch_name: string | null;
    branch_code: string | null;
  }>(
    // AG-COMMENT: Filter for active branches in the Industrial Division (division_id = 1, isActive = 1)
    `${directusBase}/items/branches?fields=id,branch_name,branch_code&filter[isActive][_eq]=1&filter[division_id][_eq]=1&sort=branch_name&limit=-1`,
    headers
  );

  // ── Sizes: products that are serialized are the cylinders ─────────────────
  // AG-COMMENT: Fetch products filtered by is_serialized = 1, isActive = 1, sorted by description per ids-guide
  const productRows = await fetchRows<{
    product_id: number;
    product_code: string | null;
    product_name: string | null;
    description: string | null;
    product_weight: number | null;
  }>(
    `${directusBase}/items/products?filter[is_serialized][_eq]=1&filter[isActive][_eq]=1&fields=product_id,product_code,product_name,description,product_weight&sort=description&limit=-1`,
    headers
  );

  const payload: UtilizationLookupOptions = {
    branches: branchRows
      .filter((b) => b.branch_name)
      .map((b) => ({ id: Number(b.id), name: String(b.branch_name), code: String(b.branch_code ?? "") })),
    sizes: productRows.map((p) => {
      // AG-COMMENT: Shows products.description as product name per ids-guide rule and user prompt
      const productLabel = p.description?.trim() || p.product_name?.trim() || (p.product_code ? `Size ${p.product_code}` : "Unmapped size");
      return {
        id: Number(p.product_id),
        label: productLabel,
        code: String(p.product_code ?? ""),
        weight: p.product_weight === null || p.product_weight === undefined ? null : Number(p.product_weight),
      };
    }),
  };

  cached = { payload, expiresAt: Date.now() + CACHE_TTL_MS };

  return NextResponse.json(payload);
}
