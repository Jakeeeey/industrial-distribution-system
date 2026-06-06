import {
  directusFetch,
  getDirectusBase,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/directus";
import type {
  WiwoHeader,
  KiloBillingInvoice,
  KiloListParams,
} from "../types";
import { enrichWiwoDetails, computeKiloBillingSummary } from "../utils/kilo-consumption.calc";

const DIRECTUS_URL = getDirectusBase();
const FIELDS_HEADER =
  "id,wiwo_no,transaction_date,customer_code,lpg_site_id,wiwo_status,remarks,created_date," +
  "customer.customer_code,customer.customer_name,site.id,site.site_name,site.default_price_per_kg";

function mapWiwoHeader(raw: unknown): WiwoHeader {
  if (!raw) return raw as WiwoHeader;
  const r = raw as Record<string, unknown>;
  return {
    ...r,
    id: r.id as number,
    transaction_no: (r.wiwo_no ?? r.transaction_no) as string,
    status: (r.wiwo_status ?? r.status) as WiwoHeader["status"],
  } as WiwoHeader;
}
const FIELDS_DETAIL =
  "id,wiwo_header_id,site_cylinder_id,cylinder_asset_id,serial_number,opening_lpg_kg,gross_weight,tare_weight,remarks";

// ─── WIWO Transactions ────────────────────────────────────────────────────────

export async function fetchWiwoTransactions(params: KiloListParams): Promise<{
  data: WiwoHeader[];
  total: number;
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const offset = (page - 1) * limit;

  type FilterVal = { _eq?: string } | { _icontains?: string } | Array<Record<string, { _icontains: string }>>;
  const filters: Record<string, FilterVal> = {};
  if (params.status) filters.wiwo_status = { _eq: params.status };
  if (params.search) {
    filters._or = [
      { wiwo_no: { _icontains: params.search } },
      { customer_code: { _icontains: params.search } },
    ];
  }

  let qs = `fields=${FIELDS_HEADER}&sort=-transaction_date&limit=${limit}&offset=${offset}&meta=total_count`;
  if (Object.keys(filters).length > 0) {
    qs += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
  }

  const res = await directusFetch<{ data: Record<string, unknown>[]; meta?: { total_count: number } }>(
    `${DIRECTUS_URL}/items/lpg_wiwo_headers?${qs}`
  );
  return { data: (res.data ?? []).map(mapWiwoHeader), total: res.meta?.total_count ?? 0 };
}

export async function fetchWiwoById(id: number): Promise<WiwoHeader | null> {
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_wiwo_headers/${id}?fields=${FIELDS_HEADER},details.${FIELDS_DETAIL}`
  );
  const header = mapWiwoHeader(res.data);
  if (!header) return null;

  // Compute cylinder-level KG values
  if (header.details) {
    header.details = enrichWiwoDetails(header.details);
    const summary = computeKiloBillingSummary(
      header.details,
      header.site?.default_price_per_kg ?? 0
    );
    header.total_wiwo_kg = summary.billableKg;
  }

  return header;
}

// ─── Invoice (KiloBillingInvoice) ─────────────────────────────────────────────

export async function fetchInvoices(params: KiloListParams): Promise<{
  data: KiloBillingInvoice[];
  total: number;
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const offset = (page - 1) * limit;

  type FilterVal = { _eq?: string } | { _icontains?: string } | Array<Record<string, { _icontains: string }>>;
  const filters: Record<string, FilterVal> = {};
  if (params.status) filters.status = { _eq: params.status };
  if (params.search) {
    filters._or = [
      { transaction_no: { _icontains: params.search } },
      { customer_code: { _icontains: params.search } },
    ];
  }
  filters["site.billing_mode"] = { _eq: "KILO" };

  let qs = `fields=*,customer.customer_name,site.site_name,wiwo_header.wiwo_no&sort=-transaction_date&limit=${limit}&offset=${offset}&meta=total_count`;
  if (Object.keys(filters).length > 0) {
    qs += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
  }

  const res = await directusFetch<{ data: Record<string, unknown>[]; meta?: { total_count: number } }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?${qs}`
  );

  const mappedData = (res.data ?? []).map((invoice) => {
    const mapped = {
      ...invoice,
      invoice_no: invoice.transaction_no as string,
      invoice_date: invoice.transaction_date as string,
    } as unknown as KiloBillingInvoice;
    if (mapped.wiwo_header) {
      mapped.wiwo_header = mapWiwoHeader(mapped.wiwo_header);
    }
    return mapped;
  });

  return { data: mappedData, total: res.meta?.total_count ?? 0 };
}

export async function fetchInvoiceById(id: number): Promise<KiloBillingInvoice | null> {
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}?fields=*,customer.customer_name,site.site_name,wiwo_header.wiwo_no,wiwo_header.wiwo_status`
  );
  if (!res.data) return null;
  const mapped = {
    ...res.data,
    invoice_no: res.data.transaction_no as string,
    invoice_date: res.data.transaction_date as string,
  } as unknown as KiloBillingInvoice;
  if (mapped.wiwo_header) {
    mapped.wiwo_header = mapWiwoHeader(mapped.wiwo_header);
  }
  return mapped;
}

export async function createInvoice(payload: Partial<KiloBillingInvoice>): Promise<KiloBillingInvoice> {
  const dbPayload = {
    transaction_no: payload.invoice_no,
    transaction_date: payload.invoice_date,
    transaction_type: "REGULAR_BILLING",
    lpg_site_id: payload.lpg_site_id,
    customer_code: payload.customer_code,
    wiwo_header_id: payload.wiwo_header_id,
    meter_reading_id: null,
    metered_kg: 0,
    wiwo_kg: payload.billable_kg,
    variance_kg: 0,
    billable_source: "WIWO",
    billable_kg: payload.billable_kg,
    price_per_kg: payload.price_per_kg,
    gross_amount: payload.gross_amount,
    vat_amount: payload.vat_amount,
    net_amount: payload.net_amount,
    status: payload.status,
    remarks: payload.remarks,
    created_by: payload.created_by,
  };

  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions`,
    {
      method: "POST",
      body: JSON.stringify(dbPayload),
    }
  );

  if (payload.status === "POSTED" && payload.wiwo_header_id) {
    await directusFetch(`${DIRECTUS_URL}/items/lpg_wiwo_headers/${payload.wiwo_header_id}`, {
      method: "PATCH",
      body: JSON.stringify({ wiwo_status: "BILLED" })
    });
  }

  const mapped = {
    ...res.data,
    invoice_no: res.data.transaction_no as string,
    invoice_date: res.data.transaction_date as string,
  } as unknown as KiloBillingInvoice;
  return mapped;
}

export async function updateInvoice(id: number, payload: Partial<KiloBillingInvoice>): Promise<KiloBillingInvoice> {
  const dbPayload: Record<string, unknown> = { ...payload } as Record<string, unknown>;
  if (payload.invoice_no !== undefined) {
    dbPayload.transaction_no = payload.invoice_no;
    delete dbPayload.invoice_no;
  }
  if (payload.invoice_date !== undefined) {
    dbPayload.transaction_date = payload.invoice_date;
    delete dbPayload.invoice_date;
  }
  if (payload.billable_kg !== undefined) {
    dbPayload.wiwo_kg = payload.billable_kg;
    dbPayload.billable_kg = payload.billable_kg;
  }

  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(dbPayload),
    }
  );

  if (payload.status === "POSTED") {
    let wiwoHeaderId = payload.wiwo_header_id;
    if (!wiwoHeaderId) {
      wiwoHeaderId = res.data?.wiwo_header_id as number | undefined;
    }
    if (wiwoHeaderId) {
      await directusFetch(`${DIRECTUS_URL}/items/lpg_wiwo_headers/${wiwoHeaderId}`, {
        method: "PATCH",
        body: JSON.stringify({ wiwo_status: "BILLED" })
      });
    }
  }

  const mapped = {
    ...res.data,
    invoice_no: res.data.transaction_no as string,
    invoice_date: res.data.transaction_date as string,
  } as unknown as KiloBillingInvoice;
  return mapped;
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export async function fetchCustomers(): Promise<{ customer_code: string; customer_name: string }[]> {
  const res = await directusFetch<{ data: { customer_code: string; customer_name: string }[] }>(
    `${DIRECTUS_URL}/items/customer?fields=customer_code,customer_name&filter[isActive][_eq]=1&limit=-1&sort=customer_name`
  );
  return res.data ?? [];
}

export async function fetchKiloSites(): Promise<unknown[]> {
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_customer_lpg_sites?fields=id,site_name,customer_code,default_price_per_kg&filter[is_active][_eq]=1&filter[billing_mode][_eq]=KILO&sort=site_name&limit=-1`
  );
  return res.data ?? [];
}

export async function fetchSiteCylinders(siteId: number): Promise<unknown[]> {
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_customer_site_cylinders?filter[lpg_site_id][_eq]=${siteId}&filter[site_cylinder_status][_eq]=CONNECTED&fields=*,cylinder_asset_id.*,cylinder_asset_id.product.*`
  );
  return res.data ?? [];
}

export async function fetchAvailableCylinders(productId?: number): Promise<unknown[]> {
  let qs = "fields=id,serial_number,tare_weight,product_id,product.product_name,product.unit_of_measurement_count&filter[cylinder_status][_eq]=AVAILABLE&limit=100";
  if (productId) qs += `&filter[product_id][_eq]=${productId}`;
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/cylinder_assets?${qs}`
  );
  return res.data ?? [];
}

export async function createWiwoTransaction(payload: Record<string, unknown>): Promise<unknown> {
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_wiwo_headers`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return res.data;
}

export async function createReplacementSO(
  siteId: number,
  customerCode: string,
  items: { product_id: number; quantity: number }[]
): Promise<unknown> {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const orderNo = `SO-REPL-${Date.now().toString().slice(-6)}`;
  
  const headerPayload = {
    order_no: orderNo,
    customer_code: customerCode,
    branch_id: 1,
    order_date: dateStr,
    order_status: "Pending",
    remarks: `Auto-generated replacement for KILO Billing`,
    total_amount: 0,
    discount_amount: 0,
    net_amount: 0,
    allocated_amount: 0,
  };
  
  const soRes = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/sales_order`,
    {
      method: "POST",
      body: JSON.stringify(headerPayload)
    }
  );
  
  const salesOrder = soRes.data;
  if (!salesOrder || typeof salesOrder !== "object" || !("order_id" in salesOrder)) return salesOrder;
  const orderId = salesOrder.order_id;
  
  const detailsPayload = items.map(item => ({
    order_id: orderId,
    product_id: item.product_id,
    unit_price: 0,
    ordered_quantity: item.quantity,
    quantity: item.quantity,
    allocated_quantity: item.quantity,
    served_quantity: 0,
    gross_amount: 0,
    net_amount: 0,
    allocated_amount: 0,
    remarks: "Replacement swap"
  }));
  
  await directusFetch(
    `${DIRECTUS_URL}/items/sales_order_details`,
    {
      method: "POST",
      body: JSON.stringify(detailsPayload)
    }
  );
  
  return salesOrder;
}

export async function deployCylinders(
  siteId: number,
  customerCode: string,
  cylinders: { cylinder_asset_id: number; product_id: number; capacity: number }[]
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  for (const cyl of cylinders) {
    await directusFetch(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders`, {
      method: "POST",
      body: JSON.stringify({
        lpg_site_id: siteId,
        customer_code: customerCode,
        cylinder_asset_id: cyl.cylinder_asset_id,
        site_cylinder_status: "CONNECTED",
        opening_lpg_kg: cyl.capacity || 50, // default
        current_estimated_lpg_kg: cyl.capacity || 50,
        installed_date: today
      })
    });
    
    await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets/${cyl.cylinder_asset_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cylinder_status: "WITH_CUSTOMER",
        current_customer_code: customerCode
      })
    });
  }
}

export async function returnCylinders(
  siteCylinderIds: number[],
  assetIds: number[]
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  
  for (let i = 0; i < siteCylinderIds.length; i++) {
    const scId = siteCylinderIds[i];
    const assetId = assetIds[i];
    
    if (scId) {
      await directusFetch(`${DIRECTUS_URL}/items/lpg_customer_site_cylinders/${scId}`, {
        method: "PATCH",
        body: JSON.stringify({
          site_cylinder_status: "RETURNED",
          removed_date: today
        })
      });
    }
    
    if (assetId) {
      await directusFetch(`${DIRECTUS_URL}/items/cylinder_assets/${assetId}`, {
        method: "PATCH",
        body: JSON.stringify({
          cylinder_status: "EMPTY",
          current_customer_code: null
        })
      });
    }
  }
}
