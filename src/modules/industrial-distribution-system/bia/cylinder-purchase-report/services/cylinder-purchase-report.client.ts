import type {
  AppliedFilterContext,
  CylinderPurchaseDashboardResponse,
  ReportLookupOption,
  ReportLookupResponse,
  ReportLookupType,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

export async function fetchCylinderPurchaseDashboard(
  filters: AppliedFilterContext,
  signal?: AbortSignal,
): Promise<CylinderPurchaseDashboardResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const response = await fetch(
    `/api/ids/bia/cylinder-purchase-report?${params.toString()}`,
    { cache: "no-store", signal },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message || `Report request failed (${response.status}).`,
    );
  }

  return response.json() as Promise<CylinderPurchaseDashboardResponse>;
}

export async function fetchReportLookups(
  type: ReportLookupType,
  query: string,
  signal?: AbortSignal,
): Promise<ReportLookupOption[]> {
  const params = new URLSearchParams({ type, q: query });
  const response = await fetch(
    `/api/ids/bia/cylinder-purchase-report/lookups?${params.toString()}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error("Unable to load filter options.");
  }

  return ((await response.json()) as ReportLookupResponse).data;
}
