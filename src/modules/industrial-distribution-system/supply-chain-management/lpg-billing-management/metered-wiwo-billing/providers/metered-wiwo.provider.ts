import {
  directusFetch,
  getDirectusBase,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/directus";
import type {
  MeteredWiwoTransaction,
  MeteredListParams,
  MeterReading,
  WiwoHeaderRef,
} from "../types";

const DIRECTUS_URL = getDirectusBase();
const FIELDS_TX =
  "*,customer.customer_name,customer.store_name,site.id,site.site_name,site.site_address,lpg_site_id.id,lpg_site_id.site_name,lpg_site_id.site_address," +
  "meter_reading_id.id,meter_reading_id.lpg_site_id,meter_reading_id.previous_reading,meter_reading_id.current_reading,meter_reading_id.kg_consumed,meter_reading_id.price_per_kg,meter_reading_id.reading_date," +
  "wiwo_header_id.id,wiwo_header_id.wiwo_no,wiwo_header_id.transaction_date";

function mapMeteredTransaction(tx: unknown): MeteredWiwoTransaction {
  if (!tx) return tx as MeteredWiwoTransaction;
  const raw = tx as Record<string, unknown>;
  const mapped = { ...raw } as unknown as MeteredWiwoTransaction;

  let siteObj: Record<string, unknown> | null = null;
  if (raw["site"] && typeof raw["site"] === "object") {
    siteObj = raw["site"] as Record<string, unknown>;
  } else if (raw["lpg_site_id"] && typeof raw["lpg_site_id"] === "object") {
    siteObj = raw["lpg_site_id"] as Record<string, unknown>;
  }

  let siteId = raw["lpg_site_id"] && typeof raw["lpg_site_id"] !== "object" ? Number(raw["lpg_site_id"]) : null;
  if (siteObj && siteObj.id) {
    siteId = Number(siteObj.id);
  }

  mapped.lpg_site_id = siteId;
  if (siteObj) {
    mapped.site = {
      id: siteObj.id ? Number(siteObj.id) : undefined,
      site_name: siteObj.site_name ? String(siteObj.site_name) : null,
      site_address: siteObj.site_address ? String(siteObj.site_address) : null,
    };
  }

  if (raw["meter_reading_id"] && typeof raw["meter_reading_id"] === "object") {
    mapped.meter_reading = raw["meter_reading_id"] as unknown as MeterReading;
  }

  if (raw["wiwo_header_id"] && typeof raw["wiwo_header_id"] === "object") {
    const rawHeader = raw["wiwo_header_id"] as Record<string, unknown>;
    mapped.wiwo_header = {
      ...rawHeader,
      transaction_no: (rawHeader["wiwo_no"] ?? rawHeader["transaction_no"]) as string,
      status: (rawHeader["wiwo_status"] ?? rawHeader["status"]) as string,
    } as unknown as WiwoHeaderRef;
  }

  return mapped;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function fetchMeteredTransactions(params: MeteredListParams): Promise<{
  data: MeteredWiwoTransaction[];
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

  let qs = `fields=${FIELDS_TX}&sort=-modified_date,-created_date&limit=${limit}&offset=${offset}&meta=total_count`;
  if (Object.keys(filters).length > 0) {
    qs += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
  }

  const res = await directusFetch<{ data: Record<string, unknown>[]; meta?: { total_count: number } }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?${qs}`
  );
  return { data: (res.data ?? []).map(mapMeteredTransaction), total: res.meta?.total_count ?? 0 };
}

export async function fetchMeteredTransactionById(id: number): Promise<MeteredWiwoTransaction | null> {
  const detailFields =
    `${FIELDS_TX},wiwo_header.details.id,wiwo_header.details.serial_number,` +
    `wiwo_header.details.opening_lpg_kg,wiwo_header.details.gross_weight,wiwo_header.details.tare_weight`;
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}?fields=${detailFields}`
  );
  return mapMeteredTransaction(res.data) ?? null;
}

async function createOrUpdateMeterReading(
  siteId: number,
  customerCode: string,
  readingDate: string,
  prevReading: number,
  currReading: number,
  meteredKg: number,
  pricePerKg: number,
  status: string,
  userId?: number,
  readingId?: number | null,
): Promise<number> {
  const rawConsumption = Math.max(0, currReading - prevReading);
  const data = {
    lpg_site_id: siteId,
    customer_code: customerCode,
    reading_date: readingDate,
    previous_reading: prevReading,
    current_reading: currReading,
    kg_consumed: meteredKg,
    price_per_kg: pricePerKg,
    raw_consumption: rawConsumption,
    reading_status: status,
    ...(userId ? { created_by: userId } : {})
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

  if (payload.lpg_site_id && payloadRecord.previous_reading !== undefined && payloadRecord.current_reading !== undefined) {
    readingId = await createOrUpdateMeterReading(
      payload.lpg_site_id,
      String(payloadRecord.customer_code ?? ""),
      payload.transaction_date || new Date().toISOString().split('T')[0],
      Number(payloadRecord.previous_reading ?? 0),
      Number(payloadRecord.current_reading ?? 0),
      Number(payload.metered_kg ?? 0),
      Number(payload.price_per_kg ?? 0),
      payload.status || "DRAFT",
      payload.created_by ?? undefined,
      payload.meter_reading_id,
    );
  }

  const dbPayload = { ...payloadRecord };
  delete dbPayload.previous_reading;
  delete dbPayload.current_reading;
  // Omit custom pressure properties which do not exist in directus schema
  delete dbPayload.pressure_line;
  delete dbPayload.psi;
  delete dbPayload.atmospheric_pressure;
  delete dbPayload.lpg_vapor_factor;

  const res = await directusFetch<{ data: MeteredWiwoTransaction }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions`,
    {
      method: "POST",
      body: JSON.stringify({
        ...dbPayload,
        meter_reading_id: readingId,
      }),
    }
  );
  return res.data;
}

export async function updateMeteredTransaction(
  id: number,
  payload: Partial<MeteredWiwoTransaction>
): Promise<MeteredWiwoTransaction> {
  const payloadRecord = payload as unknown as Record<string, unknown>;
  let readingId = payload.meter_reading_id;

  if (payload.lpg_site_id && payloadRecord.previous_reading !== undefined && payloadRecord.current_reading !== undefined) {
    readingId = await createOrUpdateMeterReading(
      payload.lpg_site_id,
      String(payloadRecord.customer_code ?? ""),
      payload.transaction_date || new Date().toISOString().split('T')[0],
      Number(payloadRecord.previous_reading ?? 0),
      Number(payloadRecord.current_reading ?? 0),
      Number(payload.metered_kg ?? 0),
      Number(payload.price_per_kg ?? 0),
      payload.status || "DRAFT",
      payloadRecord.modified_by as number | undefined,
      payload.meter_reading_id,
    );
  }

  const dbPayload = { ...payloadRecord };
  delete dbPayload.previous_reading;
  delete dbPayload.current_reading;
  // Omit custom pressure properties which do not exist in directus schema
  delete dbPayload.pressure_line;
  delete dbPayload.psi;
  delete dbPayload.atmospheric_pressure;
  delete dbPayload.lpg_vapor_factor;

  const res = await directusFetch<{ data: MeteredWiwoTransaction }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...dbPayload,
        meter_reading_id: readingId,
      }),
    }
  );
  return res.data;
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

