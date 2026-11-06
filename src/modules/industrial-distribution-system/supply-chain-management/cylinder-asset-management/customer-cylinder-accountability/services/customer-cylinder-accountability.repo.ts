// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/services/customer-cylinder-accountability.repo.ts
// ==============================================================================
// Client Repository for Customer Cylinder Accountability Report (VoSync BIA Subsystem)
// Strict segregation: purely handles fetch requests, parameter serialization,
// and dual-tier client caching for lookups.
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// - Robust error propagation and JSON response parsing
// ==============================================================================

import type {
  CustomerAccountabilityFilters,
  CustomerAccountabilityReportResponse,
  CustomerAccountabilityDetailResponse,
  AccountabilityLookupOptions,
} from "../types/customer-cylinder-accountability.types";

const BFF_BASE_URL = "/api/ids/scm/cylinder-asset-management/customer-cylinder-accountability";

/**
 * Builds URL search parameters from filters object, omitting empty/undefined fields.
 */
function buildSearchParams(filters: CustomerAccountabilityFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.branchId !== undefined && filters.branchId !== "" && filters.branchId !== "ALL") {
    params.set("branchId", String(filters.branchId));
  }
  if (filters.customerCode?.trim()) {
    params.set("customerCode", filters.customerCode.trim());
  }
  if (filters.ownership && filters.ownership !== "ALL") {
    params.set("ownership", filters.ownership);
  }
  return params;
}

/**
 * Fetches the aggregated customer cylinder accountability report dataset from the BFF.
 */
export async function fetchCustomerAccountabilityReport(
  filters: CustomerAccountabilityFilters
): Promise<CustomerAccountabilityReportResponse> {
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
      `[AccountabilityRepo] Report fetch failed with status ${res.status}: ${errorBody}`
    );
  }

  return (await res.json()) as CustomerAccountabilityReportResponse;
}

const LOOKUPS_STORAGE_KEY = "vos_ids_bia_customer_accountability_lookups_v5";
const LOOKUPS_CACHE_DURATION = 60 * 1000; // 1 minute client cache
const INDUSTRIAL_BRANCH_IDS = new Set([196, 197, 278, 279, 280]);

function sanitizeAccountabilityLookups(data: AccountabilityLookupOptions): AccountabilityLookupOptions {
  if (Array.isArray(data?.branches)) {
    data.branches = data.branches.filter((b) => {
      if (b.division_id != null && (b.division_id as unknown) !== "") {
        return Number(b.division_id) === 1 && INDUSTRIAL_BRANCH_IDS.has(Number(b.id));
      }
      return INDUSTRIAL_BRANCH_IDS.has(Number(b.id));
    });
  }
  return data;
}

/**
 * Fetches dynamic lookup options for branches, customers, and ownership categories.
 * Employs short-lived client caching while actively purging stale legacy caches.
 */
export async function fetchAccountabilityLookups(
  forceRefresh = false
): Promise<AccountabilityLookupOptions> {
  // AG-COMMENT: Purge legacy cache keys that held non-industrial branches
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("vos_ids_bia_customer_accountability_lookups");
      localStorage.removeItem("vos_ids_bia_customer_accountability_lookups_v1");
      localStorage.removeItem("vos_ids_bia_customer_accountability_lookups_v2");
      localStorage.removeItem("vos_ids_bia_customer_accountability_lookups_v3");
      localStorage.removeItem("vos_ids_bia_customer_accountability_lookups_v4");
    } catch {
      // Ignore
    }
  }

  if (!forceRefresh && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOOKUPS_STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && Date.now() - cached.timestamp < LOOKUPS_CACHE_DURATION && cached.data) {
          return sanitizeAccountabilityLookups(cached.data as AccountabilityLookupOptions);
        }
      }
    } catch {
      // Ignore cache retrieval errors
    }
  }

  const url = `${BFF_BASE_URL}/lookups${forceRefresh ? "?refresh=true" : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`[AccountabilityRepo] Lookups fetch failed with status ${res.status}`);
  }

  const rawData = (await res.json()) as AccountabilityLookupOptions;
  const data = sanitizeAccountabilityLookups(rawData);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
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
 * Fetches supporting transaction ledger and physical serial drill-down records for a specific customer.
 */
export async function fetchCustomerAccountabilityDetail(
  customerCode: string,
  filters: Pick<CustomerAccountabilityFilters, "startDate" | "endDate">
): Promise<CustomerAccountabilityDetailResponse> {
  const params = new URLSearchParams();
  params.set("customerDetail", customerCode.trim());
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
      `[AccountabilityRepo] Customer drilldown failed with status ${res.status}`
    );
  }

  return (await res.json()) as CustomerAccountabilityDetailResponse;
}
