// services/customer-cylinder-aging.repo.ts
// ──────────────────────────────────────────────────────────────────────────────
// BFF fetch calls ONLY — zero business logic.
// Calls the Next.js BFF route at /api/ids/bia/customer-cylinder-aging,
// which fetches from Directus cylinder_assets with nested product/customer/branch.
// All derived aging fields are computed server-side in the BFF route.
// ──────────────────────────────────────────────────────────────────────────────

import type {
  CustomerCylinderAgingRecord,
  CustomerCylinderAgingFilters,
  CustomerCylinderAgingSummary,
  CustomerCylinderDetail,
} from "../types/customer-cylinder-aging.types";

/** Internal BFF route path — never call Directus directly from the client. */
const BFF_ROUTE = "/api/ids/bia/customer-cylinder-aging";

/**
 * Converts a filters object into URLSearchParams, omitting empty/undefined values.
 * Includes productId, customerCode, branchId, startDate, endDate.
 */
function buildParams(filters: CustomerCylinderAgingFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.productId !== undefined && filters.productId !== "")
    p.set("productId", String(filters.productId));
  if (filters.customerCode?.trim())
    p.set("customerCode", filters.customerCode.trim());
  if (filters.branchId !== undefined && filters.branchId !== "")
    p.set("branchId", String(filters.branchId));
  if (filters.startDate?.trim())
    p.set("startDate", filters.startDate.trim());
  if (filters.endDate?.trim())
    p.set("endDate", filters.endDate.trim());
  return p;
}

/**
 * Fetches cylinder aging records from the BFF proxy (Directus-backed).
 * All filters are optional; returns all WITH_CUSTOMER cylinders if none provided.
 *
 * @param filters - Optional filter params
 * @returns Promise resolving to an array of CustomerCylinderAgingRecord
 * @throws Error with a descriptive message on HTTP failure
 */
export async function fetchCylinderAging(
  filters: CustomerCylinderAgingFilters = {}
): Promise<CustomerCylinderAgingRecord[]> {
  const params = buildParams(filters);
  const url = params.toString()
    ? `${BFF_ROUTE}?${params.toString()}`
    : BFF_ROUTE;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[CylinderAgingRepo] Request failed ${res.status} ${res.statusText}: ${body}`
    );
  }

  const json = await res.json();

  if (Array.isArray(json)) return json as CustomerCylinderAgingRecord[];
  if (Array.isArray(json?.data)) return json.data as CustomerCylinderAgingRecord[];
  return [];
}

/**
 * Fetches aggregated customer-level summaries from the BFF.
 */
export async function fetchCustomerCylinderAgingSummary(
  filters: CustomerCylinderAgingFilters = {}
): Promise<CustomerCylinderAgingSummary[]> {
  const params = buildParams(filters);
  params.set("view", "customer");
  const url = `${BFF_ROUTE}?${params.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[CylinderAgingRepo] Summary request failed ${res.status} ${res.statusText}: ${body}`
    );
  }

  const json = await res.json();
  if (Array.isArray(json)) return json as CustomerCylinderAgingSummary[];
  if (Array.isArray(json?.data)) return json.data as CustomerCylinderAgingSummary[];
  return [];
}

/**
 * Fetches the detailed dashboard dataset for a specific customer.
 */
export async function fetchCustomerCylinderDetail(
  customerCode: string,
  filters: CustomerCylinderAgingFilters = {}
): Promise<CustomerCylinderDetail> {
  const params = buildParams(filters);
  params.set("view", "detail");
  params.set("customerCode", customerCode);
  const url = `${BFF_ROUTE}?${params.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[CylinderAgingRepo] Detail request failed ${res.status} ${res.statusText}: ${body}`
    );
  }

  const json = await res.json();
  return json as CustomerCylinderDetail;
}

