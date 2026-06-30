// =============================================================================
// Price Monitoring — API Provider
// Layer   : providers (API calls only — no React state)
// Calls   : /api/ids/fm/product-pricing/price-monitoring  (Spring proxy)
//           /api/ids/fm/product-pricing/products           (product search)
//           /api/ids/fm/product-pricing/lookups            (supplier list)
// =============================================================================

import type { ViewPriceMonitoringRow } from "../types";

// ---------------------------------------------------------------------------
// Endpoint constants
// ---------------------------------------------------------------------------

const PRICE_MONITORING_ENDPOINT = "/api/ids/fm/product-pricing/price-monitoring";
const PRODUCT_SEARCH_ENDPOINT = "/api/ids/fm/product-pricing/products";
const LOOKUPS_ENDPOINT = "/api/ids/fm/product-pricing/lookups";

// ---------------------------------------------------------------------------
// Shared option types (used by FilterBar)
// ---------------------------------------------------------------------------

export type ProductOption = {
  product_id: number;
  product_code: string | null;
  product_name: string;
  is_serialized?: number | null;
};

export type SupplierOption = {
  id: number;
  supplier_name: string;
  supplier_shortcut?: string | null;
  division_id?: number | null;
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Generic HTTP helper. Throws an Error with a human-readable message on failure.
 * Mirrors the pattern in pcrApi.ts for consistency.
 */
async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { cache: "no-store", ...init });
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (isRecord(parsed)) {
        const errorMessage =
          typeof parsed.error === "string"
            ? parsed.error
            : typeof parsed.details === "string"
              ? parsed.details
              : typeof parsed.message === "string"
                ? parsed.message
                : "Request failed";
        throw new Error(errorMessage);
      }
      throw new Error("Request failed");
    } catch {
      throw new Error(text || "Request failed");
    }
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

// ---------------------------------------------------------------------------
// Price history
// ---------------------------------------------------------------------------

/**
 * Fetch the full approved price-change history for a product (and optional supplier).
 *
 * @param productId  Required — positive integer.
 * @param supplierId Optional — when provided, narrows to that supplier only.
 * @returns          Flat array of ViewPriceMonitoringRow ordered chronologically.
 */
export async function fetchPriceHistory(
  productId: number,
  supplierId?: number | null,
): Promise<ViewPriceMonitoringRow[]> {
  const sp = new URLSearchParams();
  sp.set("productId", String(productId));
  if (supplierId && supplierId > 0) {
    sp.set("supplierId", String(supplierId));
  }

  const raw = await http<unknown>(
    `${PRICE_MONITORING_ENDPOINT}?${sp.toString()}`,
  );

  // Spring returns flat array; normalise just in case API wraps it
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray((raw as Record<string, unknown>).data)
      ? ((raw as Record<string, unknown>).data as unknown[])
      : [];

  return list.filter(isRecord).map((item) => item as unknown as ViewPriceMonitoringRow);
}

// ---------------------------------------------------------------------------
// Product search (for FilterBar product dropdown)
// ---------------------------------------------------------------------------

/**
 * Search products by query string. Returns up to `limit` results.
 * Reuses the existing /api/ids/fm/product-pricing/products endpoint.
 */
export async function fetchProductOptions(
  q: string,
  limit = 30,
  isSerialized?: number | null,
): Promise<ProductOption[]> {
  const sp = new URLSearchParams();
  sp.set("q", q);
  sp.set("page", "1");
  sp.set("page_size", String(limit));
  if (isSerialized !== undefined && isSerialized !== null) {
    sp.set("is_serialized", String(isSerialized));
  }

  const res = await fetch(`${PRODUCT_SEARCH_ENDPOINT}?${sp.toString()}`, {
    cache: "no-store",
  });

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      isRecord(json) && typeof json.error === "string"
        ? json.error
        : `Product search failed (${res.status})`,
    );
  }

  // Endpoint returns { data: [] } or a flat array
  const raw = isRecord(json) && Array.isArray((json as Record<string, unknown>).data)
    ? ((json as Record<string, unknown>).data as unknown[])
    : Array.isArray(json)
      ? json
      : [];

  return (raw as unknown[])
    .filter(isRecord)
    .map((item) => {
      const productId = Number(item.product_id ?? 0);
      if (!Number.isFinite(productId) || productId <= 0) return null;
      // Parse is_serialized value (can be boolean, number, string, etc.)
      let isSerializedVal: number = 0;
      if (item.is_serialized === true || item.is_serialized === 1 || item.is_serialized === '1') {
        isSerializedVal = 1;
      }

      const opt: ProductOption = {
        product_id: productId,
        product_code:
          typeof item.product_code === "string" ? item.product_code : null,
        product_name:
          typeof item.product_name === "string" ? item.product_name : `#${productId}`,
        is_serialized: isSerializedVal,
      };
      return opt;
    })
    .filter((r): r is ProductOption => r !== null);
}

// ---------------------------------------------------------------------------
// Supplier list (for FilterBar supplier dropdown)
// ---------------------------------------------------------------------------

/**
 * Fetch all available suppliers from the shared lookups endpoint.
 * Directus/Spring is used here only for filter option population.
 */
export async function fetchSupplierOptions(): Promise<SupplierOption[]> {
  const res = await http<{ data: { suppliers: unknown[] } } | { suppliers: unknown[] }>(
    LOOKUPS_ENDPOINT,
  );

  // Handle both { data: { suppliers } } and { suppliers } shapes
  let raw: unknown[] = [];
  if (isRecord(res)) {
    const inner = (res as Record<string, unknown>).data;
    if (isRecord(inner) && Array.isArray((inner as Record<string, unknown>).suppliers)) {
      raw = (inner as Record<string, unknown>).suppliers as unknown[];
    } else if (Array.isArray((res as Record<string, unknown>).suppliers)) {
      raw = (res as Record<string, unknown>).suppliers as unknown[];
    }
  }

  // Build typed array explicitly to avoid predicate mismatch
  const result: SupplierOption[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = Number(item.id ?? item.supplier_id ?? 0);
    if (!Number.isFinite(id) || id <= 0) continue;
    result.push({
      id,
      supplier_name:
        typeof item.supplier_name === "string" ? item.supplier_name : `Supplier #${id}`,
      supplier_shortcut:
        typeof item.supplier_shortcut === "string" ? item.supplier_shortcut : null,
      division_id: item.division_id !== undefined && item.division_id !== null ? Number(item.division_id) : null,
    });
  }
  return result;
}
