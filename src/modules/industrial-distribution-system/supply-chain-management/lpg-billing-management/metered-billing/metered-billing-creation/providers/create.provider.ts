import type { MeteredWiwoTransaction } from "../../metered-billing-common/types";

export async function createMeteredTransaction(
  payload: Partial<MeteredWiwoTransaction>
): Promise<MeteredWiwoTransaction | null> {
  try {
    const res = await window.fetch("/api/ids/scm/lpg-billing-management/metered-billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed with status ${res.status}`);
    }
    const json = await res.json();
    return json.data || json;
  } catch (error) {
    console.error("[createMeteredTransaction] error:", error);
    throw error;
  }
}
