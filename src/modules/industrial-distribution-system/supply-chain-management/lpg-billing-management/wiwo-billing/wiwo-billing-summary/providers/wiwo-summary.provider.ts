// RULE DEV: WiWO Billing Summary Provider
// Fetches the list and detail of lpg_metered_wiwo_transactions from the wiwo-billing API route
// for summary/reporting purposes only (read-only).

import type { MeteredWiwoTransaction } from "../types";
import type { WiwoSummaryListParams } from "../types";

/**
 * Fetch paginated list of WiWO billing transactions for summary view.
 * Calls the existing /api/ids/scm/lpg-billing-management/wiwo-billing endpoint.
 */
export async function fetchWiwoSummaryList(params: WiwoSummaryListParams = {}): Promise<{
  data: MeteredWiwoTransaction[];
  total: number;
}> {
  try {
    const qs = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 10),
      ...(params.search ? { search: params.search } : {}),
      ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
      ...(params.transactionType && params.transactionType !== "ALL"
        ? { transactionType: params.transactionType }
        : {}),
    });
    const res = await window.fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing?${qs}`);
    if (!res.ok) throw new Error("Failed to fetch WiWO billing summary list");
    return res.json();
  } catch (error) {
    console.error("[fetchWiwoSummaryList] error:", error);
    return { data: [], total: 0 };
  }
}

/**
 * Fetch detailed single WiWO billing transaction by ID.
 * Calls /api/ids/scm/lpg-billing-management/wiwo-billing/[id]
 */
export async function fetchWiwoSummaryDetail(id: number): Promise<MeteredWiwoTransaction | null> {
  try {
    const res = await window.fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing/${id}`);
    if (!res.ok) throw new Error("Failed to fetch WiWO billing summary detail");
    const json = await res.json();
    return json.data || json;
  } catch (error) {
    console.error("[fetchWiwoSummaryDetail] error:", error);
    return null;
  }
}
