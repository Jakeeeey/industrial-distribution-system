import {
  directusFetch,
  getDirectusBase,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/directus";
import type {
  MeteredWiwoTransaction,
  MeteredListParams,
  TransactionStatus,
} from "../types";

const DIRECTUS_URL = getDirectusBase();

function mapMeterReadingToTransaction(mr: unknown): MeteredWiwoTransaction {
  if (!mr) return mr as MeteredWiwoTransaction;
  const raw = mr as Record<string, unknown>;

  const siteObj = raw["lpg_site_id"] && typeof raw["lpg_site_id"] === "object"
    ? (raw["lpg_site_id"] as Record<string, unknown>)
    : null;
  const siteId = siteObj ? Number(siteObj.id) : (raw["lpg_site_id"] ? Number(raw["lpg_site_id"]) : null);

  const kgConsumed = Number(raw["kg_consumed"] ?? 0);
  const pricePerKg = Number(raw["price_per_kg"] ?? 0);
  const gross = kgConsumed * pricePerKg;

  const tx: MeteredWiwoTransaction = {
    id: Number(raw["id"]),
    reading_no: raw["reading_no"] ? String(raw["reading_no"]) : "-",
    transaction_date: String(raw["reading_date"] ?? ""),
    customer_code: String(raw["customer_code"] ?? ""),
    lpg_site_id: siteId,
    meter_reading_id: Number(raw["id"]),
    wiwo_header_id: null,
    metered_kg: kgConsumed,
    wiwo_kg: 0,
    variance_kg: 0,
    billable_source: "METERED",
    billable_kg: kgConsumed,
    price_per_kg: pricePerKg,
    gross_amount: Number(raw["gross_amount"] ?? gross),
    vat_amount: Number(raw["vat_amount"] ?? 0),
    net_amount: Number(raw["net_amount"] ?? gross),
    discount_amount: raw["discount_amount"] ? Number(raw["discount_amount"]) : 0.0,
    sales_invoice_id: raw["sales_invoice_id"] ? Number(raw["sales_invoice_id"]) : null,
    sales_invoice_no: raw["sales_invoice_no"] ? String(raw["sales_invoice_no"]) : null,
    status: (raw["reading_status"] ?? "DRAFT") as TransactionStatus,
    remarks: raw["remarks"] ? String(raw["remarks"]) : "",
    pressure_line: raw["pressure_line"] ? Number(raw["pressure_line"]) : 1.0,
    psi: raw["psi"] ? Number(raw["psi"]) : 0.0,
    atmospheric_pressure: raw["atmospheric_pressure"] ? Number(raw["atmospheric_pressure"]) : 14.7,
    lpg_vapor_factor: raw["lpg_vapor_factor"] ? Number(raw["lpg_vapor_factor"]) : 1.0,
    meter_unit: raw["meter_unit"] as "M3" | "LITER" | "KG" | "UNIT",
    meter_direction: raw["meter_direction"] as "INCREASING" | "DECREASING",
    conversion_factor: raw["conversion_factor"] ? Number(raw["conversion_factor"]) : 1.0,
    billing_period_from: raw["billing_period_from"] ? String(raw["billing_period_from"]) : null,
    billing_period_to: raw["billing_period_to"] ? String(raw["billing_period_to"]) : null,
    posted_by: raw["posted_by"] ? Number(raw["posted_by"]) : null,
    posted_date: raw["posted_date"] ? String(raw["posted_date"]) : null,
    cancelled_by: raw["cancelled_by"] ? Number(raw["cancelled_by"]) : null,
    cancelled_date: raw["cancelled_date"] ? String(raw["cancelled_date"]) : null,
    cancelled_reason: raw["cancelled_reason"] ? String(raw["cancelled_reason"]) : null,
    created_by: raw["created_by"] ? Number(raw["created_by"]) : null,
    created_date: raw["created_date"] ? String(raw["created_date"]) : null,
    modified_by: raw["modified_by"] ? Number(raw["modified_by"]) : null,
    modified_date: raw["modified_date"] ? String(raw["modified_date"]) : null,
    site: siteObj ? {
      id: Number(siteObj.id),
      site_name: siteObj.site_name ? String(siteObj.site_name) : null,
      site_address: siteObj.site_address ? String(siteObj.site_address) : null,
    } : undefined,
    meter_reading: {
      id: Number(raw["id"]),
      lpg_site_id: siteId ?? 0,
      reading_date: String(raw["reading_date"] ?? ""),
      previous_reading: Number(raw["previous_reading"] ?? 0),
      current_reading: Number(raw["current_reading"] ?? 0),
      raw_consumption: Number(raw["raw_consumption"] ?? 0),
      kg_consumed: kgConsumed,
      price_per_kg: pricePerKg,
      created_by: raw["created_by"] ? Number(raw["created_by"]) : null,
      created_date: raw["created_date"] ? String(raw["created_date"]) : null,
    }
  };

  return tx;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function fetchMeterReadingSeqNo(
  customerCode: string,
  date: string,
  id: number
): Promise<number> {
  if (!customerCode || !date) return 1;
  const filter = {
    customer_code: { _eq: customerCode },
    reading_date: { _eq: date },
    id: { _lte: id }
  };
  const qs = `filter=${encodeURIComponent(JSON.stringify(filter))}&limit=0&meta=total_count`;
  try {
    const res = await directusFetch<{ meta?: { total_count: number } }>(
      `${DIRECTUS_URL}/items/lpg_meter_readings?${qs}`
    );
    return res.meta?.total_count ?? 1;
  } catch (err) {
    console.error("fetchMeterReadingSeqNo failed:", err);
    return 1;
  }
}

export async function fetchNextMeterReadingSeq(
  customerCode: string,
  date: string
): Promise<number> {
  if (!customerCode || !date) return 1;
  const filter = {
    customer_code: { _eq: customerCode },
    reading_date: { _eq: date }
  };
  const qs = `filter=${encodeURIComponent(JSON.stringify(filter))}&limit=0&meta=total_count`;
  try {
    const res = await directusFetch<{ meta?: { total_count: number } }>(
      `${DIRECTUS_URL}/items/lpg_meter_readings?${qs}`
    );
    return (res.meta?.total_count ?? 0) + 1;
  } catch (err) {
    console.error("fetchNextMeterReadingSeq failed:", err);
    return 1;
  }
}

export async function fetchMeteredTransactions(params: MeteredListParams): Promise<{
  data: MeteredWiwoTransaction[];
  total: number;
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const offset = (page - 1) * limit;

  const filters: Record<string, unknown> = {};
  if (params.status) filters.reading_status = { _eq: params.status };
  if (params.search) {
    filters._or = [
      { customer_code: { _icontains: params.search } },
      { lpg_site_id: { site_name: { _icontains: params.search } } },
    ];
  }

  let qs = `fields=*,lpg_site_id.id,lpg_site_id.site_name,lpg_site_id.site_address&sort=-modified_date&limit=${limit}&offset=${offset}&meta=total_count`;
  if (Object.keys(filters).length > 0) {
    qs += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
  }

  const res = await directusFetch<{ data: Record<string, unknown>[]; meta?: { total_count: number } }>(
    `${DIRECTUS_URL}/items/lpg_meter_readings?${qs}`
  );

  const mapped = (res.data ?? []).map((raw) => mapMeterReadingToTransaction(raw));

  return { data: mapped, total: res.meta?.total_count ?? 0 };
}

export async function fetchMeteredTransactionById(id: number): Promise<MeteredWiwoTransaction | null> {
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_meter_readings/${id}?fields=*,lpg_site_id.id,lpg_site_id.site_name,lpg_site_id.site_address`
  );
  if (!res.data) return null;
  return mapMeterReadingToTransaction(res.data);
}

async function createOrUpdateMeterReading(
  payload: Partial<MeteredWiwoTransaction>,
  userId?: number,
  readingId?: number | null,
): Promise<number> {
  const raw = payload as Record<string, unknown>;
  const prevReading = Number(raw.previous_reading ?? 0);
  const currReading = Number(raw.current_reading ?? 0);
  const rawConsumption = Math.max(0, currReading - prevReading);

  const data = {
    lpg_site_id: payload.lpg_site_id,
    customer_code: payload.customer_code,
    reading_date: payload.transaction_date || new Date().toISOString().split('T')[0],
    previous_reading: prevReading,
    current_reading: currReading,
    kg_consumed: payload.metered_kg ?? payload.billable_kg ?? 0,
    price_per_kg: payload.price_per_kg ?? 0,
    raw_consumption: rawConsumption,
    reading_status: payload.status || "DRAFT",
    reading_no: payload.reading_no,
    
    // Additional fields from lpg_meter_readings
    billing_period_from: payload.billing_period_from || null,
    billing_period_to: payload.billing_period_to || null,
    meter_unit: payload.meter_unit || "KG",
    meter_direction: payload.meter_direction || "INCREASING",
    conversion_factor: payload.conversion_factor ?? 1.000000,
    pressure_line: payload.pressure_line ?? 1.000000,
    psi: payload.psi ?? 0.0000,
    atmospheric_pressure: payload.atmospheric_pressure ?? 14.7000,
    lpg_vapor_factor: payload.lpg_vapor_factor ?? 1.000000,
    gross_amount: payload.gross_amount ?? 0,
    discount_amount: payload.discount_amount ?? 0,
    vat_amount: payload.vat_amount ?? 0,
    net_amount: payload.net_amount ?? 0,
    sales_invoice_id: payload.sales_invoice_id || null,
    sales_invoice_no: payload.sales_invoice_no || null,
    remarks: payload.remarks || "",
    
    // User / status logs
    ...(userId ? (payload.status === "POSTED" ? { posted_by: userId, posted_date: new Date().toISOString() } : {}) : {}),
    ...(userId ? (payload.status === "CANCELLED" ? { cancelled_by: userId, cancelled_date: new Date().toISOString() } : {}) : {}),
    ...(userId && !readingId ? {
      created_by: userId,
      created_date: new Date().toISOString(),
      modified_by: userId,
      modified_date: new Date().toISOString()
    } : {}),
    ...(userId && readingId ? {
      modified_by: userId,
      modified_date: new Date().toISOString()
    } : {}),
  };

  if (readingId) {
    await directusFetch(
      `${DIRECTUS_URL}/items/lpg_meter_readings/${readingId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      }
    );
    return readingId;
  } else {
    const res = await directusFetch<{ data: { id: number } }>(
      `${DIRECTUS_URL}/items/lpg_meter_readings`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return res.data.id;
  }
}

export async function createMeteredTransaction(
  payload: Partial<MeteredWiwoTransaction>
): Promise<MeteredWiwoTransaction> {
  const payloadRecord = payload as unknown as Record<string, unknown>;
  let readingId = payload.meter_reading_id;

  console.log("[createMeteredTransaction] payload:", JSON.stringify(payload));

  if (payload.lpg_site_id && payloadRecord.previous_reading !== undefined && payloadRecord.current_reading !== undefined) {
    console.log("[createMeteredTransaction] calling createOrUpdateMeterReading");
    readingId = await createOrUpdateMeterReading(
      payload,
      payload.created_by ?? undefined,
      payload.meter_reading_id,
    );
    console.log("[createMeteredTransaction] createOrUpdateMeterReading returned readingId:", readingId);
  } else {
    console.log("[createMeteredTransaction] condition not met for createOrUpdateMeterReading. lpg_site_id:", payload.lpg_site_id, "prev:", payloadRecord.previous_reading, "curr:", payloadRecord.current_reading);
  }

  let reading_no = payload.reading_no;
  if (readingId) {
    const customerCode = String(payloadRecord.customer_code ?? "");
    const readingDate = payload.transaction_date || new Date().toISOString().split('T')[0];
    const seq = await fetchMeterReadingSeqNo(customerCode, readingDate, readingId);
    const dateStr = readingDate.replace(/-/g, "").slice(0, 8);
    const sId = payload.lpg_site_id ?? 0;
    const seqStr = String(seq).padStart(3, "0");
    reading_no = `MTR-${dateStr}${sId}${seqStr}`;
  }

  return {
    ...payload,
    reading_no,
    meter_reading_id: readingId,
  } as unknown as MeteredWiwoTransaction;
}

export async function updateMeteredTransaction(
  id: number,
  payload: Partial<MeteredWiwoTransaction>
): Promise<MeteredWiwoTransaction> {
  const payloadRecord = payload as unknown as Record<string, unknown>;
  let readingId = payload.meter_reading_id;

  console.log("[updateMeteredTransaction] payload:", JSON.stringify(payload));

  if (payload.lpg_site_id && payloadRecord.previous_reading !== undefined && payloadRecord.current_reading !== undefined) {
    console.log("[updateMeteredTransaction] calling createOrUpdateMeterReading");
    readingId = await createOrUpdateMeterReading(
      payload,
      payloadRecord.modified_by as number | undefined,
      payload.meter_reading_id || id,
    );
    console.log("[updateMeteredTransaction] createOrUpdateMeterReading returned readingId:", readingId);
  } else {
    console.log("[updateMeteredTransaction] condition not met for createOrUpdateMeterReading. lpg_site_id:", payload.lpg_site_id, "prev:", payloadRecord.previous_reading, "curr:", payloadRecord.current_reading);
  }

  let reading_no = payload.reading_no;
  if (readingId) {
    const customerCode = String(payloadRecord.customer_code ?? "");
    const readingDate = payload.transaction_date || new Date().toISOString().split('T')[0];
    const seq = await fetchMeterReadingSeqNo(customerCode, readingDate, readingId);
    const dateStr = readingDate.replace(/-/g, "").slice(0, 8);
    const sId = payload.lpg_site_id ?? 0;
    const seqStr = String(seq).padStart(3, "0");
    reading_no = `MTR-${dateStr}${sId}${seqStr}`;
  }

  return {
    id,
    ...payload,
    reading_no,
    meter_reading_id: readingId,
  } as unknown as MeteredWiwoTransaction;
}

// ─── Meter Readings lookup ────────────────────────────────────────────────────

export async function fetchMeterReadings(siteId?: number): Promise<
  { id: number; reading_date: string; previous_reading: number; current_reading: number; kg_consumed: number; price_per_kg: number }[]
> {
  let qs = "fields=id,reading_date,previous_reading,current_reading,kg_consumed,price_per_kg&sort=-reading_date&limit=50";
  if (siteId) qs += `&filter[lpg_site_id][_eq]=${siteId}`;
  const res = await directusFetch<{
    data: { id: number; reading_date: string; previous_reading: number; current_reading: number; kg_consumed: number; price_per_kg: number }[];
  }>(`${DIRECTUS_URL}/items/lpg_meter_readings?${qs}`);
  return res.data ?? [];
}

// ─── WIWO Headers lookup (for pairing) ───────────────────────────────────────

export async function fetchUnbilledWiwoHeaders(
  customerCode?: string,
  siteId?: number
): Promise<{ id: number; transaction_no: string; transaction_date: string; total_wiwo_kg?: number }[]> {
  let qs = "fields=id,wiwo_no,transaction_date&filter[wiwo_status][_eq]=PENDING&sort=-transaction_date&limit=50";
  if (customerCode) qs += `&filter[customer_code][_eq]=${encodeURIComponent(customerCode)}`;
  if (siteId) qs += `&filter[lpg_site_id][_eq]=${siteId}`;
  const res = await directusFetch<{
    data: { id: number; wiwo_no?: string; transaction_no?: string; transaction_date: string }[];
  }>(`${DIRECTUS_URL}/items/lpg_wiwo_headers?${qs}`);
  
  const mapped = (res.data ?? []).map(item => ({
    id: item.id,
    transaction_no: item.wiwo_no ?? item.transaction_no ?? "",
    transaction_date: item.transaction_date,
  }));
  
  return mapped;
}

// ─── Sites lookup ─────────────────────────────────────────────────────────────

export async function fetchMeteredSites(): Promise<
  {
    id: number;
    site_name: string | null;
    customer_code: string;
    default_price_per_kg: number;
    meter_unit?: string | null;
    meter_direction?: "INCREASING" | "DECREASING" | null;
    conversion_factor?: number | null;
    default_pressure_line?: number | null;
    default_psi?: number | null;
    default_atmospheric_pressure?: number | null;
    psi?: number | null;
    last_meter_reading?: number | null;
    billing_mode?: string | null;
  }[]
> {
  const res = await directusFetch<{
    data: Record<string, unknown>[];
  }>(
    `${DIRECTUS_URL}/items/lpg_customer_lpg_sites?fields=id,site_name,customer_code,default_price_per_kg,meter_unit,meter_direction,conversion_factor,last_meter_reading,billing_mode&filter[is_active][_eq]=1&filter[billing_mode][_in]=METERED,BOTH&sort=site_name&limit=-1`
  );
  return (res.data ?? []).map((site) => ({
    ...site,
    default_pressure_line: site.default_pressure_line !== undefined && site.default_pressure_line !== null ? Number(site.default_pressure_line) : 2.0183,
    default_psi: site.default_psi !== undefined && site.default_psi !== null ? Number(site.default_psi) : 10.0,
    default_atmospheric_pressure: site.default_atmospheric_pressure !== undefined && site.default_atmospheric_pressure !== null ? Number(site.default_atmospheric_pressure) : 14.7,
  })) as unknown as {
    id: number;
    site_name: string | null;
    customer_code: string;
    default_price_per_kg: number;
    meter_unit?: string | null;
    meter_direction?: "INCREASING" | "DECREASING" | null;
    conversion_factor?: number | null;
    default_pressure_line?: number | null;
    default_psi?: number | null;
    default_atmospheric_pressure?: number | null;
    psi?: number | null;
    last_meter_reading?: number | null;
    billing_mode?: string | null;
  }[];
}

export async function updateSiteReading(
  siteId: number,
  lastReading: number,
  readingDate: string
): Promise<unknown> {
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_customer_lpg_sites/${siteId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        last_meter_reading: lastReading,
        last_reading_date: readingDate,
      })
    }
  );
  return res.data;
}

