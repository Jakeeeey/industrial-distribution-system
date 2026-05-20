import { CustomerRecord } from "../types";

const BASE_URL = "/api/ids/crm/retail-trade-outlet/retail-directory";

/**
 * Fetches all customers for the retail directory
 */
export async function fetchCustomers(): Promise<CustomerRecord[]> {
  const res = await fetch(`${BASE_URL}?directusCollection=customer&limit=-1`);
  if (!res.ok) throw new Error("Failed to fetch customers");
  const json = await res.json();
  return json.data || json;
}

/**
 * Fetches customer classifications
 */
export async function fetchClassifications(): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${BASE_URL}?directusCollection=customer_classification&limit=-1`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

/**
 * Fetches store types
 */
export async function fetchStoreTypes(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE_URL}?directusCollection=store_type&limit=-1`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}
