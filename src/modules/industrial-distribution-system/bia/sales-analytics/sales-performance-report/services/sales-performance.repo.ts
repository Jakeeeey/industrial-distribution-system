// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/services/sales-performance.repo.ts
// ==============================================================================
// Sales Performance Report - Client Repository
// Handles API calls, query serialization, and persistent lookups caching.
// ==============================================================================

import type { SalesPerformanceFilterInput } from "../types/sales-performance.schema";
import type {
  SalesPerformanceReportResponse,
  SalesPerformanceLookupsResponse,
} from "../types/sales-performance.types";

const BFF_URL = "/api/ids/bia/sales-analytics/sales-performance-report";
// DEV-RULE: Bump lookups cache key to v2 and never persist empty array lookups
const LOOKUPS_STORAGE_KEY = "vos_ids_bia_sales_perf_lookups_v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchSalesPerformanceReportClient(
  filters: Partial<SalesPerformanceFilterInput>
): Promise<SalesPerformanceReportResponse> {
  const params = new URLSearchParams();

  if (filters.branchId && filters.branchId !== "ALL") params.set("branchId", filters.branchId);
  if (filters.customerCode && filters.customerCode !== "ALL") params.set("customerCode", filters.customerCode);
  if (filters.productId && filters.productId !== "ALL") params.set("productId", filters.productId);
  if (filters.salesmanId && filters.salesmanId !== "ALL") params.set("salesmanId", filters.salesmanId);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.datePreset) params.set("datePreset", filters.datePreset);
  if (filters.taxTreatment && filters.taxTreatment !== "ALL") {
    params.set("taxTreatment", filters.taxTreatment);
  }
  if (filters.searchQuery) params.set("searchQuery", filters.searchQuery.trim());
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

  const res = await fetch(`${BFF_URL}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Report fetch failed (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to load sales report data");
  }

  return json.data as SalesPerformanceReportResponse;
}

export async function fetchSalesPerformanceLookupsClient(
  forceRefresh = false
): Promise<SalesPerformanceLookupsResponse> {
  if (!forceRefresh && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOOKUPS_STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const data = cached?.data as SalesPerformanceLookupsResponse | undefined;
        // DEV-RULE: Only accept cache if it has actual populated lookups
        if (
          cached?.timestamp &&
          Date.now() - cached.timestamp < CACHE_TTL_MS &&
          data &&
          (data.branches?.length > 0 || data.customers?.length > 0 || data.products?.length > 0)
        ) {
          return data;
        }
      }
    } catch {
      // Ignore cache reading error
    }
  }

  const res = await fetch(`${BFF_URL}?mode=lookups`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Lookups fetch failed (${res.status})`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to load lookups");
  }

  const lookups = json.data as SalesPerformanceLookupsResponse;

  if (typeof window !== "undefined") {
    try {
      // DEV-RULE: Only persist to localStorage if lookups actually contain items
      if (
        lookups &&
        (lookups.branches?.length > 0 ||
          lookups.customers?.length > 0 ||
          lookups.products?.length > 0)
      ) {
        localStorage.setItem(
          LOOKUPS_STORAGE_KEY,
          JSON.stringify({ timestamp: Date.now(), data: lookups })
        );
      }
    } catch {
      // Ignore cache write error
    }
  }

  return lookups;
}
