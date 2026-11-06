// src/app/api/ids/scm/inventory-management/stock-movement-and-variance-report/lookups/route.ts
// ==============================================================================
// BFF API Route: Filter lookups for the Stock Movement and Variance Report.
// Supplies the branch, product-category and product option lists for the filter
// bar. Read-only; the report's own route owns all calculation.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { productDisplayName } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/services/stock-movement-variance.calc";
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
    // The three option lists are all narrowed to the Industrial side of the
    // platform, matching how every other SCM picker behaves: branches and
    // products by active status, branches additionally by division_id,
    // categories by is_industrial. Products are also narrowed to
    // is_serialized = 1, so the picker only offers cylinder products.
    // The report body applies the same is_serialized scope, so every line it
    // reconciles is one this picker could name. The id-keyed name lookups in the
    // report route stay unfiltered because they label rows that already exist.
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
        `fields=category_id,category_name&filter[is_industrial][_eq]=1&sort=category_name&limit=-1`
      ),
      directusList<{
        product_id: number;
        product_code?: string;
        product_name?: string;
        description?: string;
      }>(
        directusBase,
        directusToken,
        "products",
        `fields=product_id,product_code,product_name,description&filter[isActive][_eq]=1&filter[is_serialized][_eq]=1&sort=product_name&limit=-1`
      ),
    ]);

    const branches: VarianceLookupOption[] = branchRows
      .filter((row) => Number.isFinite(row.id) && Boolean(row.branch_name))
      .map((row) => ({
        id: row.id,
        label: String(row.branch_name),
        secondary: row.branch_code ? String(row.branch_code) : undefined,
      }));

    const categories: VarianceLookupOption[] = categoryRows
      .filter((row) => Number.isFinite(row.category_id))
      .map((row) => ({
        id: row.category_id,
        label: row.category_name,
      }));

    // Keyed by product_id: names are NOT unique in this schema, so the id is the
    // only thing that can select one product. What is shown is the master
    // `description`, per the ids-guide rule every other product picker follows.
    const products: VarianceLookupOption[] = productRows
      .filter((row) => Number.isFinite(row.product_id))
      .map((row) => ({
        id: row.product_id,
        label: productDisplayName(row.description, row.product_name, row.product_code),
        secondary: row.product_code ? String(row.product_code) : undefined,
      }))
      .filter((option) => option.label !== "");

    const data: StockMovementVarianceLookupOptions = { branches, categories, products };

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failure";
    console.error("[stock-movement-variance/lookups] GET failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
