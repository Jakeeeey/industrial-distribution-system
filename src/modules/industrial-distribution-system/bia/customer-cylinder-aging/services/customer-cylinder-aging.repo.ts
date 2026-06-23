// services/customer-cylinder-aging.repo.ts
// ──────────────────────────────────────────────────────────────────────────────
// BFF fetch calls ONLY — zero business logic.
// Calls the Next.js proxy route at /api/ids/bia/customer-cylinder-aging,
// which in turn forwards to the Spring Boot backend with the Bearer token.
// ──────────────────────────────────────────────────────────────────────────────

import type {
  CustomerCylinderAgingRecord,
  CustomerCylinderAgingFilters,
} from "../types/customer-cylinder-aging.types";

/** Internal BFF route path — never call Spring directly from the client. */
const BFF_ROUTE = "/api/ids/bia/customer-cylinder-aging";

/**
 * Converts a filters object into URLSearchParams, omitting empty/undefined values.
 */
function buildParams(filters: CustomerCylinderAgingFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.productId !== undefined && filters.productId !== "")
    p.set("productId", String(filters.productId));
  if (filters.customerCode?.trim())
    p.set("customerCode", filters.customerCode.trim());
  if (filters.startDate?.trim())
    p.set("startDate", filters.startDate.trim());
  if (filters.endDate?.trim())
    p.set("endDate", filters.endDate.trim());
  return p;
}

/**
 * Fetches cylinder aging records from the BFF proxy.
 * All filters are optional; Spring returns all WITH_CUSTOMER records if none provided.
 *
 * @param filters - Optional filter params (productId, customerCode, startDate, endDate)
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

  // Spring returns the array directly; handle both direct array and wrapped { data: [] }
  if (Array.isArray(json)) return json as CustomerCylinderAgingRecord[];
  if (Array.isArray(json?.data)) return json.data as CustomerCylinderAgingRecord[];
  return [];
}
