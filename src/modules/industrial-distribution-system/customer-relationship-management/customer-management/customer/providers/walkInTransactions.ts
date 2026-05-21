import type { WalkInTransaction } from "../types";

async function parseError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json?.error || json?.message || `HTTP ${res.status}`;
  } catch {
    return res.statusText || "Request failed";
  }
}

/**
 * Fetches recent walk-in transactions from the dedicated API route.
 * The route handles the classification lookup + customer code join server-side.
 */
export async function fetchWalkInTransactions(): Promise<WalkInTransaction[]> {
  const res = await fetch("/api/ids/crm/customer/walk-in-transactions", {
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await parseError(res);
    throw new Error(
      err || `Failed to fetch walk-in transactions (${res.status})`,
    );
  }

  const json = await res.json();
  return (json.data ?? []) as WalkInTransaction[];
}
