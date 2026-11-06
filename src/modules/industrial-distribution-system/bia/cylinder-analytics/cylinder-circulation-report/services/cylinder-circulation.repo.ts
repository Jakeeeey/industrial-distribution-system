// services/cylinder-circulation.repo.ts
// ──────────────────────────────────────────────────────────────────────────────
// Client-side repository for Cylinder Circulation Report.
// Calls the internal Next.js BFF routes — never calls Directus or Spring directly from the client.
// ──────────────────────────────────────────────────────────────────────────────

import type {
  CylinderCirculationFilters,
  CylinderCirculationReportResponse,
  CylinderCirculationLookupsResponse,
} from "../types/cylinder-circulation.types";

const BFF_BASE = "/api/ids/bia/cylinder-analytics/cylinder-circulation-report";

function buildQueryParams(filters: CylinderCirculationFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.branchId !== undefined && filters.branchId !== "") {
    params.set("branchId", String(filters.branchId));
  }
  if (filters.productId !== undefined && filters.productId !== "") {
    params.set("productId", String(filters.productId));
  }
  if (filters.circulationStatus && filters.circulationStatus !== "ALL") {
    params.set("circulationStatus", filters.circulationStatus);
  }
  if (filters.serialNumber?.trim()) {
    params.set("serialNumber", filters.serialNumber.trim());
  }
  if (filters.startDate?.trim()) {
    params.set("startDate", filters.startDate.trim());
  }
  if (filters.endDate?.trim()) {
    params.set("endDate", filters.endDate.trim());
  }
  return params;
}

export async function fetchCylinderCirculationReport(
  filters: CylinderCirculationFilters
): Promise<CylinderCirculationReportResponse> {
  const params = buildQueryParams(filters);
  const url = params.toString() ? `${BFF_BASE}?${params.toString()}` : BFF_BASE;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to load cylinder circulation report (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  if (json?.data) return json.data as CylinderCirculationReportResponse;
  return json as CylinderCirculationReportResponse;
}

export async function fetchCylinderCirculationLookups(): Promise<CylinderCirculationLookupsResponse> {
  const url = `${BFF_BASE}/lookups`;
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to load filter lookups (${res.status})`);
  }

  const json = await res.json();
  if (json?.data) return json.data as CylinderCirculationLookupsResponse;
  return json as CylinderCirculationLookupsResponse;
}
