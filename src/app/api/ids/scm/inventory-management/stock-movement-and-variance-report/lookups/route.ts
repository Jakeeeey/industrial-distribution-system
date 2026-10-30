// src/app/api/ids/scm/inventory-management/stock-movement-and-variance-report/lookups/route.ts
// ==============================================================================
// BFF API Route: Filter lookups for the Stock Movement and Variance Report.
// Supplies the branch, product-category and product option lists for the filter
// bar. Read-only; the report's own route owns all calculation.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import type {
  StockMovementVarianceLookupOptions,
  VarianceLookupOption,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/types/stock-movement-variance.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

/**
 * Resolves Directus configuration. NEXT_PUBLIC_API_BASE_URL is the value this
 * deployment actually sets; the others are accepted for parity with siblings.
 */
function getDirectusConfig(): { url: string; token: string } {
  const url = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  const token = (
    process.env.DIRECTUS_STATIC_TOKEN ||
    process.env.DIRECTUS_TOKEN ||
    ""
  ).trim();

  return { url: /^https?:\/\//i.test(url) ? url : `http://${url}`, token };
}

/** Reads a Directus collection and unwraps its `{ data: [...] }` envelope. */
async function directusList<T>(
  base: string,
  token: string,
  collection: string,
  query: string
): Promise<T[]> {
  const res = await fetch(`${base}/items/${collection}?${query}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`${collection} lookup failed with status ${res.status}`);
  }

  const payload = (await res.json()) as { data?: T[] } | T[];
  return Array.isArray(payload) ? payload : (payload.data ?? []);
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const token = _req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: Missing access token" },
      { status: 401 }
    );
  }

  const { url: directusBase, token: directusToken } = getDirectusConfig();
  if (!directusBase || !directusToken) {
    return NextResponse.json(
      { ok: false, error: "Directus is not configured for this environment." },
      { status: 500 }
    );
  }

  try {
    // Branches are restricted to the Industrial division and to active records,
    // matching how every other SCM branch picker in the platform behaves.
    const branchQuery =
      `fields=id,branch_name,branch_code&filter[isActive][_eq]=1` +
      `&filter[division_id][_eq]=1&sort=branch_name&limit=-1`;

    const [branchRows, categoryRows, productRows] = await Promise.all([
      directusList<{ id: number; branch_name: string; branch_code?: string }>(
        directusBase,
        directusToken,
        "branches",
        branchQuery
      ),
      directusList<{ category_id: number; category_name: string }>(
        directusBase,
        directusToken,
        "categories",
        `fields=category_id,category_name&sort=category_name&limit=-1`
      ),
      directusList<{ product_id: number; product_code?: string; product_name: string }>(
        directusBase,
        directusToken,
        "products",
        `fields=product_id,product_code,product_name&sort=product_name&limit=-1`
      ),
    ]);

    const branches: VarianceLookupOption[] = branchRows.map((row) => ({
      id: row.id,
      label: row.branch_name,
      secondary: row.branch_code ? String(row.branch_code) : undefined,
    }));

    const categories: VarianceLookupOption[] = categoryRows.map((row) => ({
      id: row.category_id,
      label: row.category_name,
    }));

    const products: VarianceLookupOption[] = productRows.map((row) => ({
      id: row.product_id,
      label: row.product_name,
      secondary: row.product_code ? String(row.product_code) : undefined,
    }));

    const data: StockMovementVarianceLookupOptions = { branches, categories, products };

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failure";
    console.error("[stock-movement-variance/lookups] GET failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
