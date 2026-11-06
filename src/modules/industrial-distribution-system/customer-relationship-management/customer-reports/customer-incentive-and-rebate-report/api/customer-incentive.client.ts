// ============================================================
// customer-incentive.client.ts
// Browser-side calls to the BFF routes. The Directus token lives only on
// the server, so this file knows endpoints and shapes and nothing else.
// ============================================================

import type {
  AppliedFilterContext,
  CustomerIncentiveDetail,
  CustomerIncentiveReportResponse,
  ReportLookupKind,
  ReportLookupOption,
} from "../types/customer-incentive.types";

const REPORT_ENDPOINT =
  "/api/ids/crm/customer-reports/customer-incentive-and-rebate-report";
const LOOKUP_ENDPOINT = `${REPORT_ENDPOINT}/lookups`;

/** Carries the BFF error code so the UI can word a retry vs a rejection. */
export class CustomerIncentiveApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "CustomerIncentiveApiError";
    this.code = code;
    this.status = status;
  }
}

type QueryValue =
  | string
  | number
  | readonly (string | number)[]
  | undefined
  | null;

/**
 * Lists are sent as the same key repeated rather than one joined string: a
 * customer label carries commas, and a delimiter that survives every label in
 * the master is not a delimiter worth inventing.
 */
function buildQuery(values: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    const items: readonly (string | number)[] = Array.isArray(value)
      ? value
      : [value as string | number];
    for (const item of items) {
      const text = String(item).trim();
      // An empty selection is "no cut", so it must not reach the query at all.
      if (text) params.append(key, text);
    }
  }
  return params.toString();
}

async function readJson<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CustomerIncentiveApiError(
      "INVALID_RESPONSE",
      "The report service returned a response that could not be read.",
      response.status
    );
  }

  if (!response.ok) {
    const body = payload as { code?: string; message?: string } | null;
    throw new CustomerIncentiveApiError(
      body?.code ?? "REPORT_FAILED",
      body?.message ?? `Request failed with status ${response.status}.`,
      response.status
    );
  }

  return payload as T;
}

/** Requests the full report for one applied filter set. */
export async function requestCustomerIncentiveReport(
  filters: AppliedFilterContext,
  signal?: AbortSignal
): Promise<CustomerIncentiveReportResponse> {
  const query = buildQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    customerCodes: filters.customerCodes,
    branchIds: filters.branchIds,
    salesmanIds: filters.salesmanIds,
    classificationIds: filters.classificationIds,
    claimStatus: filters.claimStatus,
    categoryIds: filters.categoryIds,
    sizeKg: filters.sizeKg,
    customerLabels: filters.customerLabels,
    branchLabels: filters.branchLabels,
    salesmanLabels: filters.salesmanLabels,
    classificationLabels: filters.classificationLabels,
    categoryLabels: filters.categoryLabels,
  });

  const response = await fetch(`${REPORT_ENDPOINT}?${query}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  return readJson<CustomerIncentiveReportResponse>(response);
}

/** Requests the evidence and claims behind one customer row. */
export async function requestCustomerIncentiveDetail(
  filters: AppliedFilterContext,
  customerCode: string,
  signal?: AbortSignal
): Promise<CustomerIncentiveDetail> {
  const query = buildQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    branchIds: filters.branchIds,
    salesmanIds: filters.salesmanIds,
    classificationIds: filters.classificationIds,
    claimStatus: filters.claimStatus,
    categoryIds: filters.categoryIds,
    sizeKg: filters.sizeKg,
    customerDetail: customerCode,
  });

  const response = await fetch(`${REPORT_ENDPOINT}?${query}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  return readJson<CustomerIncentiveDetail>(response);
}

/** Requests filter-bar options for one whitelisted collection. */
export async function requestReportLookupOptions(
  type: ReportLookupKind,
  term?: string,
  signal?: AbortSignal
): Promise<ReportLookupOption[]> {
  const query = buildQuery({ type, q: term?.trim().slice(0, 100) });
  const response = await fetch(`${LOOKUP_ENDPOINT}?${query}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  const payload = await readJson<{ data?: ReportLookupOption[] }>(response);
  return payload.data ?? [];
}
