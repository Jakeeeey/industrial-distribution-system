// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.repo.ts
// ==============================================================================
// Client Repository for the Cylinder Utilization Report.
//
// Browser-side fetch layer only. It never addresses Directus: every method targets
// this module's BFF gateway, which owns the Directus reads and the maths. Lookup
// vocabulary is mirrored into localStorage so a page reload does not re-pull the
// branch and size directories.
//
// Complies with VoSync standards:
// - Zero business logic in this layer (see the Logic Layering Standard)
// - Full comments left behind for long-term maintainability
// ==============================================================================

import type {
  CylinderUtilizationDetailResponse,
  CylinderUtilizationFilters,
  CylinderUtilizationReportResponse,
  UtilizationBucket,
  UtilizationLookupOptions,
} from "../types/cylinder-utilization-report.types";

/** Internal BFF gateway — never address Directus from the client. */
const BFF_BASE_URL = "/api/ids/bia/cylinder-analytics/cylinder-utilization-report";

/** Persistent client cache key; versioned so a contract change invalidates it. */
// AG-COMMENT: Bumped to v2 to invalidate cached lookups and reflect products.description updates
const LOOKUPS_STORAGE_KEY = "vos_ids_bia_cylinder_utilization_lookups_v2";
const LOOKUPS_CACHE_MS = 24 * 60 * 60 * 1000;

/** Builds the query string, omitting selectors that mean "no scoping". */
function buildSearchParams(filters: CylinderUtilizationFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.branchId !== undefined && filters.branchId !== "" && filters.branchId !== "ALL") {
    params.set("branchId", String(filters.branchId));
  }
  if (filters.productId !== undefined && filters.productId !== "" && filters.productId !== "ALL") {
    params.set("productId", String(filters.productId));
  }
  return params;
}

/** Shared response unwrapping so a non-2xx never resolves into an empty report. */
async function readJson<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[CylinderUtilizationRepo] ${label} failed with status ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

/**
 * Fetches the branch × cylinder-size utilization dataset.
 * Explicit no-store: utilization is a live fleet reading and must never be cached
 * across a refresh.
 */
export async function fetchCylinderUtilizationReport(
  filters: CylinderUtilizationFilters
): Promise<CylinderUtilizationReportResponse> {
  const params = buildSearchParams(filters);
  const res = await fetch(`${BFF_BASE_URL}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  return readJson<CylinderUtilizationReportResponse>(res, "report");
}

/**
 * Fetches the supporting cylinders behind one grouping row (spec §5).
 * `branchId` / `productId` are sent as "ALL" for the pseudo-groupings so the
 * gateway can resolve the unassigned / unmapped buckets.
 */
export async function fetchCylinderUtilizationDetail(
  selector: { branchId: number | null; productId: number | null; bucket?: UtilizationBucket | null },
  filters: Pick<CylinderUtilizationFilters, "startDate" | "endDate">
): Promise<CylinderUtilizationDetailResponse> {
  const params = new URLSearchParams();
  params.set("detail", "1");
  params.set("branchId", selector.branchId === null ? "ALL" : String(selector.branchId));
  params.set("productId", selector.productId === null ? "ALL" : String(selector.productId));
  if (selector.bucket) params.set("bucket", selector.bucket);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  const res = await fetch(`${BFF_BASE_URL}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  return readJson<CylinderUtilizationDetailResponse>(res, "drill-down");
}

/**
 * Fetches branch and cylinder-size filter vocabulary, preferring a 24-hour
 * localStorage mirror to avoid re-pulling static directories on every mount.
 */
export async function fetchUtilizationLookups(forceRefresh = false): Promise<UtilizationLookupOptions> {
  if (!forceRefresh && typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LOOKUPS_STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { timestamp?: number; data?: UtilizationLookupOptions };
        if (cached?.timestamp && cached.data && Date.now() - cached.timestamp < LOOKUPS_CACHE_MS) {
          return cached.data;
        }
      }
    } catch {
      // A corrupt or unavailable cache is not an error state; fall through to fetch.
    }
  }

  const res = await fetch(`${BFF_BASE_URL}/lookups${forceRefresh ? "?refresh=true" : ""}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const data = await readJson<UtilizationLookupOptions>(res, "lookups");

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOOKUPS_STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
    } catch {
      // Quota or private-mode failures only cost a re-fetch next visit.
    }
  }

  return data;
}
