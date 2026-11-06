// ============================================================
// customer-order-consumption.client.ts
// Browser-side calls to the BFF routes. The Directus token lives only on
// the server, so this file knows endpoints and shapes and nothing else.
// ============================================================

import type {
  AppliedFilterContext,
  CustomerOrderConsumptionDetail,
  CustomerOrderConsumptionReportResponse,
  ReportLookupOption,
} from "../types/customer-order-consumption.types";

const REPORT_ENDPOINT =
  "/api/ids/crm/customer-reports/customer-order-and-consumption-report";
const LOOKUP_ENDPOINT = `${REPORT_ENDPOINT}/lookups`;

/** Carries the BFF error code so the UI can word a retry vs a rejection. */
export class CustomerOrderConsumptionApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "CustomerOrderConsumptionApiError";
    this.code = code;
    this.status = status;
  }
}

type QueryValue = string | number | readonly (string | number)[] | undefined;

/**
 * A selection list becomes the same key repeated, which is what the BFF
 * collects back into an array. An empty list is omitted entirely: "nothing
 * picked" and "no filter" are the same request.
 */
function buildQuery(values: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (String(item).trim() === "") continue;
        params.append(key, String(item));
      }
      continue;
    }
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

async function readJson<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CustomerOrderConsumptionApiError(
      "INVALID_RESPONSE",
      "The report service returned a response that could not be read.",
      response.status
    );
  }

  if (!response.ok) {
    const body = payload as { code?: string; message?: string } | null;
    throw new CustomerOrderConsumptionApiError(
      body?.code ?? "REPORT_FAILED",
      body?.message ?? `Request failed with status ${response.status}.`,
      response.status
    );
  }

  return payload as T;
}

/** Requests the full report for one applied filter set. */
export async function requestCustomerOrderConsumptionReport(
  filters: AppliedFilterContext,
  signal?: AbortSignal
): Promise<CustomerOrderConsumptionReportResponse> {
  const query = buildQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    customerCodes: filters.customerCodes,
    branchIds: filters.branchIds,
    salesmanIds: filters.salesmanIds,
    classificationIds: filters.classificationIds,
    channel: filters.channel,
    customerLabels: filters.customerLabels,
    branchLabels: filters.branchLabels,
    salesmanLabels: filters.salesmanLabels,
    classificationLabels: filters.classificationLabels,
  });

  const response = await fetch(`${REPORT_ENDPOINT}?${query}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  return readJson<CustomerOrderConsumptionReportResponse>(response);
}

/** Requests the supporting documents behind one customer row group. */
export async function requestCustomerOrderConsumptionDetail(
  filters: AppliedFilterContext,
  customerCode: string,
  signal?: AbortSignal
): Promise<CustomerOrderConsumptionDetail> {
  // The drill-down narrows the open report to one customer, so the customer
  // multi-select is deliberately not forwarded — `customerDetail` wins.
  const query = buildQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    branchIds: filters.branchIds,
    salesmanIds: filters.salesmanIds,
    classificationIds: filters.classificationIds,
    channel: filters.channel,
    customerDetail: customerCode,
  });

  const response = await fetch(`${REPORT_ENDPOINT}?${query}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  return readJson<CustomerOrderConsumptionDetail>(response);
}

/** Requests filter-bar options for one whitelisted collection. */
export async function requestReportLookupOptions(
  type: "customers" | "branches" | "salesmen" | "classifications",
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
