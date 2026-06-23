import type { MeteredWiwoTransaction, MeteredListParams } from "../../metered-billing-common/types";

export async function fetchSummaryList(params: MeteredListParams = {}): Promise<{
  data: MeteredWiwoTransaction[];
  total: number;
}> {
  try {
    const qs = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 10),
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.transactionType && params.transactionType !== "ALL"
        ? { transactionType: params.transactionType }
        : {}),
    });
    const res = await window.fetch(`/api/ids/scm/lpg-billing-management/metered-billing?${qs}`);
    if (!res.ok) throw new Error("Failed to fetch billing summary list");
    return res.json();
  } catch (error) {
    console.error("[fetchSummaryList] error:", error);
    return { data: [], total: 0 };
  }
}

export async function fetchSummaryDetail(id: number): Promise<MeteredWiwoTransaction | null> {
  try {
    const res = await window.fetch(`/api/ids/scm/lpg-billing-management/metered-billing/${id}`);
    if (!res.ok) throw new Error("Failed to fetch billing summary details");
    const json = await res.json();
    return json.data || json;
  } catch (error) {
    console.error("[fetchSummaryDetail] error:", error);
    return null;
  }
}
