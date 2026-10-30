// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/services/stock-movement-variance.repo.ts
// ==============================================================================
// Client-side repository for the Stock Movement and Variance Report.
// Strict segregation: purely handles fetch requests, parameter serialisation and
// dual-tier client caching for filter lookups.
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// - Robust error propagation and JSON response parsing
// ==============================================================================

import type {
  StockMovementVarianceFilters,
  StockMovementVarianceLookupOptions,
  StockMovementVarianceReportResponse,
} from "../types/stock-movement-variance.types";

// src/app/api/ids/scm/inventory-management/stock-movement-and-variance-report/route.ts
const BFF_BASE_URL = "/api/ids/scm/inventory-management/stock-movement-and-variance-report";

/**
 * Builds URL search parameters from the filters object, omitting empty values so
 * the BFF never sees a blank branch scope it would have to interpret.
 */
function buildSearchParams(filters: StockMovementVarianceFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.branchId !== undefined && filters.branchId !== "") {
    params.set("branchId", String(filters.branchId));
  }
  if (filters.categoryId !== undefined && filters.categoryId !== "") {
    params.set("categoryId", String(filters.categoryId));
  }
  if (filters.productName?.trim()) params.set("productName", filters.productName.trim());
  return params;
}

/**
 * Fetches the reconciled variance dataset for the supplied filter set.
 * The BFF returns the full calculation including supporting documents per row.
 */
export async function fetchStockMovementVarianceReport(
  filters: StockMovementVarianceFilters
): Promise<StockMovementVarianceReportResponse> {
  const url = `${BFF_BASE_URL}?${buildSearchParams(filters).toString()}`;

  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as
    | StockMovementVarianceReportResponse
    | { ok?: false; error?: string; message?: string }
    | null;

  if (!res.ok || !payload || !("rows" in payload)) {
    const detail =
      (payload as { error?: string; message?: string } | null)?.error ??
      (payload as { error?: string; message?: string } | null)?.message ??
      `Report request failed with status ${res.status}`;
    throw new Error(detail);
  }

  return payload;
}

const LOOKUPS_STORAGE_KEY = "ids_scm_stock_movement_variance_lookups_v1";
const LOOKUPS_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes TTL

interface CachedLookups {
  savedAt: number;
  options: StockMovementVarianceLookupOptions;
}

/**
 * Reads a previously cached lookup set from sessionStorage, honouring the TTL.
 */
function readLookupsCache(): StockMovementVarianceLookupOptions | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LOOKUPS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLookups;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > LOOKUPS_CACHE_DURATION) return null;
    return parsed.options;
  } catch {
    return null;
  }
}

/**
 * Persists a lookup set to sessionStorage. Failure is non-fatal: the report must
 * still load when storage is unavailable (private mode, quota).
 */
function writeLookupsCache(options: StockMovementVarianceLookupOptions): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedLookups = { savedAt: Date.now(), options };
    window.sessionStorage.setItem(LOOKUPS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Cache is an optimisation only, so a write failure is ignored.
  }
}

/**
 * Fetches dynamic lookup options for the filter bar (branches, categories,
 * products) with a sessionStorage-first cache.
 */
export async function fetchStockMovementVarianceLookups(
  forceRefresh = false
): Promise<StockMovementVarianceLookupOptions> {
  if (!forceRefresh) {
    const cached = readLookupsCache();
    if (cached) return cached;
  }

  const res = await fetch(`${BFF_BASE_URL}/lookups`, { method: "GET", cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: StockMovementVarianceLookupOptions; error?: string }
    | null;

  if (!res.ok || !payload?.data) {
    throw new Error(payload?.error ?? `Lookup request failed with status ${res.status}`);
  }

  writeLookupsCache(payload.data);
  return payload.data;
}
