// services/branch-operational-performance.repo.ts
// ──────────────────────────────────────────────────────────────────────────────
// Client-side fetch repository for the Next.js BFF endpoint.
// ──────────────────────────────────────────────────────────────────────────────

import type {
  BranchOperationalFilters,
  BranchOperationalReportResponse,
  ReportLookupsResponse,
} from "../types/branch-operational-performance.types";

const BFF_REPORT_PATH = "/api/ids/bia/branch-analytics/branch-operational-performance-report";
const BFF_LOOKUPS_PATH = "/api/ids/bia/branch-analytics/branch-operational-performance-report/lookups";

export async function fetchBranchOperationalReport(
  filters: BranchOperationalFilters,
  signal?: AbortSignal
): Promise<BranchOperationalReportResponse> {
  const params = new URLSearchParams();
  if (filters.branchId) params.set("branchId", String(filters.branchId));
  if (filters.custodianCode) params.set("custodianCode", filters.custodianCode);
  if (filters.incidentType && filters.incidentType !== "all") params.set("incidentType", filters.incidentType);
  if (filters.recoveryStatus && filters.recoveryStatus !== "all") params.set("recoveryStatus", filters.recoveryStatus);
  if (filters.chargeStatus && filters.chargeStatus !== "all") params.set("chargeStatus", filters.chargeStatus);
  params.set("startDate", filters.startDate);
  params.set("endDate", filters.endDate);

  const res = await fetch(`${BFF_REPORT_PATH}?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || `Failed to fetch report (${res.status})`);
  }

  return await res.json();
}

export async function fetchBranchOperationalLookups(
  signal?: AbortSignal
): Promise<ReportLookupsResponse> {
  const res = await fetch(BFF_LOOKUPS_PATH, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    return { branches: [], custodians: [] };
  }

  return await res.json();
}
