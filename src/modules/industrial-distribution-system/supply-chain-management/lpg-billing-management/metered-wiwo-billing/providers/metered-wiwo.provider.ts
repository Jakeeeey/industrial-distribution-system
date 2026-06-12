import {
  directusFetch,
  getDirectusBase,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/directus";
import type {
  MeteredWiwoTransaction,
  MeteredListParams,
  TransactionType,
  TransactionStatus,
} from "../types";

const DIRECTUS_URL = getDirectusBase();

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapTxRecord(raw: Record<string, unknown>): MeteredWiwoTransaction {
  const siteObj =
    raw["lpg_site_id"] && typeof raw["lpg_site_id"] === "object"
      ? (raw["lpg_site_id"] as Record<string, unknown>)
      : null;
  const siteId = siteObj
    ? Number(siteObj.id)
    : raw["lpg_site_id"]
      ? Number(raw["lpg_site_id"])
      : null;

  const mrObj =
    raw["meter_reading_id"] && typeof raw["meter_reading_id"] === "object"
      ? (raw["meter_reading_id"] as Record<string, unknown>)
      : null;
  const wiwoObj =
    raw["wiwo_header_id"] && typeof raw["wiwo_header_id"] === "object"
      ? (raw["wiwo_header_id"] as Record<string, unknown>)
      : null;
  const headerObj =
    raw["transaction_header_id"] && typeof raw["transaction_header_id"] === "object"
      ? (raw["transaction_header_id"] as Record<string, unknown>)
      : null;

  const headerId = headerObj
    ? Number(headerObj.header_id)
    : raw["transaction_header_id"]
      ? Number(raw["transaction_header_id"])
      : null;

  const txNo = String(raw["transaction_no"] ?? "");
  const readingNo =
    mrObj && mrObj["reading_no"]
      ? String(mrObj["reading_no"])
      : String(raw["reading_no"] ?? "");

  return {
    id: Number(raw["id"]),
    transaction_header_id: headerId,
    transaction_no: txNo,
    reading_no: readingNo,
    transaction_type:
      (raw["transaction_type"] as TransactionType) ?? "REGULAR_BILLING",
    transaction_date: String(raw["transaction_date"] ?? ""),
    customer_code: String(raw["customer_code"] ?? ""),
    lpg_site_id: siteId,
    meter_reading_id: mrObj
      ? Number(mrObj["id"])
      : raw["meter_reading_id"]
        ? Number(raw["meter_reading_id"])
        : null,
    wiwo_header_id: wiwoObj
      ? Number(wiwoObj["id"])
      : raw["wiwo_header_id"]
        ? Number(raw["wiwo_header_id"])
        : null,
    metered_kg: Number(raw["metered_kg"] ?? 0),
    wiwo_kg: Number(raw["wiwo_kg"] ?? 0),
    variance_kg: Number(raw["variance_kg"] ?? 0),
    billable_source:
      (raw["billable_source"] as "METERED" | "WIWO" | "NONE") ?? "METERED",
    billable_kg: Number(raw["billable_kg"] ?? 0),
    price_per_kg: Number(raw["price_per_kg"] ?? 0),
    gross_amount: Number(raw["gross_amount"] ?? 0),
    vat_amount: Number(raw["vat_amount"] ?? 0),
    net_amount: Number(raw["net_amount"] ?? 0),
    discount_amount: raw["discount_amount"]
      ? Number(raw["discount_amount"])
      : 0,
    sales_invoice_id: raw["sales_invoice_id"]
      ? Number(raw["sales_invoice_id"])
      : null,
    sales_invoice_no: raw["sales_invoice_no"]
      ? String(raw["sales_invoice_no"])
      : null,
    sales_order_id: raw["sales_order_id"]
      ? Number(raw["sales_order_id"])
      : null,
    sales_order_no: raw["sales_order_no"]
      ? String(raw["sales_order_no"])
      : null,
    status: (raw["status"] as TransactionStatus) ?? "DRAFT",
    remarks: raw["remarks"] ? String(raw["remarks"]) : null,
    pressure_line: raw["pressure_line"]
      ? Number(raw["pressure_line"])
      : undefined,
    psi: raw["psi"] ? Number(raw["psi"]) : undefined,
    atmospheric_pressure: raw["atmospheric_pressure"]
      ? Number(raw["atmospheric_pressure"])
      : undefined,
    lpg_vapor_factor: raw["lpg_vapor_factor"]
      ? Number(raw["lpg_vapor_factor"])
      : undefined,
    meter_unit: raw["meter_unit"] as "M3" | "LITER" | "KG" | "UNIT" | undefined,
    meter_direction: raw["meter_direction"] as
      | "INCREASING"
      | "DECREASING"
      | undefined,
    conversion_factor: raw["conversion_factor"]
      ? Number(raw["conversion_factor"])
      : undefined,
    billing_period_from: raw["billing_period_from"]
      ? String(raw["billing_period_from"])
      : null,
    billing_period_to: raw["billing_period_to"]
      ? String(raw["billing_period_to"])
      : null,
    posted_by: raw["posted_by"] ? Number(raw["posted_by"]) : null,
    posted_date: raw["posted_date"] ? String(raw["posted_date"]) : null,
    cancelled_by: raw["cancelled_by"] ? Number(raw["cancelled_by"]) : null,
    cancelled_date: raw["cancelled_date"]
      ? String(raw["cancelled_date"])
      : null,
    cancelled_reason: raw["cancelled_reason"]
      ? String(raw["cancelled_reason"])
      : null,
    created_by: raw["created_by"] ? Number(raw["created_by"]) : null,
    created_date: raw["created_date"] ? String(raw["created_date"]) : null,
    modified_by: raw["modified_by"] ? Number(raw["modified_by"]) : null,
    modified_date: raw["modified_date"] ? String(raw["modified_date"]) : null,
    header: headerObj
      ? {
          header_id: Number(headerObj.header_id),
          header_no: headerObj.header_no ? String(headerObj.header_no) : null,
          customer_id: String(headerObj.customer_id ?? ""),
          customer_site_id: Number(headerObj.customer_site_id ?? 0),
          period_from: String(headerObj.period_from ?? ""),
          period_to: String(headerObj.period_to ?? ""),
          status: (headerObj.status as TransactionStatus) ?? "DRAFT",
          is_billed: Number(headerObj.is_billed ?? 0),
          remarks: headerObj.remarks ? String(headerObj.remarks) : null,
        }
      : undefined,
    site: siteObj
      ? {
          id: Number(siteObj.id),
          site_name: siteObj.site_name ? String(siteObj.site_name) : null,
          site_address: siteObj.site_address
            ? String(siteObj.site_address)
            : null,
          default_pressure_line: siteObj.default_pressure_line
            ? Number(siteObj.default_pressure_line)
            : null,
          default_psi: siteObj.default_psi ? Number(siteObj.default_psi) : null,
          default_atmospheric_pressure: siteObj.default_atmospheric_pressure
            ? Number(siteObj.default_atmospheric_pressure)
            : null,
        }
      : undefined,
    meter_reading: mrObj
      ? {
          id: Number(mrObj["id"]),
          reading_no: mrObj["reading_no"]
            ? String(mrObj["reading_no"])
            : undefined,
          lpg_site_id: siteId ?? 0,
          reading_date: String(mrObj["reading_date"] ?? ""),
          previous_reading: Number(mrObj["previous_reading"] ?? 0),
          current_reading: Number(mrObj["current_reading"] ?? 0),
          raw_consumption: Number(mrObj["raw_consumption"] ?? 0),
          kg_consumed: Number(mrObj["kg_consumed"] ?? 0),
          price_per_kg: Number(mrObj["price_per_kg"] ?? 0),
          created_by: mrObj["created_by"] ? Number(mrObj["created_by"]) : null,
          created_date: mrObj["created_date"]
            ? String(mrObj["created_date"])
            : null,
        }
      : undefined,
    wiwo_header: wiwoObj
      ? {
          id: Number(wiwoObj["id"]),
          transaction_no: String(
            wiwoObj["wiwo_no"] ?? wiwoObj["transaction_no"] ?? "",
          ),
          transaction_date: String(wiwoObj["transaction_date"] ?? ""),
          customer_code: String(wiwoObj["customer_code"] ?? ""),
          lpg_site_id: wiwoObj["lpg_site_id"]
            ? Number(wiwoObj["lpg_site_id"])
            : null,
          status: String(wiwoObj["wiwo_status"] ?? wiwoObj["status"] ?? ""),
          total_wiwo_kg: wiwoObj["total_wiwo_kg"]
            ? Number(wiwoObj["total_wiwo_kg"])
            : undefined,
        }
      : undefined,
  };
}

// ─── TX deep fields ───────────────────────────────────────────────────────────

const TX_FIELDS = [
  "*",
  "lpg_site_id.id",
  "lpg_site_id.site_name",
  "lpg_site_id.site_address",
  "lpg_site_id.default_pressure_line",
  "lpg_site_id.default_psi",
  "lpg_site_id.default_atmospheric_pressure",
  "meter_reading_id.id",
  "meter_reading_id.reading_no",
  "meter_reading_id.reading_date",
  "meter_reading_id.previous_reading",
  "meter_reading_id.current_reading",
  "meter_reading_id.raw_consumption",
  "meter_reading_id.kg_consumed",
  "meter_reading_id.price_per_kg",
  "meter_reading_id.created_by",
  "meter_reading_id.created_date",
  "wiwo_header_id.id",
  "wiwo_header_id.wiwo_no",
  "wiwo_header_id.transaction_date",
  "wiwo_header_id.customer_code",
  "wiwo_header_id.lpg_site_id",
  "wiwo_header_id.wiwo_status",
  "transaction_header_id.header_id",
  "transaction_header_id.header_no",
  "transaction_header_id.customer_id",
  "transaction_header_id.customer_site_id",
  "transaction_header_id.period_from",
  "transaction_header_id.period_to",
  "transaction_header_id.status",
  "transaction_header_id.is_billed",
  "transaction_header_id.remarks",
].join(",");

// ─── Sequence Number ──────────────────────────────────────────────────────────

/**
 * Returns the next sequence number for a given transaction type, site, and date.
 * Sequence restarts per site per day (count existing records for that site+date+type).
 */
export async function fetchNextTxSeq(
  type: TransactionType,
  siteId: number,
  date: string,
): Promise<number> {
  if (!siteId || !date) return 1;
  const filter = {
    transaction_type: { _eq: type },
    lpg_site_id: { _eq: siteId },
    transaction_date: { _eq: date },
  };
  const qs = `filter=${encodeURIComponent(JSON.stringify(filter))}&limit=0&meta=total_count`;
  try {
    const res = await directusFetch<{ meta?: { total_count: number } }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?${qs}`,
    );
    return (res.meta?.total_count ?? 0) + 1;
  } catch (err) {
    console.error("fetchNextTxSeq failed:", err);
    return 1;
  }
}

// ─── Transactions — List ──────────────────────────────────────────────────────

export async function fetchMeteredTransactions(
  params: MeteredListParams,
): Promise<{
  data: MeteredWiwoTransaction[];
  total: number;
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const offset = (page - 1) * limit;

  const filterList: Record<string, unknown>[] = [];

  // 1. Transaction Type filter (with special onboarding rules)
  if (params.transactionType === "REGULAR_BILLING") {
    filterList.push({ transaction_type: { _eq: "REGULAR_BILLING" } });
  } else if (params.transactionType === "ONBOARDING_BASELINE") {
    filterList.push({
      transaction_type: { _eq: "ONBOARDING_BASELINE" },
      meter_reading_id: { _null: true },
      status: { _eq: "DRAFT" },
    });
  } else {
    // "ALL" or undefined
    filterList.push({
      _or: [
        { transaction_type: { _eq: "REGULAR_BILLING" } },
        {
          _and: [
            { transaction_type: { _eq: "ONBOARDING_BASELINE" } },
            { meter_reading_id: { _null: true } },
            { status: { _eq: "DRAFT" } },
          ],
        },
      ],
    });
  }

  // 2. Status filter
  if (params.status) {
    filterList.push({ status: { _eq: params.status } });
  }

  // Site filter
  if (params.siteId) {
    filterList.push({ lpg_site_id: { _eq: params.siteId } });
  }

  // 3. Search filter
  if (params.search) {
    filterList.push({
      _or: [
        { customer_code: { _icontains: params.search } },
        { transaction_no: { _icontains: params.search } },
        { lpg_site_id: { site_name: { _icontains: params.search } } },
      ],
    });
  }

  // Combine into a single filter object
  let filters: Record<string, unknown> = {};
  if (filterList.length === 1) {
    filters = filterList[0];
  } else if (filterList.length > 1) {
    filters = { _and: filterList };
  }

  let qs = `fields=${TX_FIELDS}&sort=-modified_date&limit=${limit}&offset=${offset}&meta=total_count`;
  if (Object.keys(filters).length > 0) {
    qs += `&filter=${encodeURIComponent(JSON.stringify(filters))}`;
  }

  const res = await directusFetch<{
    data: Record<string, unknown>[];
    meta?: { total_count: number };
  }>(`${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?${qs}`);

  return {
    data: (res.data ?? []).map(mapTxRecord),
    total: res.meta?.total_count ?? 0,
  };
}

// ─── Transactions — Get by ID ─────────────────────────────────────────────────

export async function fetchLastMeteredTransaction(
  siteId: number,
): Promise<MeteredWiwoTransaction | null> {
  if (!siteId) return null;

  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?fields=${TX_FIELDS}&filter[lpg_site_id][_eq]=${siteId}&sort=-transaction_date,-id&limit=1`,
  );

  const tx = res.data?.[0];
  return tx ? mapTxRecord(tx) : null;
}

/**
 * Returns the current_reading and billing_period_to from the most recent
 * posted/draft transaction that matches the given site + customer, optionally
 * filtered by sales invoice.
 *   - When salesInvoiceNo is provided: per-invoice chaining
 *   - When salesInvoiceNo is omitted:  per-site chaining (any invoice)
 */
export async function fetchLastReadingByInvoice(
  siteId: number,
  customerCode: string,
  salesInvoiceNo?: string,
): Promise<{
  last_current_reading: number;
  transaction_date: string;
  billing_period_to: string | null;
} | null> {
  if (!siteId || !customerCode) return null;

  const andConditions: Record<string, unknown>[] = [
    { lpg_site_id: { _eq: siteId } },
    { customer_code: { _eq: customerCode } },
  ];

  if (salesInvoiceNo) {
    andConditions.push({ sales_invoice_no: { _eq: salesInvoiceNo } });
  }

  const filter = encodeURIComponent(JSON.stringify({ _and: andConditions }));

  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions` +
      `?fields=id,transaction_date,billing_period_to,meter_reading_id.*` +
      `&filter=${filter}` +
      `&sort=-transaction_date,-id` +
      `&limit=1`,
  );

  const raw = res.data?.[0];
  if (!raw) return null;

  const mrObj =
    raw["meter_reading_id"] && typeof raw["meter_reading_id"] === "object"
      ? (raw["meter_reading_id"] as Record<string, unknown>)
      : null;

  const currentReading = mrObj ? Number(mrObj["current_reading"] ?? 0) : 0;
  const billingPeriodTo = raw["billing_period_to"]
    ? String(raw["billing_period_to"])
    : null;

  return {
    last_current_reading: currentReading,
    transaction_date: String(raw["transaction_date"] ?? ""),
    billing_period_to: billingPeriodTo,
  };
}

export async function fetchMeteredTransactionById(
  id: number,
): Promise<MeteredWiwoTransaction | null> {
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}?fields=${TX_FIELDS}`,
  );
  if (!res.data) return null;
  const tx = mapTxRecord(res.data);

  try {
    const attsRes = await directusFetch<{ data: Record<string, unknown>[] }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_attachments?filter[transaction_id][_eq]=${id}&limit=-1`,
    );
    if (attsRes.data) {
      tx.attachments = attsRes.data.map((item) => ({
        id: Number(item.id),
        transaction_id: Number(item.transaction_id),
        site_cylinder_id: item.site_cylinder_id
          ? Number(item.site_cylinder_id)
          : null,
        cylinder_asset_id: item.cylinder_asset_id
          ? Number(item.cylinder_asset_id)
          : null,
        attachment_type: item.attachment_type as
          | "SERIAL_IMAGE"
          | "WEIGHT_IMAGE"
          | "GENERAL_PHOTO",
        directus_file_id: String(item.directus_file_id),
        created_by: item.created_by ? Number(item.created_by) : null,
        created_at: item.created_at ? String(item.created_at) : undefined,
      }));
    }
  } catch (err) {
    console.warn(
      "fetchMeteredTransactionById: could not load attachments. Transaction will still be returned without attachment metadata.",
      err,
    );
  }

  return tx;
}

// ─── Meter Reading — create / update ─────────────────────────────────────────

async function createOrUpdateMeterReading(
  payload: Partial<MeteredWiwoTransaction>,
  userId?: number,
  readingId?: number | null,
): Promise<number> {
  const raw = payload as unknown as Record<string, unknown>;
  const prevReading = Number(raw.previous_reading ?? 0);
  const currReading = Number(raw.current_reading ?? 0);

  const meterDir = (payload.meter_direction ?? "INCREASING") as string;
  const rawConsumption =
    meterDir === "DECREASING"
      ? Math.max(0, prevReading - currReading)
      : Math.max(0, currReading - prevReading);

  const data = {
    lpg_site_id: payload.lpg_site_id,
    customer_code: payload.customer_code,
    reading_date:
      payload.transaction_date || new Date().toISOString().split("T")[0],
    previous_reading: prevReading,
    current_reading: currReading,
    kg_consumed: payload.metered_kg ?? payload.billable_kg ?? 0,
    price_per_kg: payload.price_per_kg ?? 0,
    raw_consumption: rawConsumption,
    reading_status: payload.status || "DRAFT",
    reading_no: payload.reading_no,
    billing_period_from: payload.billing_period_from || null,
    billing_period_to: payload.billing_period_to || null,
    meter_unit: payload.meter_unit || "KG",
    meter_direction: payload.meter_direction || "INCREASING",
    conversion_factor: payload.conversion_factor ?? 1.0,
    pressure_line: payload.pressure_line ?? 1.0,
    psi: payload.psi ?? 0.0,
    atmospheric_pressure: payload.atmospheric_pressure ?? 14.7,
    lpg_vapor_factor: payload.lpg_vapor_factor ?? 1.0,
    gross_amount: payload.gross_amount ?? 0,
    discount_amount: payload.discount_amount ?? 0,
    vat_amount: payload.vat_amount ?? 0,
    net_amount: payload.net_amount ?? 0,
    sales_invoice_id: payload.sales_invoice_id || null,
    sales_invoice_no: payload.sales_invoice_no || null,
    remarks: payload.remarks || "",
    ...(userId
      ? payload.status === "POSTED"
        ? { posted_by: userId, posted_date: new Date().toISOString() }
        : {}
      : {}),
    ...(userId
      ? payload.status === "CANCELLED"
        ? { cancelled_by: userId, cancelled_date: new Date().toISOString() }
        : {}
      : {}),
    ...(userId && !readingId
      ? {
          created_by: userId,
          created_date: new Date().toISOString(),
          modified_by: userId,
          modified_date: new Date().toISOString(),
        }
      : {}),
    ...(userId && readingId
      ? { modified_by: userId, modified_date: new Date().toISOString() }
      : {}),
  };

  if (readingId) {
    await directusFetch(
      `${DIRECTUS_URL}/items/lpg_meter_readings/${readingId}`,
      { method: "PATCH", body: JSON.stringify(data) },
    );
    return readingId;
  } else {
    const res = await directusFetch<{ data: { id: number } }>(
      `${DIRECTUS_URL}/items/lpg_meter_readings`,
      { method: "POST", body: JSON.stringify(data) },
    );
    return res.data.id;
  }
}

// ─── Bridge Transaction — create / update ────────────────────────────────────

async function buildBridgePayload(
  payload: Partial<MeteredWiwoTransaction>,
  readingId: number,
  userId?: number,
  isUpdate = false,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {
    transaction_no: payload.transaction_no || payload.reading_no,
    transaction_type: payload.transaction_type ?? "REGULAR_BILLING",
    transaction_date:
      payload.transaction_date || new Date().toISOString().split("T")[0],
    customer_code: payload.customer_code,
    lpg_site_id: payload.lpg_site_id,
    meter_reading_id: readingId,
    wiwo_header_id: payload.wiwo_header_id || null,
    metered_kg: payload.metered_kg ?? 0,
    wiwo_kg: payload.wiwo_kg ?? 0,
    variance_kg: payload.variance_kg ?? 0,
    billable_source: payload.billable_source ?? "METERED",
    billable_kg: payload.billable_kg ?? 0,
    price_per_kg: payload.price_per_kg ?? 0,
    gross_amount: payload.gross_amount ?? 0,
    vat_amount: payload.vat_amount ?? 0,
    net_amount: payload.net_amount ?? 0,
    discount_amount: payload.discount_amount ?? 0,
    sales_invoice_id: payload.sales_invoice_id || null,
    sales_invoice_no: payload.sales_invoice_no || null,
    sales_order_id: payload.sales_order_id || null,
    sales_order_no: payload.sales_order_no || null,
    status: payload.status || "DRAFT",
    remarks: payload.remarks || null,
    pressure_line: payload.pressure_line ?? null,
    psi: payload.psi ?? null,
    atmospheric_pressure: payload.atmospheric_pressure ?? null,
    lpg_vapor_factor: payload.lpg_vapor_factor ?? null,
    meter_unit: payload.meter_unit || null,
    meter_direction: payload.meter_direction || null,
    conversion_factor: payload.conversion_factor ?? null,
    billing_period_from: payload.billing_period_from || null,
    billing_period_to: payload.billing_period_to || null,
    ...(userId
      ? payload.status === "POSTED"
        ? { posted_by: userId, posted_date: new Date().toISOString() }
        : {}
      : {}),
    ...(userId
      ? payload.status === "CANCELLED"
        ? { cancelled_by: userId, cancelled_date: new Date().toISOString() }
        : {}
      : {}),
    ...(userId && !isUpdate
      ? {
          created_by: userId,
          created_date: new Date().toISOString(),
          modified_by: userId,
          modified_date: new Date().toISOString(),
        }
      : {}),
    ...(userId && isUpdate
      ? { modified_by: userId, modified_date: new Date().toISOString() }
      : {}),
  };
  return data;
}


// ─── Public: Create ───────────────────────────────────────────────────────────

export async function createMeteredTransaction(
  payload: Partial<MeteredWiwoTransaction>,
): Promise<MeteredWiwoTransaction> {
  const raw = payload as unknown as Record<string, unknown>;
  const userId = payload.created_by ?? undefined;

  console.log("[createMeteredTransaction] payload:", JSON.stringify(payload));

  // 1. Link transaction header (do not edit or create on lpg_transaction_headers table)
  const headerId = payload.transaction_header_id ?? null;
  console.log("[createMeteredTransaction] header id:", headerId);

  // 2. Create meter reading row
  let readingId: number | null | undefined = payload.meter_reading_id;
  if (
    payload.lpg_site_id &&
    raw.previous_reading !== undefined &&
    raw.current_reading !== undefined
  ) {
    readingId = await createOrUpdateMeterReading(
      payload,
      userId as number | undefined,
      null,
    );
    console.log("[createMeteredTransaction] meter reading id:", readingId);
  }

  // 3. Build bridge payload and link transaction_header_id
  const bridgeData = await buildBridgePayload(
    payload,
    readingId!,
    userId as number | undefined,
    false,
  );
  bridgeData.transaction_header_id = headerId;

  // 4. Create bridge transaction row
  const res = await directusFetch<{ data: { id: number } }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions`,
    { method: "POST", body: JSON.stringify(bridgeData) },
  );

  // 5. Link invoice to transaction header
  const raw2 = payload as unknown as Record<string, unknown>;
  const invoiceId =
    typeof raw2.sales_invoice_id === "number" && raw2.sales_invoice_id > 0
      ? raw2.sales_invoice_id
      : null;

  if (headerId && invoiceId) {
    try {
      // Status: POSTED for onboarding baseline (it's a setup record, already finalised),
      //         DRAFT for regular billing (invoice still being processed).
      const headerInvoiceStatus =
        payload.transaction_type === "ONBOARDING_BASELINE" ? "POSTED" : "DRAFT";

      await directusFetch(`${DIRECTUS_URL}/items/lpg_transaction_header_invoices`, {
        method: "POST",
        body: JSON.stringify({
          header_id: headerId,
          sales_invoice_id: invoiceId,
          linked_by: userId ?? null,
          linked_at: new Date().toISOString(),
          status: headerInvoiceStatus,
        }),
      });
    } catch (linkErr) {
      // Non-fatal: transaction already saved; log but don't block.
      console.warn("[createMeteredTransaction] Failed to link invoice to header:", linkErr);
    }
  }

  // 6. Save attachments
  if (payload.attachments && payload.attachments.length > 0) {
    for (const att of payload.attachments) {
      await directusFetch(
        `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_attachments`,
        {
          method: "POST",
          body: JSON.stringify({
            transaction_id: res.data.id,
            attachment_type: att.attachment_type,
            directus_file_id: att.directus_file_id,
            created_by: userId,
          }),
        },
      ).catch((err) => console.error("Failed to save attachment:", err));
    }
  }

  return {
    ...payload,
    id: res.data.id,
    transaction_header_id: headerId,
    reading_no: payload.reading_no ?? "",
    transaction_no: payload.reading_no,
    meter_reading_id: readingId ?? null,
  } as unknown as MeteredWiwoTransaction;
}

// ─── Public: Update ───────────────────────────────────────────────────────────

export async function updateMeteredTransaction(
  id: number,
  payload: Partial<MeteredWiwoTransaction>,
): Promise<MeteredWiwoTransaction> {
  const raw = payload as unknown as Record<string, unknown>;
  const userId = (raw.modified_by as number | undefined) ?? undefined;

  console.log("[updateMeteredTransaction] payload:", JSON.stringify(payload));

  // 1. Fetch existing transaction to reuse its meter_reading_id and transaction_header_id if not in payload
  const existing = await fetchMeteredTransactionById(id);
  const existingReadingId = existing?.meter_reading_id;
  const existingHeaderId = existing?.transaction_header_id;

  // 2. Link transaction header (do not edit or create on lpg_transaction_headers table)
  const headerId = payload.transaction_header_id || existingHeaderId || null;

  // 3. Update / create meter reading
  let readingId: number | null | undefined =
    payload.meter_reading_id || existingReadingId;
  if (
    payload.lpg_site_id &&
    raw.previous_reading !== undefined &&
    raw.current_reading !== undefined
  ) {
    readingId = await createOrUpdateMeterReading(
      payload,
      userId,
      readingId || undefined,
    );
    console.log("[updateMeteredTransaction] meter reading id:", readingId);
  }

  // 4. Build bridge patch payload and link header
  const bridgeData = await buildBridgePayload(
    payload,
    readingId!,
    userId,
    true,
  );
  bridgeData.transaction_header_id = headerId;

  // 5. Update bridge transaction row
  await directusFetch(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}`,
    { method: "PATCH", body: JSON.stringify(bridgeData) },
  );

  // 5. Update attachments (delete existing, then insert new ones)
  try {
    const existingAttsRes = await directusFetch<{ data: { id: number }[] }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_attachments?filter[transaction_id][_eq]=${id}&fields=id`,
    );
    const existingAttIds = (existingAttsRes.data || []).map((a) => a.id);
    if (existingAttIds.length > 0) {
      await directusFetch(
        `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_attachments`,
        {
          method: "DELETE",
          body: JSON.stringify(existingAttIds),
        },
      );
    }
  } catch (err) {
    console.error("Failed to delete existing attachments:", err);
  }

  if (payload.attachments && payload.attachments.length > 0) {
    for (const att of payload.attachments) {
      await directusFetch(
        `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_attachments`,
        {
          method: "POST",
          body: JSON.stringify({
            transaction_id: id,
            attachment_type: att.attachment_type,
            directus_file_id: att.directus_file_id,
            created_by: userId,
          }),
        },
      ).catch((err) => console.error("Failed to save attachment:", err));
    }
  }

  return {
    id,
    ...payload,
    meter_reading_id: readingId ?? null,
  } as unknown as MeteredWiwoTransaction;
}

// ─── Meter Readings lookup ────────────────────────────────────────────────────

export async function fetchMeterReadings(siteId?: number): Promise<
  {
    id: number;
    reading_date: string;
    previous_reading: number;
    current_reading: number;
    kg_consumed: number;
    price_per_kg: number;
  }[]
> {
  let qs =
    "fields=id,reading_date,previous_reading,current_reading,kg_consumed,price_per_kg&sort=-reading_date&limit=50";
  if (siteId) qs += `&filter[lpg_site_id][_eq]=${siteId}`;
  const res = await directusFetch<{
    data: {
      id: number;
      reading_date: string;
      previous_reading: number;
      current_reading: number;
      kg_consumed: number;
      price_per_kg: number;
    }[];
  }>(`${DIRECTUS_URL}/items/lpg_meter_readings?${qs}`);
  return res.data ?? [];
}

// ─── WIWO Headers lookup ──────────────────────────────────────────────────────

export async function fetchUnbilledWiwoHeaders(
  customerCode?: string,
  siteId?: number,
): Promise<
  {
    id: number;
    transaction_no: string;
    transaction_date: string;
    total_wiwo_kg?: number;
  }[]
> {
  let qs =
    "fields=id,wiwo_no,transaction_date&filter[wiwo_status][_eq]=PENDING&sort=-transaction_date&limit=50";
  if (customerCode)
    qs += `&filter[customer_code][_eq]=${encodeURIComponent(customerCode)}`;
  if (siteId) qs += `&filter[lpg_site_id][_eq]=${siteId}`;
  const res = await directusFetch<{
    data: {
      id: number;
      wiwo_no?: string;
      transaction_no?: string;
      transaction_date: string;
      total_wiwo_kg?: number;
    }[];
  }>(`${DIRECTUS_URL}/items/lpg_wiwo_headers?${qs}`);

  return (res.data ?? []).map((item) => ({
    id: item.id,
    transaction_no: item.wiwo_no ?? item.transaction_no ?? "",
    transaction_date: item.transaction_date,
    total_wiwo_kg: undefined,
  }));
}

// ─── Sites lookup ─────────────────────────────────────────────────────────────

export type MeteredSite = {
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
  last_meter_reading?: number | null;
  billing_mode?: string | null;
};

export async function fetchMeteredSites(): Promise<MeteredSite[]> {
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_customer_lpg_sites?fields=id,site_name,customer_code,default_price_per_kg,meter_unit,meter_direction,conversion_factor,last_meter_reading,billing_mode,default_pressure_line,default_psi,default_atmospheric_pressure&filter[is_active][_eq]=1&filter[billing_mode][_in]=METERED,BOTH&sort=site_name&limit=-1`,
  );
  return (res.data ?? []).map((site) => ({
    ...site,
    default_pressure_line:
      site.default_pressure_line !== undefined &&
      site.default_pressure_line !== null
        ? Number(site.default_pressure_line)
        : 2.0183,
    default_psi:
      site.default_psi !== undefined && site.default_psi !== null
        ? Number(site.default_psi)
        : 10.0,
    default_atmospheric_pressure:
      site.default_atmospheric_pressure !== undefined &&
      site.default_atmospheric_pressure !== null
        ? Number(site.default_atmospheric_pressure)
        : 14.7,
  })) as MeteredSite[];
}

// ─── Site last reading update ─────────────────────────────────────────────────

export async function updateSiteReading(
  siteId: number,
  lastReading: number,
  readingDate: string,
): Promise<unknown> {
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_customer_lpg_sites/${siteId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        last_meter_reading: lastReading,
        last_reading_date: readingDate,
      }),
    },
  );
  return res.data;
}

// ─── Legacy: sequence helpers kept for backward compat ────────────────────────

export async function fetchNextMeterReadingSeq(
  customerCode: string,
  date: string,
): Promise<number> {
  if (!customerCode || !date) return 1;
  const filter = {
    customer_code: { _eq: customerCode },
    reading_date: { _eq: date },
  };
  const qs = `filter=${encodeURIComponent(JSON.stringify(filter))}&limit=0&meta=total_count`;
  try {
    const res = await directusFetch<{ meta?: { total_count: number } }>(
      `${DIRECTUS_URL}/items/lpg_meter_readings?${qs}`,
    );
    return (res.meta?.total_count ?? 0) + 1;
  } catch (err) {
    console.error("fetchNextMeterReadingSeq failed:", err);
    return 1;
  }
}


export async function deleteMeteredTransaction(id: number): Promise<void> {
  const tx = await fetchMeteredTransactionById(id);
  if (!tx) return;

  try {
    const existingAttsRes = await directusFetch<{ data: { id: number }[] }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_attachments?filter[transaction_id][_eq]=${id}&fields=id`,
    );
    const existingAttIds = (existingAttsRes.data || []).map((a) => a.id);
    if (existingAttIds.length > 0) {
      await directusFetch(
        `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_attachments`,
        {
          method: "DELETE",
          body: JSON.stringify(existingAttIds),
        },
      );
    }
  } catch (err) {
    console.error("deleteMeteredTransaction: attachments delete failed:", err);
  }

  await directusFetch(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${id}`,
    { method: "DELETE" }
  );

  if (tx.meter_reading_id) {
    await directusFetch(
      `${DIRECTUS_URL}/items/lpg_meter_readings/${tx.meter_reading_id}`,
      { method: "DELETE" }
    ).catch((err) => console.error("deleteMeteredTransaction: meter reading delete failed:", err));
  }

  if (tx.transaction_header_id) {
    await directusFetch(
      `${DIRECTUS_URL}/items/lpg_transaction_headers/${tx.transaction_header_id}`,
      { method: "DELETE" }
    ).catch((err) => console.error("deleteMeteredTransaction: header delete failed:", err));
  }
}

export async function checkOnboardingExists(siteId: number): Promise<boolean> {
  if (!siteId) return false;
  const filter = {
    transaction_type: { _eq: "ONBOARDING_BASELINE" },
    lpg_site_id: { _eq: siteId },
    status: { _neq: "CANCELLED" },
    meter_reading_id: { _nnull: true },
  };
  const qs = `filter=${encodeURIComponent(JSON.stringify(filter))}&limit=1&fields=id`;
  try {
    const res = await directusFetch<{ data: unknown[] }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?${qs}`
    );
    return (res.data?.length ?? 0) > 0;
  } catch (err) {
    console.error("checkOnboardingExists failed:", err);
    return false;
  }
}

export async function fetchDraftOnboarding(siteId: number): Promise<Record<string, unknown> | null> {
  if (!siteId) return null;
  const filter = {
    transaction_type: { _eq: "ONBOARDING_BASELINE" },
    lpg_site_id: { _eq: siteId },
    status: { _eq: "DRAFT" },
    meter_reading_id: { _null: true },
  };
  const qs = `filter=${encodeURIComponent(JSON.stringify(filter))}&limit=1&fields=*`;
  try {
    const res = await directusFetch<{ data: Record<string, unknown>[] }>(
      `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?${qs}`
    );
    return res.data?.[0] ?? null;
  } catch (err) {
    console.error("fetchDraftOnboarding failed:", err);
    return null;
  }
}

