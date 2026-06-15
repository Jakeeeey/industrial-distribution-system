// ─── billing-consolidation.repo.ts ───────────────────────────────────────────
// Directus data-access layer for the LPG Billing Consolidation module.
// RULE: Zero business logic here. Only raw fetch/create/patch calls to Directus.
// All recompute logic lives in billing-consolidation.service.ts.
// ─────────────────────────────────────────────────────────────────────────────

import {
  directusFetch,
  getDirectusBase,
} from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/directus";
import type {
  ConsolidationHeader,
  ConsolidationTransaction,
  ConsolidationWiwoDetail,
  ConsolidationWiwoHeader,
  ConsolidationMeterReading,
  ConsolidationAttachment,
  ConsolidationAuditEntry,
  ConsolidationHeaderListParams,
  ActiveCylinderRaw,
} from "../types/billing-consolidation.types";

const DIRECTUS_URL = getDirectusBase();

// ─── Field Selects ────────────────────────────────────────────────────────────

/** Fields to pull when listing/fetching headers */
const HEADER_FIELDS = [
  "header_id",
  "header_no",
  "customer_id",
  "customer_site_id",
  "period_from",
  "period_to",
  "status",
  "is_billed",
  "remarks",
  "created_by",
  "posted_by",
  "posted_at",
  "cancelled_by",
  "cancelled_at",
  "cancelled_reason",
  "created_at",
  "updated_at",
  // Expanded relations
  "customer_site_id.id",
  "customer_site_id.site_name",
  "customer_site_id.site_address",
].join(",");

/** Fields to pull for child transactions under a header */
const TX_FIELDS = [
  "id",
  "transaction_header_id",
  "transaction_no",
  "transaction_type",
  "transaction_date",
  "customer_code",
  "lpg_site_id",
  "meter_reading_id",
  "wiwo_header_id",
  "metered_kg",
  "wiwo_kg",
  "variance_kg",
  "billable_source",
  "billable_kg",
  "price_per_kg",
  "gross_amount",
  "discount_amount",
  "vat_amount",
  "net_amount",
  "status",
  "billing_period_from",
  "billing_period_to",
  "remarks",
  "created_by",
  "created_date",
  "modified_by",
  "modified_date",
].join(",");

// ─── Mapping Helpers ──────────────────────────────────────────────────────────

function mapHeader(raw: Record<string, unknown>): ConsolidationHeader {
  // customer_site_id may be expanded as an object by Directus
  const siteObj =
    raw["customer_site_id"] && typeof raw["customer_site_id"] === "object"
      ? (raw["customer_site_id"] as Record<string, unknown>)
      : null;

  return {
    header_id: Number(raw["header_id"]),
    header_no: raw["header_no"] ? String(raw["header_no"]) : null,
    customer_id: String(raw["customer_id"] ?? ""),
    customer_site_id: siteObj ? Number(siteObj["id"]) : Number(raw["customer_site_id"] ?? 0),
    period_from: String(raw["period_from"] ?? ""),
    period_to: String(raw["period_to"] ?? ""),
    status: (raw["status"] as ConsolidationHeader["status"]) ?? "DRAFT",
    is_billed: (Number(raw["is_billed"] ?? 0)) as 0 | 1,
    remarks: raw["remarks"] ? String(raw["remarks"]) : null,
    created_by: raw["created_by"] ? Number(raw["created_by"]) : null,
    posted_by: raw["posted_by"] ? Number(raw["posted_by"]) : null,
    posted_at: raw["posted_at"] ? String(raw["posted_at"]) : null,
    cancelled_by: raw["cancelled_by"] ? Number(raw["cancelled_by"]) : null,
    cancelled_at: raw["cancelled_at"] ? String(raw["cancelled_at"]) : null,
    cancelled_reason: raw["cancelled_reason"] ? String(raw["cancelled_reason"]) : null,
    created_at: String(raw["created_at"] ?? ""),
    updated_at: String(raw["updated_at"] ?? ""),
    site: siteObj
      ? {
          id: Number(siteObj["id"]),
          site_name: siteObj["site_name"] ? String(siteObj["site_name"]) : null,
          site_address: siteObj["site_address"] ? String(siteObj["site_address"]) : null,
        }
      : undefined,
  };
}

function mapTransaction(raw: Record<string, unknown>): ConsolidationTransaction {
  return {
    id: Number(raw["id"]),
    transaction_header_id: Number(raw["transaction_header_id"] ?? 0),
    transaction_no: String(raw["transaction_no"] ?? ""),
    transaction_type: (raw["transaction_type"] as ConsolidationTransaction["transaction_type"]) ?? "REGULAR_BILLING",
    transaction_date: String(raw["transaction_date"] ?? ""),
    customer_code: String(raw["customer_code"] ?? ""),
    lpg_site_id: Number(raw["lpg_site_id"] ?? 0),
    meter_reading_id: raw["meter_reading_id"] ? Number(raw["meter_reading_id"]) : null,
    wiwo_header_id: raw["wiwo_header_id"] ? Number(raw["wiwo_header_id"]) : null,
    metered_kg: Number(raw["metered_kg"] ?? 0),
    wiwo_kg: Number(raw["wiwo_kg"] ?? 0),
    variance_kg: Number(raw["variance_kg"] ?? 0),
    billable_source: (raw["billable_source"] as ConsolidationTransaction["billable_source"]) ?? "NONE",
    billable_kg: Number(raw["billable_kg"] ?? 0),
    price_per_kg: Number(raw["price_per_kg"] ?? 0),
    gross_amount: Number(raw["gross_amount"] ?? 0),
    discount_amount: Number(raw["discount_amount"] ?? 0),
    vat_amount: Number(raw["vat_amount"] ?? 0),
    net_amount: Number(raw["net_amount"] ?? 0),
    status: (raw["status"] as ConsolidationTransaction["status"]) ?? "DRAFT",
    billing_period_from: raw["billing_period_from"] ? String(raw["billing_period_from"]) : null,
    billing_period_to: raw["billing_period_to"] ? String(raw["billing_period_to"]) : null,
    remarks: raw["remarks"] ? String(raw["remarks"]) : null,
    created_by: raw["created_by"] ? Number(raw["created_by"]) : null,
    created_date: raw["created_date"] ? String(raw["created_date"]) : null,
    modified_by: raw["modified_by"] ? Number(raw["modified_by"]) : null,
    modified_date: raw["modified_date"] ? String(raw["modified_date"]) : null,
  };
}

// ─── Header Queries ───────────────────────────────────────────────────────────

/**
 * Fetches all LPG billing headers (lpg_transaction_headers) with pagination and filtering.
 * Only surfaces headers that are NOT permanently cancelled (reviewer can still view POSTED).
 */
export async function repoFetchHeaders(params: ConsolidationHeaderListParams): Promise<{
  data: ConsolidationHeader[];
  total: number;
}> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 15;
  const offset = (page - 1) * limit;

  const filterList: Record<string, unknown>[] = [];

  if (params.status && params.status !== "ALL") {
    filterList.push({ status: { _eq: params.status } });
  } else {
    // Default: exclude cancelled headers from main list
    filterList.push({ status: { _neq: "CANCELLED" } });
  }

  if (params.search) {
    filterList.push({
      _or: [
        { header_no: { _icontains: params.search } },
        { customer_id: { _icontains: params.search } },
      ],
    });
  }

  const filter = filterList.length > 0
    ? encodeURIComponent(JSON.stringify(filterList.length === 1 ? filterList[0] : { _and: filterList }))
    : "";

  const qs = [
    `fields=${HEADER_FIELDS}`,
    `sort=-created_at`,
    `limit=${limit}`,
    `offset=${offset}`,
    `meta=total_count`,
    filter ? `filter=${filter}` : "",
  ].filter(Boolean).join("&");

  const res = await directusFetch<{
    data: Record<string, unknown>[];
    meta?: { total_count: number };
  }>(`${DIRECTUS_URL}/items/lpg_transaction_headers?${qs}`);

  return {
    data: (res.data ?? []).map(mapHeader),
    total: res.meta?.total_count ?? 0,
  };
}

/**
 * Fetches a single billing header by ID.
 */
export async function repoFetchHeaderById(headerId: number): Promise<ConsolidationHeader | null> {
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_transaction_headers/${headerId}?fields=${HEADER_FIELDS}`
  );
  return res.data ? mapHeader(res.data) : null;
}

// ─── Transaction Queries ──────────────────────────────────────────────────────

/**
 * Fetches all child transactions for a given billing header.
 * Sorted by billing_period_from ascending so they appear chronologically.
 */
export async function repoFetchTransactionsByHeader(headerId: number): Promise<ConsolidationTransaction[]> {
  const filter = encodeURIComponent(
    JSON.stringify({ transaction_header_id: { _eq: headerId } })
  );
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions?fields=${TX_FIELDS}&filter=${filter}&sort=billing_period_from,id&limit=-1`
  );
  return (res.data ?? []).map(mapTransaction);
}

// ─── Meter Reading Queries ────────────────────────────────────────────────────

/**
 * Fetches a single meter reading row by ID (full detail for reviewer).
 */
export async function repoFetchMeterReading(readingId: number): Promise<ConsolidationMeterReading | null> {
  const res = await directusFetch<{ data: Record<string, unknown> }>(
    `${DIRECTUS_URL}/items/lpg_meter_readings/${readingId}?fields=*`
  );
  if (!res.data) return null;
  const r = res.data;
  return {
    id: Number(r["id"]),
    reading_no: r["reading_no"] ? String(r["reading_no"]) : null,
    lpg_site_id: Number(r["lpg_site_id"] ?? 0),
    customer_code: String(r["customer_code"] ?? ""),
    reading_date: String(r["reading_date"] ?? ""),
    billing_period_from: r["billing_period_from"] ? String(r["billing_period_from"]) : null,
    billing_period_to: r["billing_period_to"] ? String(r["billing_period_to"]) : null,
    previous_reading: Number(r["previous_reading"] ?? 0),
    current_reading: Number(r["current_reading"] ?? 0),
    raw_consumption: Number(r["raw_consumption"] ?? 0),
    meter_unit: (r["meter_unit"] as ConsolidationMeterReading["meter_unit"]) ?? "KG",
    meter_direction: (r["meter_direction"] as ConsolidationMeterReading["meter_direction"]) ?? "INCREASING",
    conversion_factor: Number(r["conversion_factor"] ?? 1),
    pressure_line: Number(r["pressure_line"] ?? 1),
    psi: Number(r["psi"] ?? 0),
    atmospheric_pressure: Number(r["atmospheric_pressure"] ?? 14.7),
    lpg_vapor_factor: Number(r["lpg_vapor_factor"] ?? 1),
    kg_consumed: Number(r["kg_consumed"] ?? 0),
    price_per_kg: Number(r["price_per_kg"] ?? 0),
    gross_amount: Number(r["gross_amount"] ?? 0),
    discount_amount: Number(r["discount_amount"] ?? 0),
    vat_amount: Number(r["vat_amount"] ?? 0),
    net_amount: Number(r["net_amount"] ?? 0),
    reading_status: (r["reading_status"] as ConsolidationMeterReading["reading_status"]) ?? "DRAFT",
    remarks: r["remarks"] ? String(r["remarks"]) : null,
  };
}

/**
 * Patches a meter reading record with reviewer-corrected values.
 */
export async function repoPatchMeterReading(
  readingId: number,
  data: Partial<Record<string, unknown>>
): Promise<void> {
  await directusFetch(
    `${DIRECTUS_URL}/items/lpg_meter_readings/${readingId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

// ─── WIWO Queries ─────────────────────────────────────────────────────────────

/**
 * Fetches a WIWO header with all its cylinder detail lines.
 */
export async function repoFetchWiwoWithDetails(wiwoHeaderId: number): Promise<ConsolidationWiwoHeader | null> {
  const headerFields = "id,wiwo_no,lpg_site_id,customer_code,transaction_date,wiwo_type,total_returned_cylinders,total_deployed_cylinders,total_billable_kg,price_per_kg,gross_amount,discount_amount,vat_amount,net_amount,wiwo_status,remarks";
  const detailFields = "id,wiwo_header_id,line_no,lpg_site_id,customer_code,line_type,site_cylinder_id,cylinder_asset_id,product_id,serial_number,tare_weight_kg,previous_lpg_kg,returned_gross_weight_kg,remaining_lpg_kg,consumed_lpg_kg,billable_kg,price_per_kg,gross_amount,discount_amount,vat_amount,net_amount,is_billable,remarks,product_id.product_name";

  const [headerRes, detailRes] = await Promise.all([
    directusFetch<{ data: Record<string, unknown> }>(
      `${DIRECTUS_URL}/items/lpg_wiwo_headers/${wiwoHeaderId}?fields=${headerFields}`
    ),
    directusFetch<{ data: Record<string, unknown>[] }>(
      `${DIRECTUS_URL}/items/lpg_wiwo_details?fields=${detailFields}&filter[wiwo_header_id][_eq]=${wiwoHeaderId}&sort=line_no&limit=-1`
    ),
  ]);

  if (!headerRes.data) return null;
  const h = headerRes.data;

  const details: ConsolidationWiwoDetail[] = (detailRes.data ?? []).map((d) => {
    const productObj =
      d["product_id"] && typeof d["product_id"] === "object"
        ? (d["product_id"] as Record<string, unknown>)
        : null;

    return {
      id: Number(d["id"]),
      wiwo_header_id: Number(d["wiwo_header_id"]),
      line_no: Number(d["line_no"] ?? 0),
      lpg_site_id: Number(d["lpg_site_id"] ?? 0),
      customer_code: String(d["customer_code"] ?? ""),
      line_type: (d["line_type"] as ConsolidationWiwoDetail["line_type"]) ?? "CONSUMPTION_RETURN",
      site_cylinder_id: d["site_cylinder_id"] ? Number(d["site_cylinder_id"]) : null,
      cylinder_asset_id: Number(d["cylinder_asset_id"] ?? 0),
      product_id: productObj ? Number(productObj["product_id"] ?? d["product_id"]) : Number(d["product_id"] ?? 0),
      serial_number: String(d["serial_number"] ?? ""),
      tare_weight_kg: Number(d["tare_weight_kg"] ?? 0),
      previous_lpg_kg: Number(d["previous_lpg_kg"] ?? 0),
      returned_gross_weight_kg: d["returned_gross_weight_kg"] != null ? Number(d["returned_gross_weight_kg"]) : null,
      remaining_lpg_kg: Number(d["remaining_lpg_kg"] ?? 0),
      consumed_lpg_kg: Number(d["consumed_lpg_kg"] ?? 0),
      billable_kg: Number(d["billable_kg"] ?? 0),
      price_per_kg: Number(d["price_per_kg"] ?? 0),
      gross_amount: Number(d["gross_amount"] ?? 0),
      discount_amount: Number(d["discount_amount"] ?? 0),
      vat_amount: Number(d["vat_amount"] ?? 0),
      net_amount: Number(d["net_amount"] ?? 0),
      is_billable: (Number(d["is_billable"] ?? 1)) as 0 | 1,
      remarks: d["remarks"] ? String(d["remarks"]) : null,
      product: productObj ? { product_name: productObj["product_name"] ? String(productObj["product_name"]) : null } : undefined,
    };
  });

  return {
    id: Number(h["id"]),
    wiwo_no: String(h["wiwo_no"] ?? ""),
    lpg_site_id: Number(h["lpg_site_id"] ?? 0),
    customer_code: String(h["customer_code"] ?? ""),
    transaction_date: String(h["transaction_date"] ?? ""),
    wiwo_type: (h["wiwo_type"] as ConsolidationWiwoHeader["wiwo_type"]) ?? "CONSUMPTION_SWAP",
    total_returned_cylinders: Number(h["total_returned_cylinders"] ?? 0),
    total_deployed_cylinders: Number(h["total_deployed_cylinders"] ?? 0),
    total_billable_kg: Number(h["total_billable_kg"] ?? 0),
    price_per_kg: Number(h["price_per_kg"] ?? 0),
    gross_amount: Number(h["gross_amount"] ?? 0),
    discount_amount: Number(h["discount_amount"] ?? 0),
    vat_amount: Number(h["vat_amount"] ?? 0),
    net_amount: Number(h["net_amount"] ?? 0),
    wiwo_status: (h["wiwo_status"] as ConsolidationWiwoHeader["wiwo_status"]) ?? "DRAFT",
    remarks: h["remarks"] ? String(h["remarks"]) : null,
    details,
  };
}

/**
 * Patches a WIWO detail line with reviewer-corrected weight values.
 */
export async function repoPatchWiwoDetail(
  detailId: number,
  data: Partial<Record<string, unknown>>
): Promise<void> {
  await directusFetch(
    `${DIRECTUS_URL}/items/lpg_wiwo_details/${detailId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

/**
 * Patches the WIWO header summary totals (total_billable_kg, amounts) after detail adjustment.
 */
export async function repoPatchWiwoHeader(
  wiwoHeaderId: number,
  data: Partial<Record<string, unknown>>
): Promise<void> {
  await directusFetch(
    `${DIRECTUS_URL}/items/lpg_wiwo_headers/${wiwoHeaderId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

// ─── Transaction Update ───────────────────────────────────────────────────────

/**
 * Patches a metered-WIWO child transaction row (e.g. metered_kg, wiwo_kg, billable_kg, amounts).
 */
export async function repoPatchTransaction(
  txId: number,
  data: Partial<Record<string, unknown>>
): Promise<void> {
  await directusFetch(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions/${txId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

// ─── Billing Header Update ────────────────────────────────────────────────────

/**
 * Patches the billing header (e.g. to approve it or update totals).
 */
export async function repoPatchHeader(
  headerId: number,
  data: Partial<Record<string, unknown>>
): Promise<void> {
  await directusFetch(
    `${DIRECTUS_URL}/items/lpg_transaction_headers/${headerId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

// ─── Attachments ──────────────────────────────────────────────────────────────

/**
 * Fetches all attachments for a given transaction.
 */
export async function repoFetchAttachments(transactionId: number): Promise<ConsolidationAttachment[]> {
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_attachments?filter[transaction_id][_eq]=${transactionId}&limit=-1`
  );
  return (res.data ?? []).map((a) => ({
    id: Number(a["id"]),
    transaction_id: Number(a["transaction_id"]),
    site_cylinder_id: a["site_cylinder_id"] ? Number(a["site_cylinder_id"]) : null,
    cylinder_asset_id: a["cylinder_asset_id"] ? Number(a["cylinder_asset_id"]) : null,
    attachment_type: (a["attachment_type"] as ConsolidationAttachment["attachment_type"]) ?? "GENERAL_PHOTO",
    directus_file_id: String(a["directus_file_id"] ?? ""),
    created_by: a["created_by"] ? Number(a["created_by"]) : null,
    created_at: String(a["created_at"] ?? ""),
  }));
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────

/**
 * Fetches audit log entries for a given transaction ID, newest first.
 */
export async function repoFetchAuditTrail(transactionId: number): Promise<ConsolidationAuditEntry[]> {
  const res = await directusFetch<{ data: Record<string, unknown>[] }>(
    `${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_audit?filter[transaction_id][_eq]=${transactionId}&sort=-modified_date&limit=100`
  );
  return (res.data ?? []).map((a) => ({
    audit_id: Number(a["audit_id"]),
    transaction_id: Number(a["transaction_id"]),
    transaction_no: String(a["transaction_no"] ?? ""),
    action_type: String(a["action_type"] ?? "UPDATE"),
    changes_payload: (a["changes_payload"] as ConsolidationAuditEntry["changes_payload"]) ?? {},
    modified_by: a["modified_by"] ? Number(a["modified_by"]) : null,
    modified_date: String(a["modified_date"] ?? ""),
  }));
}

/**
 * Inserts one audit trail entry for a reviewer adjustment.
 * changesPayload format: { "column_name": { "old": oldValue, "new": newValue } }
 */
export async function repoInsertAuditEntry(entry: {
  transaction_id: number;
  transaction_no: string;
  action_type: string;
  changes_payload: Record<string, { old: unknown; new: unknown }>;
  modified_by: number | null;
}): Promise<void> {
  await directusFetch(`${DIRECTUS_URL}/items/lpg_metered_wiwo_transactions_audit`, {
    method: "POST",
    body: JSON.stringify({
      transaction_id: entry.transaction_id,
      transaction_no: entry.transaction_no,
      action_type: entry.action_type,
      changes_payload: entry.changes_payload,
      modified_by: entry.modified_by,
      modified_date: new Date().toISOString(),
    }),
  });
}

// ─── Sales Invoice & Consolidation ───────────────────────────────────────────

/**
 * Creates a sales invoice record.
 */
export async function repoCreateSalesInvoice(data: Record<string, unknown>): Promise<{ id: number; invoice_no: string }> {
  const res = await directusFetch<{ data: { invoice_id: number; invoice_no: string } }>(
    `${DIRECTUS_URL}/items/sales_invoice`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  return {
    id: res.data.invoice_id,
    invoice_no: res.data.invoice_no,
  };
}

/**
 * Creates a link in lpg_transaction_header_invoices.
 */
export async function repoLinkHeaderInvoice(data: Record<string, unknown>): Promise<void> {
  await directusFetch(`${DIRECTUS_URL}/items/lpg_transaction_header_invoices`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Resolves salesman ID for a given user ID.
 */
export async function repoResolveSalesmanId(userId: number): Promise<number | null> {
  try {
    const res = await directusFetch<{ data: { id: number }[] }>(
      `${DIRECTUS_URL}/items/salesman?filter[user_id][_eq]=${userId}&fields=id&limit=1`
    );
    if (res.data && res.data.length > 0) {
      return res.data[0].id;
    }
  } catch (err) {
    console.error("Failed to resolve salesman_id for user:", err);
  }
  return null;
}

/**
 * Fetches active customer site cylinders for a given site ID (used for onboarding baseline).
 */
// Refactored from any[] to ActiveCylinderRaw[] to resolve ESLint typescript-eslint/no-explicit-any and compile issues
export async function repoFetchActiveCylindersBySite(siteId: number): Promise<ActiveCylinderRaw[]> {
  const filter = encodeURIComponent(
    JSON.stringify({
      lpg_site_id: { _eq: siteId },
      removed_date: { _null: true },
    })
  );
  const fields = [
    "id",
    "lpg_site_id",
    "customer_code",
    "previous_lpg_kg",
    "current_lpg_kg",
    "installed_date",
    "cylinder_asset_id.id",
    "cylinder_asset_id.serial_number",
    "cylinder_asset_id.tare_weight",
    "cylinder_asset_id.product_id.product_name",
  ].join(",");

  // Refactored response payload type to ActiveCylinderRaw[] to resolve ESLint warning and compile issues
  const res = await directusFetch<{ data: ActiveCylinderRaw[] }>(
    `${DIRECTUS_URL}/items/lpg_customer_site_cylinders?fields=${fields}&filter=${filter}&limit=-1`
  );
  return res.data ?? [];
}

/**
 * Fetches the first branch ID from the branches collection.
 * Tries active branches first, then fallback to any branch, and lastly defaults to 1.
 */
export async function repoFetchFirstBranchId(): Promise<number> {
  try {
    const res = await directusFetch<{ data: { id: number }[] }>(
      `${DIRECTUS_URL}/items/branches?limit=1&filter[isActive][_eq]=1&fields=id`
    );
    if (res.data && res.data.length > 0) {
      return Number(res.data[0].id);
    }
    const fallbackRes = await directusFetch<{ data: { id: number }[] }>(
      `${DIRECTUS_URL}/items/branches?limit=1&fields=id`
    );
    if (fallbackRes.data && fallbackRes.data.length > 0) {
      return Number(fallbackRes.data[0].id);
    }
  } catch (err) {
    console.error("Failed to query branches table:", err);
  }
  return 1;
}



