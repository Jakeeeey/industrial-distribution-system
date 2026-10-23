// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/services/cylinder-deposit-swap.repo.ts
// ==============================================================================
// Client-side repository for communicating with the BFF API endpoints.
// Strict segregation: purely handles fetch requests and response parsing.
// ==============================================================================

import type {
  CylinderDepositSwapFilters,
  CylinderDepositSwapLookupOptions,
  CylinderDepositSwapReportResponse,
  CustomerDepositSwapDetailResponse,
} from "../types/cylinder-deposit-swap.types";

const BFF_BASE_URL = "/api/ids/bia/cylinder-deposit-swap-report";

/**
 * Builds URL search parameters from filters object, omitting undefined/empty values.
 */
function buildSearchParams(filters: CylinderDepositSwapFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.branchId !== undefined && filters.branchId !== "") {
    params.set("branchId", String(filters.branchId));
  }
  if (filters.customerCode?.trim()) {
    params.set("customerCode", filters.customerCode.trim());
  }
  if (filters.productId !== undefined && filters.productId !== "") {
    params.set("productId", String(filters.productId));
  }
  // AG-COMMENT: Ownership filter removed per user requirement
  return params;
}

/**
 * Fetches the main Cylinder Deposit & Swap Report dataset from the BFF.
 */
export async function fetchCylinderDepositSwapReport(
  filters: CylinderDepositSwapFilters
): Promise<CylinderDepositSwapReportResponse> {
  const params = buildSearchParams(filters);
  const url = `${BFF_BASE_URL}?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `[CylinderDepositSwapRepo] Report fetch failed with status ${res.status}: ${errorBody}`
    );
  }

  return (await res.json()) as CylinderDepositSwapReportResponse;
}

const LOOKUPS_STORAGE_KEY = "ids_bia_cylinder_deposit_swap_lookups_v1";
const LOOKUPS_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes TTL

/**
 * Fetches dynamic lookup options for filter dropdowns (branches, products, customers).
 * Includes dual-tier caching: reads from sessionStorage first if available, otherwise queries BFF.
 */
export async function fetchCylinderDepositSwapLookups(
  forceRefresh = false
): Promise<CylinderDepositSwapLookupOptions> {
  // Check client sessionStorage cache first
  if (!forceRefresh && typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(LOOKUPS_STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && Date.now() - cached.timestamp < LOOKUPS_CACHE_DURATION && cached.data) {
          return cached.data as CylinderDepositSwapLookupOptions;
        }
      }
    } catch {
      // Ignore cache deserialization failures
    }
  }

  const url = `${BFF_BASE_URL}/lookups${forceRefresh ? "?refresh=true" : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`[CylinderDepositSwapRepo] Lookups fetch failed with status ${res.status}`);
  }

  const data = (await res.json()) as CylinderDepositSwapLookupOptions;

  // Persist to client sessionStorage
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        LOOKUPS_STORAGE_KEY,
        JSON.stringify({ timestamp: Date.now(), data })
      );
    } catch {
      // Ignore quota exceeded
    }
  }

  return data;
}

/**
 * Fetches the drill-down detail dataset for a specific customer, including active serials,
 * matched financial cash deposit records, and complete transaction timeline.
 */
export async function fetchCustomerDepositSwapDetail(
  customerCode: string,
  filters: Pick<CylinderDepositSwapFilters, "startDate" | "endDate">
): Promise<CustomerDepositSwapDetailResponse> {
  const params = new URLSearchParams();
  params.set("customerDetail", customerCode);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  const url = `${BFF_BASE_URL}?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `[CylinderDepositSwapRepo] Detail fetch failed for customer ${customerCode} with status ${res.status}`
    );
  }

  return (await res.json()) as CustomerDepositSwapDetailResponse;
}
