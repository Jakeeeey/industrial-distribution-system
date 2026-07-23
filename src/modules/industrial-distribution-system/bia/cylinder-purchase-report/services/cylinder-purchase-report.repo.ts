import type { CylinderPurchaseReportFilters } from "../types/cylinder-purchase-report.types.ts";
import {
  isAbortError,
  UpstreamHttpError,
} from "./cylinder-purchase-report.errors.ts";

const REPORT_PATH = "/api/v-bia-cylinder-purchases/filter";

export interface CylinderPurchaseReportRepositoryOptions {
  fetchImpl?: typeof fetch;
  springBaseUrl?: string;
  signal?: AbortSignal;
}

export async function fetchCylinderPurchaseRows(
  filters: CylinderPurchaseReportFilters,
  options: CylinderPurchaseReportRepositoryOptions = {},
): Promise<unknown> {
  const base = (options.springBaseUrl ?? process.env.SPRING_API_BASE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (!base) {
    throw new Error("SPRING_API_BASE_URL is not configured.");
  }

  const url = new URL(`${base}${REPORT_PATH}`);
  if (filters.customerCode) {
    url.searchParams.set("customerCode", filters.customerCode);
  }
  if (filters.productId) {
    url.searchParams.set("productId", String(filters.productId));
  }
  if (filters.branchId) {
    url.searchParams.set("branchId", String(filters.branchId));
  }
  if (filters.salesmanId) {
    url.searchParams.set("salesmanId", String(filters.salesmanId));
  }
  url.searchParams.set("startDate", filters.startDate);
  url.searchParams.set("endDate", filters.endDate);

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new UpstreamHttpError(null, "", { cause: error });
  }
  if (!response.ok) {
    throw new UpstreamHttpError(response.status, response.statusText);
  }
  return response.json();
}
