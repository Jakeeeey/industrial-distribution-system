// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/services/deliver-performance.repo.ts
// ==============================================================================
// Delivery Performance Report - Repository Layer
// Fetches records from Directus ERP collections with parameter sanitization
// and chunking for queries with large foreign-key lists.
// ==============================================================================

const DIRECTUS_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function itemsBase(base: string): string {
  const clean = base.replace(/\/+$/, "");
  if (!clean) return "";
  if (clean.endsWith("/items")) return clean;
  return `${clean}/items`;
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (STATIC_TOKEN) {
    headers["Authorization"] = `Bearer ${STATIC_TOKEN}`;
  }
  return headers;
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetch generic items from Directus collection
 */
async function fetchDirectusCollection<T>(
  collection: string,
  queryString: string
): Promise<T[]> {
  const base = itemsBase(DIRECTUS_BASE);
  if (!base) {
    console.warn("[deliver-performance.repo] Missing DIRECTUS_BASE URL.");
    return [];
  }

  const url = `${base}/${collection}?${queryString}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[deliver-performance.repo] Error fetching ${collection}:`, res.status, errText);
      return [];
    }

    const json = await res.json();
    return Array.isArray(json.data) ? (json.data as T[]) : [];
  } catch (err) {
    console.error(`[deliver-performance.repo] Failed to fetch ${collection}:`, err);
    return [];
  }
}

/**
 * Lookups for filter selectors
 */
export async function repoFetchLookups() {
  const [branches, customers, users] = await Promise.all([
    fetchDirectusCollection<{ id: number; branch_code: string; branch_name: string }>(
      "branches",
      "limit=-1&fields=id,branch_code,branch_name&sort=branch_name"
    ),
    fetchDirectusCollection<{ customer_code: string; customer_name: string; store_name: string }>(
      "customer",
      "limit=500&fields=customer_code,customer_name,store_name&sort=customer_name"
    ),
    fetchDirectusCollection<{ user_id: number; user_fname: string; user_lname: string }>(
      "user",
      "limit=500&fields=user_id,user_fname,user_lname&filter[is_employee][_eq]=1&sort=user_fname"
    ),
  ]);

  return {
    branches,
    customers,
    drivers: users.map((u) => ({
      user_id: u.user_id,
      name: `${u.user_fname} ${u.user_lname}`.trim(),
    })),
    statuses: [
      "Fulfilled",
      "Fulfilled With Concerns",
      "Fulfilled With Returns",
      "Not Fulfilled",
    ] as const,
  };
}

/**
 * Query sales invoices within the timeframe and optional branch
 */
export async function repoFetchSalesInvoices(params: {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  customerCode?: string;
}) {
  const queryParts: string[] = [
    "limit=-1",
    "fields=invoice_id,invoice_no,customer_code,branch_id,dispatch_date,total_amount,gross_amount,discount_amount,net_amount,transaction_status",
    "filter[transaction_status][_neq]=Voided",
  ];

  if (params.startDate && params.endDate) {
    queryParts.push(`filter[dispatch_date][_between]=${params.startDate},${params.endDate}`);
  } else if (params.startDate) {
    queryParts.push(`filter[dispatch_date][_gte]=${params.startDate}`);
  } else if (params.endDate) {
    queryParts.push(`filter[dispatch_date][_lte]=${params.endDate}`);
  }

  if (params.branchId && params.branchId !== "all") {
    queryParts.push(`filter[branch_id][_eq]=${params.branchId}`);
  }

  if (params.customerCode && params.customerCode !== "all") {
    queryParts.push(`filter[customer_code][_eq]=${params.customerCode}`);
  }

  return fetchDirectusCollection<{
    invoice_id: number;
    invoice_no: string;
    customer_code: string;
    branch_id: number;
    dispatch_date: string;
    total_amount: number;
    gross_amount: number;
    discount_amount: number;
    net_amount: number;
    transaction_status: string;
  }>("sales_invoice", queryParts.join("&"));
}

/**
 * Query post dispatch invoice lines for the found sales invoices
 */
export async function repoFetchPostDispatchInvoices(invoiceIds: number[]) {
  if (!invoiceIds.length) return [];

  const chunks = chunkArray(invoiceIds, 100);
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const idsStr = chunk.join(",");
      return fetchDirectusCollection<{
        id: number;
        post_dispatch_plan_id: number;
        invoice_id: number;
        status: string;
        isCleared: number;
        remarks: string | null;
      }>(
        "post_dispatch_invoices",
        `limit=-1&filter[invoice_id][_in]=${idsStr}&fields=id,post_dispatch_plan_id,invoice_id,status,isCleared,remarks`
      );
    })
  );

  return results.flat();
}

/**
 * Query post dispatch plan trip headers
 */
export async function repoFetchPostDispatchPlans(planIds: number[]) {
  if (!planIds.length) return [];

  const chunks = chunkArray(planIds, 100);
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const idsStr = chunk.join(",");
      return fetchDirectusCollection<{
        id: number;
        doc_no: string;
        driver_id: number;
        vehicle_id: number;
        starting_point: number;
        total_distance: number;
        status: string;
        time_of_dispatch: string | null;
        time_of_arrival: string | null;
        estimated_time_of_arrival: string | null;
      }>(
        "post_dispatch_plan",
        `limit=-1&filter[id][_in]=${idsStr}&fields=id,doc_no,driver_id,vehicle_id,starting_point,total_distance,status,time_of_dispatch,time_of_arrival,estimated_time_of_arrival`
      );
    })
  );

  return results.flat();
}

/**
 * Query invoice line item quantities
 */
export async function repoFetchInvoiceDetails(invoiceIds: number[]) {
  if (!invoiceIds.length) return [];

  const chunks = chunkArray(invoiceIds, 100);
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const idsStr = chunk.join(",");
      return fetchDirectusCollection<{
        detail_id: number;
        invoice_no: number;
        product_id: number;
        quantity: number;
        unit_price: number;
        total_amount: number;
      }>(
        "sales_invoice_details",
        `limit=-1&filter[invoice_no][_in]=${idsStr}&fields=detail_id,invoice_no,product_id,quantity,unit_price,total_amount`
      );
    })
  );

  return results.flat();
}

