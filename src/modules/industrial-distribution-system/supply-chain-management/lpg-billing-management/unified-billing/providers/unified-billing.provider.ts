import {
  directusFetch,
  getDirectusBase,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/directus";
import type {
  LpgSite,
  CylinderAsset,
  CustomerSiteCylinder,
  WiwoHeader,
  UnifiedBillingTransaction,
  UnifiedBillingListParams,
  ArbitrationResult,
  BillingMode,
  VarianceReasonCode,
} from "../types";

const DIRECTUS_URL = getDirectusBase();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const TX_FIELDS =
  "*," +
  "customer.customer_code," +
  "customer.customer_name," +
  "site.id,site.site_name,site.default_price_per_kg,site.billing_mode";

// ─── Arbitration Engine ───────────────────────────────────────────────────────

export function computeArbitration(
  billingMode: BillingMode,
  meteredKg: number,
  wiwoKg: number
): ArbitrationResult {
  if (billingMode === "BOTH") {
    const varianceKg = round2(Math.abs(meteredKg - wiwoKg));
    const billableKg = round2(Math.max(meteredKg, wiwoKg));
    const billableSource = meteredKg >= wiwoKg ? "METERED" : "WIWO";
    return { meteredKg, wiwoKg, varianceKg, billableKg, billableSource };
  }

  // KILO track — WIWO weight is authoritative
  return {
    meteredKg: 0,
    wiwoKg,
    varianceKg: 0,
    billableKg: round2(wiwoKg),
    billableSource: "WIWO",
  };
}

export function computeAmounts(
  billableKg: number,
  pricePerKg: number,
  vatRate = 0.12
): { grossAmount: number; vatAmount: number; netAmount: number } {
  const grossAmount = round2(billableKg * pricePerKg);
  const vatAmount = round2(grossAmount * vatRate);
  const netAmount = round2(grossAmount + vatAmount);
  return { grossAmount, vatAmount, netAmount };
}

// ─── Site Lookups ─────────────────────────────────────────────────────────────

export async function fetchAllActiveSites(): Promise<LpgSite[]> {
  const fields =
    "id,site_name,customer_code,billing_mode,default_price_per_kg,default_target_lpg_kg," +
    "last_meter_reading,last_reading_date,meter_no,meter_unit,conversion_factor," +
    "customer.customer_code,customer.customer_name";
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_customer_lpg_sites?fields=${fields}&filter[is_active][_eq]=1&sort=site_name&limit=-1`
  );
  return (res.data ?? []) as unknown as LpgSite[];
}

export async function fetchSiteById(siteId: number): Promise<LpgSite | null> {
  const fields =
    "id,site_name,customer_code,billing_mode,default_price_per_kg,default_target_lpg_kg," +
    "last_meter_reading,last_reading_date,meter_no,meter_unit,conversion_factor," +
    "customer.customer_code,customer.customer_name";
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_customer_lpg_sites/${siteId}?fields=${fields}`
  );
  return (res.data ?? null) as unknown as LpgSite | null;
}

// ─── Cylinder Lookups ─────────────────────────────────────────────────────────

export async function fetchActiveSiteCylinders(
  siteId: number
): Promise<CustomerSiteCylinder[]> {
  const fields =
    "id,lpg_site_id,customer_code,cylinder_asset_id,site_cylinder_status," +
    "previous_lpg_kg,current_lpg_kg,installed_date," +
    "cylinder_asset_id.id,cylinder_asset_id.serial_number,cylinder_asset_id.tare_weight," +
    "cylinder_asset_id.cylinder_status,cylinder_asset_id.cylinder_condition";
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_customer_site_cylinders?fields=${fields}` +
    `&filter[lpg_site_id][_eq]=${siteId}&filter[site_cylinder_status][_in]=CONNECTED,STANDBY&limit=-1`
  );
  return ((res.data ?? []) as Record<string, unknown>[]).map((raw) => {
    const asset = raw["cylinder_asset_id"] as Record<string, unknown> | null;
    return {
      ...raw,
      cylinder_asset_id: asset ? Number(asset["id"]) : raw["cylinder_asset_id"],
      cylinder_asset: asset
        ? {
          id: Number(asset["id"]),
          serial_number: String(asset["serial_number"] ?? ""),
          tare_weight: Number(asset["tare_weight"] ?? 0),
          cylinder_status: String(asset["cylinder_status"] ?? ""),
          cylinder_condition: String(asset["cylinder_condition"] ?? ""),
        }
        : undefined,
    } as unknown as CustomerSiteCylinder;
  });
}

export async function fetchAvailableCylinders(
  customerCode: string
): Promise<CylinderAsset[]> {
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_cylinder_assets` +
    `?fields=id,serial_number,tare_weight,cylinder_status,cylinder_condition` +
    `&filter[cylinder_status][_in]=AVAILABLE,REFILLED&filter[customer_code][_eq]=${encodeURIComponent(customerCode)}&limit=-1`
  );
  return (res.data ?? []) as unknown as CylinderAsset[];
}

// ─── Meter Readings ───────────────────────────────────────────────────────────

async function upsertMeterReading(params: {
  siteId: number;
  customerCode: string;
  readingDate: string;
  previousReading: number;
  currentReading: number;
  kgConsumed: number;
  pricePerKg: number;
  status: string;
  userId?: number | null;
  existingReadingId?: number | null;
}): Promise<number> {
  const rawConsumption = Math.max(0, params.currentReading - params.previousReading);
  const body = {
    lpg_site_id: params.siteId,
    customer_code: params.customerCode,
    reading_date: params.readingDate,
    previous_reading: params.previousReading,
    current_reading: params.currentReading,
    raw_consumption: rawConsumption,
    kg_consumed: params.kgConsumed,
    price_per_kg: params.pricePerKg,
    reading_status: params.status,
    ...(params.userId ? { created_by: params.userId } : {}),
  };

  if (params.existingReadingId) {
    await directusFetch(
      `${DIRECTUS_URL}/items/lpg_meter_readings/${params.existingReadingId}`,
      { method: "PATCH", body: JSON.stringify(body) }
    );
    return params.existingReadingId;
  }

  const res = await directusFetch<{ data: { id: number } }>(
    `${DIRECTUS_URL}/items/lpg_meter_readings`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data.id;
}

// ─── Transaction List ─────────────────────────────────────────────────────────

export async function fetchTransactions(params: UnifiedBillingListParams): Promise<{
  data: UnifiedBillingTransaction[];
  total: number;
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const offset = (page - 1) * limit;

  type FilterVal =
    | { _eq?: string }
    | { _icontains?: string }
    | { _in?: string[] }
    | Array<Record<string, { _icontains: string }>>;
  const filters: Record<string, FilterVal> = {};
  if (params.status) filters.status = { _eq: params.status };
  if (params.billingMode) filters.billing_mode = { _eq: params.billingMode };
  if (params.search) {
    filters._or = [
      { transaction_no: { _icontains: params.search } },
      { customer_code: { _icontains: params.search } },
    ] as Array<Record<string, { _icontains: string }>>;
  }

  let qs = `fields=${TX_FIELDS}&sort=-transaction_date&limit=${limit}&offset=${offset}&meta=total_count`;
  if (Object.keys(filters).length > 0) {
    qs += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
  }

  const res = await directusFetch<{
    data: Record<string, unknown>[];
    meta?: { total_count: number };
  }>(`${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?${qs}`);

  return {
    data: (res.data ?? []) as unknown as UnifiedBillingTransaction[],
    total: res.meta?.total_count ?? 0,
  };
}

export async function fetchTransactionById(
  id: number
): Promise<UnifiedBillingTransaction | null> {
  const detailFields =
    TX_FIELDS +
    ",wiwo_header_id.id,wiwo_header_id.wiwo_no,wiwo_header_id.wiwo_type,wiwo_header_id.transaction_date," +
    "wiwo_header_id.wiwo_status,wiwo_header_id.details.id,wiwo_header_id.details.line_type," +
    "wiwo_header_id.details.serial_number,wiwo_header_id.details.previous_lpg_kg," +
    "wiwo_header_id.details.returned_gross_weight_kg,wiwo_header_id.details.tare_weight_kg," +
    "wiwo_header_id.details.remaining_lpg_kg,wiwo_header_id.details.consumed_lpg_kg," +
    "wiwo_header_id.details.is_billable," +
    "meter_reading_id.id,meter_reading_id.reading_date,meter_reading_id.previous_reading," +
    "meter_reading_id.current_reading,meter_reading_id.raw_consumption,meter_reading_id.kg_consumed," +
    "meter_reading_id.price_per_kg";

  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}?fields=${detailFields}`
  );

  if (!res.data) return null;

  const raw = res.data;
  // Normalize wiwo_header_id object → wiwo_header_id_obj
  if (raw["wiwo_header_id"] && typeof raw["wiwo_header_id"] === "object") {
    raw["wiwo_header_id_obj"] = raw["wiwo_header_id"];
    const headerRaw = raw["wiwo_header_id"] as Record<string, unknown>;
    raw["wiwo_header_id"] = headerRaw["id"] ?? null;
  }
  if (raw["meter_reading_id"] && typeof raw["meter_reading_id"] === "object") {
    raw["meter_reading"] = raw["meter_reading_id"];
    const meterRaw = raw["meter_reading_id"] as Record<string, unknown>;
    raw["meter_reading_id"] = meterRaw["id"] ?? null;
  }

  return raw as unknown as UnifiedBillingTransaction;
}

// ─── Create Transaction ───────────────────────────────────────────────────────

export interface CreateTransactionPayload {
  transactionDate: string;
  customerCode: string;
  siteId: number;
  billingMode: BillingMode;
  pricePerKg: number;
  vatRate?: number;
  remarks?: string;
  userId?: number | null;

  // BOTH track only
  previousReading?: number;
  currentReading?: number;
  meteredKg?: number;
  conversionFactor?: number;

  // Wiwo header (provided after WIWO posting)
  wiwoHeaderId?: number | null;
  wiwoKg?: number;
  varianceReasonCode?: VarianceReasonCode;

  // Override billing amounts (optional)
  billableKg?: number;
  grossAmount?: number;
  vatAmount?: number;
  netAmount?: number;
}

export async function createUnifiedTransaction(
  payload: CreateTransactionPayload
): Promise<UnifiedBillingTransaction> {
  const billingMode = payload.billingMode;
  const meteredKg = billingMode === "BOTH" ? (payload.meteredKg ?? 0) : 0;
  const wiwoKg = payload.wiwoKg ?? 0;
  const vatRate = payload.vatRate ?? 0.12;

  const arb = computeArbitration(billingMode, meteredKg, wiwoKg);
  const amounts = computeAmounts(arb.billableKg, payload.pricePerKg, vatRate);

  // Upsert meter reading for BOTH track
  let meterReadingId: number | null = null;
  if (
    billingMode === "BOTH" &&
    payload.previousReading !== undefined &&
    payload.currentReading !== undefined
  ) {
    meterReadingId = await upsertMeterReading({
      siteId: payload.siteId,
      customerCode: payload.customerCode,
      readingDate: payload.transactionDate,
      previousReading: payload.previousReading,
      currentReading: payload.currentReading,
      kgConsumed: meteredKg,
      pricePerKg: payload.pricePerKg,
      status: "DRAFT",
      userId: payload.userId,
    });
  }

  const dbPayload = {
    transaction_date: payload.transactionDate,
    customer_code: payload.customerCode,
    lpg_site_id: payload.siteId,
    billing_mode: billingMode,
    meter_reading_id: meterReadingId,
    wiwo_header_id: payload.wiwoHeaderId ?? null,
    metered_kg: arb.meteredKg,
    wiwo_kg: arb.wiwoKg,
    variance_kg: arb.varianceKg,
    variance_reason_code: payload.varianceReasonCode ?? "NONE",
    billable_source: arb.billableSource,
    billable_kg: arb.billableKg,
    price_per_kg: payload.pricePerKg,
    gross_amount: payload.grossAmount ?? amounts.grossAmount,
    vat_amount: payload.vatAmount ?? amounts.vatAmount,
    net_amount: payload.netAmount ?? amounts.netAmount,
    sales_order_id: null,
    sales_invoice_id: null,
    status: "DRAFT",
    remarks: payload.remarks ?? null,
    created_by: payload.userId ?? null,
  };

  const res = await directusFetch<{ data: UnifiedBillingTransaction }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions`,
    { method: "POST", body: JSON.stringify(dbPayload) }
  );

  // Update site last meter reading for BOTH track
  if (billingMode === "BOTH" && payload.currentReading !== undefined) {
    await directusFetch(
      `${DIRECTUS_URL}/items/lpg_customer_lpg_sites/${payload.siteId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          last_meter_reading: payload.currentReading,
          last_reading_date: payload.transactionDate,
        }),
      }
    );
  }

  return res.data;
}

// ─── Update Transaction ───────────────────────────────────────────────────────

export async function updateUnifiedTransaction(
  id: number,
  payload: Partial<CreateTransactionPayload> & {
    existingReadingId?: number | null;
  }
): Promise<UnifiedBillingTransaction> {
  const billingMode = payload.billingMode ?? "KILO";
  const meteredKg = billingMode === "BOTH" ? (payload.meteredKg ?? 0) : 0;
  const wiwoKg = payload.wiwoKg ?? 0;
  const vatRate = payload.vatRate ?? 0.12;

  const arb = computeArbitration(billingMode, meteredKg, wiwoKg);
  const amounts = computeAmounts(arb.billableKg, payload.pricePerKg ?? 0, vatRate);

  let meterReadingId: number | null = payload.existingReadingId ?? null;
  if (
    billingMode === "BOTH" &&
    payload.previousReading !== undefined &&
    payload.currentReading !== undefined &&
    payload.siteId &&
    payload.customerCode
  ) {
    meterReadingId = await upsertMeterReading({
      siteId: payload.siteId,
      customerCode: payload.customerCode,
      readingDate: payload.transactionDate ?? new Date().toISOString().split("T")[0],
      previousReading: payload.previousReading,
      currentReading: payload.currentReading,
      kgConsumed: meteredKg,
      pricePerKg: payload.pricePerKg ?? 0,
      status: "DRAFT",
      userId: payload.userId,
      existingReadingId: payload.existingReadingId,
    });
  }

  const dbPayload: Record<string, unknown> = {
    metered_kg: arb.meteredKg,
    wiwo_kg: arb.wiwoKg,
    variance_kg: arb.varianceKg,
    variance_reason_code: payload.varianceReasonCode ?? "NONE",
    billable_source: arb.billableSource,
    billable_kg: arb.billableKg,
    gross_amount: amounts.grossAmount,
    vat_amount: amounts.vatAmount,
    net_amount: amounts.netAmount,
    remarks: payload.remarks ?? null,
    modified_by: payload.userId ?? null,
  };
  if (meterReadingId !== undefined) dbPayload.meter_reading_id = meterReadingId;
  if (payload.wiwoHeaderId !== undefined) dbPayload.wiwo_header_id = payload.wiwoHeaderId;

  const res = await directusFetch<{ data: UnifiedBillingTransaction }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}`,
    { method: "PATCH", body: JSON.stringify(dbPayload) }
  );
  return res.data;
}

// ─── Status Transitions ───────────────────────────────────────────────────────

export async function postTransaction(
  id: number,
  userId?: number | null
): Promise<UnifiedBillingTransaction> {
  const res = await directusFetch<{ data: UnifiedBillingTransaction }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "POSTED", modified_by: userId ?? null }),
    }
  );

  const tx = res.data;

  // DEV-RULE: Mark sales_invoice.is_visit = 1 upon posting regular billing (strictly excluded for onboarding)
  if (tx && tx.transaction_type !== "ONBOARDING_BASELINE") {
    let invoiceId: number | null = null;
    if (tx.sales_invoice_id) {
      invoiceId = typeof tx.sales_invoice_id === "object"
        ? (tx.sales_invoice_id as unknown as { id: number }).id
        : Number(tx.sales_invoice_id);
    }

    if (!invoiceId && tx.transaction_header_id) {
      const headerId = typeof tx.transaction_header_id === "object"
        ? (tx.transaction_header_id as unknown as { id: number }).id
        : Number(tx.transaction_header_id);
      try {
        const linkRes = await directusFetch<{ data: { sales_invoice_id: number | { id: number } }[] }>(
          `${DIRECTUS_URL}/items/lpg_transaction_header_invoices?filter[header_id][_eq]=${headerId}&limit=1`
        );
        const link = linkRes.data?.[0];
        if (link?.sales_invoice_id) {
          invoiceId = typeof link.sales_invoice_id === "object"
            ? link.sales_invoice_id.id
            : Number(link.sales_invoice_id);
        }
      } catch (e) {
        console.warn("Failed to resolve invoice from transaction header link in postTransaction:", e);
      }
    }

    if (invoiceId) {
      try {
        await directusFetch(`${DIRECTUS_URL}/items/sales_invoice/${invoiceId}`, {
          method: "PATCH",
          body: JSON.stringify({ is_visit: 1 }),
        });
      } catch (err) {
        console.warn("Failed to update sales_invoice.is_visit to 1 in postTransaction:", err);
      }
    }
  }

  return tx;
}

export async function cancelTransaction(
  id: number,
  reason: string,
  userId?: number | null
): Promise<UnifiedBillingTransaction> {
  const res = await directusFetch<{ data: UnifiedBillingTransaction }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "CANCELLED",
        cancelled_by: userId ?? null,
        cancelled_date: new Date().toISOString().split("T")[0],
        cancelled_reason: reason,
      }),
    }
  );
  return res.data;
}

// ─── WIWO Header Reference ────────────────────────────────────────────────────

export async function fetchBillableWiwoHeaders(
  customerCode: string,
  siteId: number
): Promise<WiwoHeader[]> {
  const qs =
    `fields=id,wiwo_no,wiwo_type,transaction_date,wiwo_status,total_billable_kg` +
    `&filter[customer_code][_eq]=${encodeURIComponent(customerCode)}` +
    `&filter[lpg_site_id][_eq]=${siteId}` +
    `&filter[wiwo_status][_eq]=PENDING&sort=-transaction_date&limit=50`;
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_wiwo_headers?${qs}`
  );
  return (res.data ?? []) as unknown as WiwoHeader[];
}
