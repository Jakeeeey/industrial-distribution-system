// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/services/lost-damaged-cylinder.repo.ts
// ==============================================================================
// Lost and Damaged Cylinder Report - Client Repository
// Manages fetch requests, query serialization, and persistent lookups cache.
// ==============================================================================

import type { LostDamagedFilterInput } from "../types/lost-damaged-cylinder.schema";
import type {
  LostDamagedReportResponse,
  LostDamagedLookupsResponse,
} from "../types/lost-damaged-cylinder.types";

const BFF_URL = "/api/ids/arf/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report";
const LOOKUPS_STORAGE_KEY = "vos_ids_arf_lost_damaged_lookups_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchLostDamagedReportClient(
  filters: Partial<LostDamagedFilterInput>
): Promise<LostDamagedReportResponse> {
  const params = new URLSearchParams();

  if (filters.branchId && filters.branchId !== "ALL") params.set("branchId", filters.branchId);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.datePreset) params.set("datePreset", filters.datePreset);
  if (filters.incidentCategory && filters.incidentCategory !== "ALL") {
    params.set("incidentCategory", filters.incidentCategory);
  }
  if (filters.condition && filters.condition !== "ALL") {
    params.set("condition", filters.condition);
  }
  if (filters.status && filters.status !== "ALL") {
    params.set("status", filters.status);
  }
  if (filters.chargeStatus && filters.chargeStatus !== "ALL") {
    params.set("chargeStatus", filters.chargeStatus);
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
    throw new Error(json.error || "Failed to load report data");
  }

  return json.data as LostDamagedReportResponse;
}

export async function fetchLostDamagedLookupsClient(
  forceRefresh = false
): Promise<LostDamagedLookupsResponse> {
  if (!forceRefresh && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOOKUPS_STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && Date.now() - cached.timestamp < CACHE_TTL_MS && cached.data) {
          return cached.data as LostDamagedLookupsResponse;
        }
      }
    } catch {
      // Ignore cache reading error
    }
  }

  const res = await fetch(`${BFF_URL}?mode=lookups`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Lookups fetch failed (${res.status})`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || "Failed to load lookups");
  }

  const lookups = json.data as LostDamagedLookupsResponse;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        LOOKUPS_STORAGE_KEY,
        JSON.stringify({ timestamp: Date.now(), data: lookups })
      );
    } catch {
      // Ignore cache write error
    }
  }

  return lookups;
}
