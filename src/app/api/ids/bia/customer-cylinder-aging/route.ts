/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/ids/bia/customer-cylinder-aging/route.ts
// ──────────────────────────────────────────────────────────────────────────────
// BFF route for Customer Cylinder Aging — powered by Directus.
// Replaces the Spring Boot dependency entirely.
//
// Multi-step fetch strategy (Directus can't join via non-PK string FKs):
//   Step 1: Fetch cylinder_assets (flat) with product_id.* and current_branch_id.*
//           (these use standard integer PKs and work as nested fields)
//   Step 2: Collect unique current_customer_code strings from results
//   Step 3: Fetch customer table by customer_code[_in] list
//   Step 4: Join customer data in JS, compute all derived aging fields
//
// NOTE: current_customer_code → customer.customer_code (VARCHAR FK, not PK `id`).
//       Directus cannot auto-join this as a nested field because it tries to use
//       customer.id, getting NaN. We fetch customers separately instead.
//
// Pattern mirrors: src/app/api/ids/scm/supplier-management/purchase-order-posting/route.ts
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import type {
  CustomerCylinderAgingRecord,
  CustomerActivityStatus,
  RecommendedAction,
  AgingBasisSource,
  CylinderStatus,
  CylinderCondition,
  CustomerCylinderAgingSummary,
  CustomerTransactionHistoryRecord,
  CustomerCylinderDetail,
} from "@/modules/industrial-distribution-system/bia/customer-cylinder-aging/types/customer-cylinder-aging.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Directus helpers ──────────────────────────────────────────────────────────
function getDirectusBase(): string {
  const raw = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).trim().replace(/\/$/, "");
  if (!raw) throw new Error("Directus base URL is not configured.");
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

function getDirectusToken(): string {
  const token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || "").trim();
  if (!token) throw new Error("DIRECTUS_STATIC_TOKEN is not configured.");
  return token;
}

function directusHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getDirectusToken()}`,
  };
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { headers: directusHeaders(), cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errors = json?.errors as Array<{ message: string }> | undefined;
    const msg = errors?.[0]?.message || `Directus error ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json as T;
}

/** Splits an array into chunks of size n — prevents huge IN-clause URLs. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Raw Directus shapes ───────────────────────────────────────────────────────

/** cylinder_assets row — customer fetched separately (VARCHAR FK, not PK). */
interface DirectusCylinderAsset {
  id: number;
  serial_number: string;
  // product_id uses a standard integer PK — nested expand works
  product_id: {
    product_id: number;
    product_code: string | null;
    product_name: string | null;
    product_weight: number | null;
  } | number | null;
  cylinder_status: string;
  cylinder_condition: string;
  // current_customer_code is a VARCHAR FK → fetched flat, joined in JS
  current_customer_code: string | null;
  // current_branch_id uses standard integer PK — nested expand works
  current_branch_id: {
    id: number;
    branch_name: string | null;
    branch_code: string | null;
  } | number | null;
  acquisition_date: string | null;
  expiration_date: string | null;
  tare_weight: number | string | null;
  cost: number | string | null;
  modified_date: string | null;
  created_date: string | null;
  is_deleted: number;
}

/** Customer row fetched by customer_code IN list. */
interface DirectusCustomer {
  customer_code: string;
  customer_name: string | null;
  store_name: string | null;
  contact_number: string | null;
  customer_email: string | null;
  brgy: string | null;
  city: string | null;
  province: string | null;
}

interface DirectusListResponse<T> {
  data: T[];
}

// ── Date math helpers ─────────────────────────────────────────────────────────
/**
 * Formats a timestamp/date string into YYYY-MM-DD.
 * Handles both Space and T delimiters.
 */
function toDateStr(dt: string | null | undefined): string | null {
  if (!dt) return null;
  return dt.split(/[ T]/)[0];
}

/**
 * Replicates TO_DAYS(CURDATE()) - TO_DAYS(date) exactly by ignoring time portion.
 */
function daysDiff(fromStr: string): number {
  const targetDate = new Date(fromStr);
  if (isNaN(targetDate.getTime())) return 0;
  
  const now = new Date();
  const date1 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const date2 = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  
  return Math.floor((date1 - date2) / 86_400_000);
}

// ── Coalesce helpers for robust data handling ────────────────────────────────
function coalesceStr(...vals: (string | null | undefined)[]): string | null {
  for (const val of vals) {
    if (val && typeof val === "string" && val.trim() !== "") {
      return val;
    }
  }
  return null;
}

function coalesceNum(...vals: (number | string | null | undefined)[]): number | null {
  for (const val of vals) {
    if (val !== null && val !== undefined && val !== "") {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

// ── Status/action computers — exact SQL CASE thresholds ──────────────────────
function computeActivityStatus(daysSince: number | null): CustomerActivityStatus {
  if (daysSince === null) return "NO_TRANSACTION_RECORD";
  if (daysSince <= 7) return "ACTIVE";
  if (daysSince <= 15) return "MONITORING";
  if (daysSince <= 30) return "WARNING";
  if (daysSince <= 60) return "INACTIVE";
  return "CRITICAL";
}

function computeRecommendedAction(daysSince: number | null): RecommendedAction {
  if (daysSince === null) return "VERIFY_CUSTOMER";
  if (daysSince >= 61) return "FOR_PULL_OUT_REVIEW";
  if (daysSince >= 31) return "FOLLOW_UP_CUSTOMER";
  if (daysSince >= 16) return "MONITOR_CUSTOMER";
  return "NO_ACTION_REQUIRED";
}

// ── Unified Transaction Structure ────────────────────────────────────────────
interface UnifiedTransaction {
  source_row_id: number;
  source_module: "POS" | "BULK";
  transaction_source: "POS_TRANSACTION" | "BULK_SALES_ORDER";
  customer_code: string;
  product_id: number;
  branch_id: number | null;
  invoice_id: number | null;
  invoice_no: string | null;
  sales_order_id: number | null;
  order_no: string | null;
  pos_transaction_id: string | null;
  consolidator_id: number | null;
  consolidator_no: string | null;
  dispatch_id: number | null;
  dispatch_no: string | null;
  post_dispatch_doc_no: string | null;
  transaction_date: string;
  serial_number: string;
  movement_type: "IN" | "OUT";
  total_amount: number | null;
  gross_amount: number | null;
  discount_amount: number;
  net_amount: number | null;
  customer_mapping_confidence: "EXACT" | "AMBIGUOUS_DISPATCH_PRODUCT" | null;
  is_countable_for_aging: number;
}

// ── Multi-collection Fetch & Join Pipeline ───────────────────────────────────
/**
 * Replicates the database view union and inner/left joins in JavaScript.
 * Minimizes Directus roundtrips by using chunked queries and maps.
 */
async function fetchTransactionsForSerials(
  base: string,
  serials: string[]
): Promise<UnifiedTransaction[]> {
  const allTransactions: UnifiedTransaction[] = [];
  if (serials.length === 0) return allTransactions;

  // 1. Fetch POS transaction mappings
  const posSerials: any[] = [];
  for (const chunkSerials of chunk(serials, 200)) {
    const encoded = encodeURIComponent(chunkSerials.join(","));
    const url = `${base}/items/pos_transaction_serial?limit=-1` +
      `&filter[serial_number][_in]=${encoded}` +
      `&filter[movement_type][_eq]=OUT` +
      `&fields=id,sales_invoice_id,pos_transaction_id,product_id,serial_number,movement_type,created_at`;
    const res = await fetchJson<DirectusListResponse<any>>(url);
    if (res?.data) posSerials.push(...res.data);
  }

  // Gather unique Sales Invoice and POS Transaction IDs
  const invoiceIds = Array.from(
    new Set(
      posSerials.map((p) => {
        if (p.sales_invoice_id && typeof p.sales_invoice_id === "object") {
          return p.sales_invoice_id.invoice_id;
        }
        return p.sales_invoice_id;
      }).filter(Boolean) as number[]
    )
  );

  const posTxIds = Array.from(
    new Set(posSerials.map((p) => p.pos_transaction_id).filter(Boolean) as string[])
  );

  // Fetch Sales Invoices in parallel chunked queries
  const salesInvoicesMap = new Map<number, any>();
  for (const chunkInvoiceIds of chunk(invoiceIds, 200)) {
    const encoded = encodeURIComponent(chunkInvoiceIds.join(","));
    const url = `${base}/items/sales_invoice?limit=-1` +
      `&filter[invoice_id][_in]=${encoded}` +
      `&fields=invoice_id,invoice_no,invoice_date,total_amount,gross_amount,discount_amount,net_amount,customer_code,branch_id,sales_type,isReplaced`;
    const res = await fetchJson<DirectusListResponse<any>>(url);
    if (res?.data) {
      for (const si of res.data) {
        if (si.invoice_id) salesInvoicesMap.set(si.invoice_id, si);
      }
    }
  }

  // Fetch POS Transaction headers
  const posTxMap = new Map<string, any>();
  if (posTxIds.length > 0) {
    for (const chunkPosTxIds of chunk(posTxIds, 200)) {
      const encoded = encodeURIComponent(chunkPosTxIds.join(","));
      const url = `${base}/items/pos_transactions?limit=-1` +
        `&filter[transaction_id][_in]=${encoded}` +
        `&fields=transaction_id,status,void_status,created_at`;
      const res = await fetchJson<DirectusListResponse<any>>(url);
      if (res?.data) {
        for (const pt of res.data) {
          if (pt.transaction_id) posTxMap.set(pt.transaction_id, pt);
        }
      }
    }
  }

  // Process POS transactions into UnifiedTransaction records
  for (const pts of posSerials) {
    const invId =
      pts.sales_invoice_id && typeof pts.sales_invoice_id === "object"
        ? pts.sales_invoice_id.invoice_id
        : pts.sales_invoice_id;
    const si = salesInvoicesMap.get(invId);
    if (!si) continue;

    // Filter matching the original SQL view WHERE conditions:
    // customer_code cannot be null, sales_type must be 5, isReplaced must be 0/false
    if (!si.customer_code) continue;
    if (si.sales_type !== 5) continue;
    const isReplaced =
      si.isReplaced === true ||
      si.isReplaced === 1 ||
      (typeof si.isReplaced === "object" &&
        si.isReplaced !== null &&
        si.isReplaced.data?.[0] === 1);
    if (isReplaced) continue;

    const pt = pts.pos_transaction_id ? posTxMap.get(pts.pos_transaction_id) : null;
    if (pt) {
      if (pt.status !== null && pt.status !== undefined && pt.status !== "COMPLETED") continue;
      if (pt.void_status !== null && pt.void_status !== undefined && pt.void_status !== "ACTIVE") continue;
    }

    const isCountable =
      pt && pt.status === "COMPLETED" && pt.void_status === "ACTIVE" && pts.movement_type === "OUT"
        ? 1
        : 0;

    const txDate = coalesceStr(si.invoice_date, pt?.created_at, pts.created_at);
    if (!txDate) continue;

    allTransactions.push({
      source_row_id: pts.id,
      source_module: "POS",
      transaction_source: "POS_TRANSACTION",
      customer_code: si.customer_code,
      product_id: pts.product_id,
      branch_id: si.branch_id,
      invoice_id: si.invoice_id,
      invoice_no: si.invoice_no,
      sales_order_id: null,
      order_no: null,
      pos_transaction_id: pts.pos_transaction_id,
      consolidator_id: null,
      consolidator_no: null,
      dispatch_id: null,
      dispatch_no: null,
      post_dispatch_doc_no: null,
      transaction_date: txDate,
      serial_number: pts.serial_number,
      movement_type: "OUT",
      total_amount: coalesceNum(si.total_amount),
      gross_amount: coalesceNum(si.gross_amount),
      discount_amount: Number(si.discount_amount || 0),
      net_amount: coalesceNum(si.net_amount),
      customer_mapping_confidence: "EXACT",
      is_countable_for_aging: isCountable,
    });
  }

  // 2. Fetch Bulk / Consolidator mappings
  const csmMappings: any[] = [];
  for (const chunkSerials of chunk(serials, 200)) {
    const encoded = encodeURIComponent(chunkSerials.join(","));
    const url = `${base}/items/consolidator_serial_mappings?limit=-1` +
      `&filter[serial_number][_in]=${encoded}` +
      `&fields=id,serial_number,scanned_at,detail_id.id,detail_id.product_id,detail_id.consolidator_id.id,detail_id.consolidator_id.consolidator_no,detail_id.consolidator_id.status,detail_id.consolidator_id.branch_id,detail_id.consolidator_id.is_delete`;
    const res = await fetchJson<DirectusListResponse<any>>(url);
    if (res?.data) csmMappings.push(...res.data);
  }

  const detailIds = Array.from(
    new Set(
      csmMappings.map((c) => {
        if (c.detail_id && typeof c.detail_id === "object") return c.detail_id.id;
        return c.detail_id;
      }).filter(Boolean) as number[]
    )
  );

  const detailsMap = new Map<number, any>();
  const consolidatorIds = new Set<number>();

  // Extract details from nested elements if resolved
  for (const c of csmMappings) {
    if (c.detail_id && typeof c.detail_id === "object") {
      detailsMap.set(c.detail_id.id, c.detail_id);
      const ch = c.detail_id.consolidator_id;
      if (ch && typeof ch === "object") {
        consolidatorIds.add(ch.id);
      }
    }
  }

  // Fetch consolidator details if returned as primitive IDs
  const missingDetailIds = detailIds.filter((id) => !detailsMap.has(id));
  if (missingDetailIds.length > 0) {
    for (const chunkDetailIds of chunk(missingDetailIds, 200)) {
      const encoded = encodeURIComponent(chunkDetailIds.join(","));
      const url = `${base}/items/consolidator_details?limit=-1` +
        `&filter[id][_in]=${encoded}` +
        `&fields=id,product_id,consolidator_id`;
      const res = await fetchJson<DirectusListResponse<any>>(url);
      if (res?.data) {
        for (const cd of res.data) {
          detailsMap.set(cd.id, cd);
          if (cd.consolidator_id) {
            const chId =
              typeof cd.consolidator_id === "object" ? cd.consolidator_id.id : cd.consolidator_id;
            consolidatorIds.add(chId);
          }
        }
      }
    }
  }

  // Fetch consolidator headers
  const consolidatorsMap = new Map<number, any>();
  for (const c of csmMappings) {
    if (
      c.detail_id &&
      typeof c.detail_id === "object" &&
      c.detail_id.consolidator_id &&
      typeof c.detail_id.consolidator_id === "object"
    ) {
      consolidatorsMap.set(c.detail_id.consolidator_id.id, c.detail_id.consolidator_id);
    }
  }

  const missingConsolidatorIds = Array.from(consolidatorIds).filter((id) => !consolidatorsMap.has(id));
  if (missingConsolidatorIds.length > 0) {
    for (const chunkConsIds of chunk(missingConsolidatorIds, 200)) {
      const encoded = encodeURIComponent(chunkConsIds.join(","));
      const url = `${base}/items/consolidator?limit=-1` +
        `&filter[id][_in]=${encoded}` +
        `&fields=id,consolidator_no,status,branch_id,is_delete`;
      const res = await fetchJson<DirectusListResponse<any>>(url);
      if (res?.data) {
        for (const ch of res.data) {
          consolidatorsMap.set(ch.id, ch);
        }
      }
    }
  }

  const chIds = Array.from(consolidatorsMap.keys());
  if (chIds.length === 0) return allTransactions;

  // Fetch consolidator dispatches
  const consolidatorDispatches: any[] = [];
  for (const chunkChIds of chunk(chIds, 200)) {
    const encoded = encodeURIComponent(chunkChIds.join(","));
    const url = `${base}/items/consolidator_dispatches?limit=-1` +
      `&filter[consolidator_id][_in]=${encoded}` +
      `&fields=id,consolidator_id,dispatch_no`;
    const res = await fetchJson<DirectusListResponse<any>>(url);
    if (res?.data) consolidatorDispatches.push(...res.data);
  }

  const dispatchNos = Array.from(
    new Set(consolidatorDispatches.map((cdisp) => cdisp.dispatch_no).filter(Boolean) as string[])
  );
  if (dispatchNos.length === 0) return allTransactions;

  // Fetch dispatch plans
  const dispatchPlansMap = new Map<string, any>();
  for (const chunkDispatchNos of chunk(dispatchNos, 200)) {
    const encoded = encodeURIComponent(chunkDispatchNos.join(","));
    const url = `${base}/items/dispatch_plan?limit=-1` +
      `&filter[dispatch_no][_in]=${encoded}` +
      `&fields=dispatch_id,dispatch_no,dispatch_date,status,branch_id,is_delete`;
    const res = await fetchJson<DirectusListResponse<any>>(url);
    if (res?.data) {
      for (const dp of res.data) {
        if (dp.dispatch_no) dispatchPlansMap.set(dp.dispatch_no, dp);
      }
    }
  }

  const dispatchIds = Array.from(dispatchPlansMap.values())
    .map((dp) => dp.dispatch_id)
    .filter(Boolean) as number[];
  if (dispatchIds.length === 0) return allTransactions;

  // Fetch dispatch plan details
  const dispatchPlanDetails: any[] = [];
  for (const chunkDpIds of chunk(dispatchIds, 200)) {
    const encoded = encodeURIComponent(chunkDpIds.join(","));
    const url = `${base}/items/dispatch_plan_details?limit=-1` +
      `&filter[dispatch_id][_in]=${encoded}` +
      `&fields=detail_id,dispatch_id,sales_order_id`;
    const res = await fetchJson<DirectusListResponse<any>>(url);
    if (res?.data) dispatchPlanDetails.push(...res.data);
  }

  const salesOrderIds = Array.from(
    new Set(dispatchPlanDetails.map((dpd) => dpd.sales_order_id).filter(Boolean) as number[])
  );
  if (salesOrderIds.length === 0) return allTransactions;

  // Fetch sales orders
  const salesOrdersMap = new Map<number, any>();
  for (const chunkSoIds of chunk(salesOrderIds, 200)) {
    const encoded = encodeURIComponent(chunkSoIds.join(","));
    const url = `${base}/items/sales_order?limit=-1` +
      `&filter[order_id][_in]=${encoded}` +
      `&fields=order_id,order_no,customer_code,order_date,delivery_date,delivered_at,order_status,total_amount,discount_amount,net_amount,isCancelled`;
    const res = await fetchJson<DirectusListResponse<any>>(url);
    if (res?.data) {
      for (const so of res.data) {
        if (so.order_id) salesOrdersMap.set(so.order_id, so);
      }
    }
  }

  // Fetch sales order details
  const sodsMap = new Map<string, any>();
  for (const chunkSoIds of chunk(salesOrderIds, 200)) {
    const encoded = encodeURIComponent(chunkSoIds.join(","));
    const url = `${base}/items/sales_order_details?limit=-1` +
      `&filter[order_id][_in]=${encoded}` +
      `&fields=order_id,product_id,gross_amount,net_amount`;
    const res = await fetchJson<DirectusListResponse<any>>(url);
    if (res?.data) {
      for (const sod of res.data) {
        const orderId = typeof sod.order_id === "object" ? sod.order_id?.order_id : sod.order_id;
        const prodId = typeof sod.product_id === "object" ? sod.product_id?.product_id : sod.product_id;
        if (orderId && prodId) {
          sodsMap.set(`${orderId}-${prodId}`, sod);
        }
      }
    }
  }

  // Fetch sales invoices for bulk customers
  const customerCodes = Array.from(
    new Set(
      Array.from(salesOrdersMap.values())
        .map((so) => so.customer_code)
        .filter(Boolean) as string[]
    )
  );
  const bulkSalesInvoices: any[] = [];
  if (customerCodes.length > 0) {
    for (const chunkCustCodes of chunk(customerCodes, 200)) {
      const encoded = encodeURIComponent(chunkCustCodes.join(","));
      const url = `${base}/items/sales_invoice?limit=-1` +
        `&filter[customer_code][_in]=${encoded}` +
        `&fields=invoice_id,invoice_no,invoice_date,total_amount,gross_amount,discount_amount,net_amount,customer_code,order_id,isReplaced`;
      const res = await fetchJson<DirectusListResponse<any>>(url);
      if (res?.data) bulkSalesInvoices.push(...res.data);
    }
  }

  const matchedInvoicesMap = new Map<string, any>();
  for (const si of bulkSalesInvoices) {
    if (!si.customer_code || !si.order_id) continue;
    const isReplaced =
      si.isReplaced === true ||
      si.isReplaced === 1 ||
      (typeof si.isReplaced === "object" &&
        si.isReplaced !== null &&
        si.isReplaced.data?.[0] === 1);
    if (isReplaced) continue;
    matchedInvoicesMap.set(`${si.customer_code}-${String(si.order_id).trim()}`, si);
  }

  const bulkInvoiceIds = Array.from(new Set(bulkSalesInvoices.map((si) => si.invoice_id).filter(Boolean) as number[]));

  // Fetch post_dispatch_invoices details
  const postDispatchInvoicesMap = new Map<number, any>();
  if (bulkInvoiceIds.length > 0) {
    for (const chunkInvIds of chunk(bulkInvoiceIds, 200)) {
      const encoded = encodeURIComponent(chunkInvIds.join(","));
      const url = `${base}/items/post_dispatch_invoices?limit=-1` +
        `&filter[invoice_id][_in]=${encoded}` +
        `&fields=id,invoice_id,status,isCleared,post_dispatch_plan_id.id,post_dispatch_plan_id.doc_no,post_dispatch_plan_id.status,post_dispatch_plan_id.time_of_dispatch,post_dispatch_plan_id.time_of_arrival`;
      const res = await fetchJson<DirectusListResponse<any>>(url);
      if (res?.data) {
        for (const pdi of res.data) {
          if (pdi.invoice_id) postDispatchInvoicesMap.set(pdi.invoice_id, pdi);
        }
      }
    }
  }

  const pdPlanIds = Array.from(
    new Set(
      Array.from(postDispatchInvoicesMap.values())
        .map((pdi) => {
          if (pdi.post_dispatch_plan_id && typeof pdi.post_dispatch_plan_id === "object") {
            return pdi.post_dispatch_plan_id.id;
          }
          return pdi.post_dispatch_plan_id;
        })
        .filter(Boolean) as number[]
    )
  );

  const postDispatchPlansMap = new Map<number, any>();
  for (const pdi of postDispatchInvoicesMap.values()) {
    if (pdi.post_dispatch_plan_id && typeof pdi.post_dispatch_plan_id === "object") {
      postDispatchPlansMap.set(pdi.post_dispatch_plan_id.id, pdi.post_dispatch_plan_id);
    }
  }

  const missingPdPlanIds = pdPlanIds.filter((id) => !postDispatchPlansMap.has(id));
  if (missingPdPlanIds.length > 0) {
    for (const chunkPdPlanIds of chunk(missingPdPlanIds, 200)) {
      const encoded = encodeURIComponent(chunkPdPlanIds.join(","));
      const url = `${base}/items/post_dispatch_plan?limit=-1` +
        `&filter[id][_in]=${encoded}` +
        `&fields=id,doc_no,status,time_of_dispatch,time_of_arrival`;
      const res = await fetchJson<DirectusListResponse<any>>(url);
      if (res?.data) {
        for (const pdp of res.data) {
          postDispatchPlansMap.set(pdp.id, pdp);
        }
      }
    }
  }

  // Join Bulk mapping paths in memory
  const csmCandidates = new Map<number, any[]>();
  for (const csm of csmMappings) {
    const detId =
      csm.detail_id && typeof csm.detail_id === "object" ? csm.detail_id.id : csm.detail_id;
    const cd = detailsMap.get(detId);
    if (!cd) continue;

    const chId = typeof cd.consolidator_id === "object" ? cd.consolidator_id.id : cd.consolidator_id;
    const ch = consolidatorsMap.get(chId);
    if (!ch) continue;

    const chDeleted =
      ch.is_delete === true ||
      ch.is_delete === 1 ||
      (typeof ch.is_delete === "object" && ch.is_delete !== null && ch.is_delete.data?.[0] === 1);
    if (chDeleted) continue;

    const matchingDispatches = consolidatorDispatches.filter((cdisp) => cdisp.consolidator_id === ch.id);
    for (const cdisp of matchingDispatches) {
      const dp = dispatchPlansMap.get(cdisp.dispatch_no);
      if (!dp) continue;

      const dpDeleted =
        dp.is_delete === true ||
        dp.is_delete === 1 ||
        (typeof dp.is_delete === "object" && dp.is_delete !== null && dp.is_delete.data?.[0] === 1);
      if (dpDeleted) continue;

      const matchingDpd = dispatchPlanDetails.filter((dpd) => dpd.dispatch_id === dp.dispatch_id);
      for (const dpd of matchingDpd) {
        const so = salesOrdersMap.get(dpd.sales_order_id);
        if (!so) continue;

        const soCancelled =
          so.isCancelled === true ||
          so.isCancelled === 1 ||
          (typeof so.isCancelled === "object" &&
            so.isCancelled !== null &&
            so.isCancelled.data?.[0] === 1);
        if (soCancelled) continue;
        if (!so.customer_code) continue;

        const sod = sodsMap.get(`${so.order_id}-${cd.product_id}`);
        if (!sod) continue;

        if (!csmCandidates.has(csm.id)) csmCandidates.set(csm.id, []);
        csmCandidates.get(csm.id)!.push({ csm, cd, ch, dp, so, sod });
      }
    }
  }

  // Reconstruct candidate entries into UnifiedTransaction rows
  for (const candidates of csmCandidates.values()) {
    const candidate_row_count = candidates.length;
    if (candidate_row_count === 0) continue;

    for (const cand of candidates) {
      const { csm, cd, ch, dp, so, sod } = cand;

      let si = matchedInvoicesMap.get(`${so.customer_code}-${String(so.order_no).trim()}`);
      if (!si) {
        si = matchedInvoicesMap.get(`${so.customer_code}-${String(so.order_id).trim()}`);
      }

      const lpdi = si ? postDispatchInvoicesMap.get(si.invoice_id) : null;
      const pdp = lpdi
        ? typeof lpdi.post_dispatch_plan_id === "object"
          ? lpdi.post_dispatch_plan_id
          : postDispatchPlansMap.get(lpdi.post_dispatch_plan_id)
        : null;

      let isCountable = 0;
      const lpdiStatus = lpdi?.status;
      if (
        lpdiStatus &&
        ["Fulfilled", "Fulfilled With Returns", "Fulfilled With Concerns"].includes(lpdiStatus)
      ) {
        isCountable = 1;
      } else if (
        !lpdiStatus &&
        so.order_status &&
        ["Delivered", "For Loading", "For Shipping", "En Route"].includes(so.order_status)
      ) {
        isCountable = 1;
      }

      const txDate = coalesceStr(
        pdp?.time_of_arrival,
        pdp?.time_of_dispatch,
        si?.invoice_date,
        so.delivered_at,
        dp.dispatch_date,
        csm.scanned_at,
        so.order_date
      );

      if (!txDate) continue;

      allTransactions.push({
        source_row_id: csm.id,
        source_module: "BULK",
        transaction_source: "BULK_SALES_ORDER",
        customer_code: so.customer_code,
        product_id: cd.product_id,
        branch_id: dp.branch_id ?? ch.branch_id ?? null,
        invoice_id: si?.invoice_id ?? null,
        invoice_no: si?.invoice_no ?? null,
        sales_order_id: so.order_id,
        order_no: so.order_no,
        pos_transaction_id: null,
        consolidator_id: ch.id,
        consolidator_no: ch.consolidator_no,
        dispatch_id: dp.dispatch_id,
        dispatch_no: dp.dispatch_no,
        post_dispatch_doc_no: pdp?.doc_no ?? null,
        transaction_date: txDate,
        serial_number: csm.serial_number,
        movement_type: "OUT",
        total_amount: coalesceNum(si?.total_amount, so.total_amount),
        gross_amount: coalesceNum(si?.gross_amount, sod.gross_amount),
        discount_amount: Number(si?.discount_amount ?? so.discount_amount ?? 0),
        net_amount: coalesceNum(si?.net_amount, so.net_amount, sod.net_amount),
        customer_mapping_confidence: candidate_row_count === 1 ? "EXACT" : "AMBIGUOUS_DISPATCH_PRODUCT",
        is_countable_for_aging: isCountable,
      });
    }
  }

  return allTransactions;
}

// ── Transform raw row + customer map → CustomerCylinderAgingRecord ────────────
function transform(
  raw: DirectusCylinderAsset,
  customerMap: Map<string, DirectusCustomer>,
  latestOutTxMap: Map<string, UnifiedTransaction>,
  lastCustomerTxMap: Map<string, UnifiedTransaction>
): CustomerCylinderAgingRecord {
  // Nested product
  const product = raw.product_id && typeof raw.product_id === "object" ? raw.product_id : null;

  // Nested branch
  const branch =
    raw.current_branch_id && typeof raw.current_branch_id === "object"
      ? raw.current_branch_id
      : null;

  // Customer — joined from the separately-fetched map
  const customerCode = raw.current_customer_code ?? "";
  const customer = customerMap.get(customerCode) ?? null;

  // Address — CONCAT_WS(', ', brgy, city, province)
  const addressParts = [customer?.brgy, customer?.city, customer?.province]
    .filter(Boolean)
    .join(", ");

  // Retrieve matching transactions
  const latestOut = latestOutTxMap.get(`${customerCode}-${raw.serial_number}`) ?? null;
  const lastTx = lastCustomerTxMap.get(customerCode) ?? null;

  // Aging basis: COALESCE(latest_out.transaction_date, modified_date, created_date)
  const deployedTxDate = latestOut?.transaction_date ?? null;
  const deployedDate = toDateStr(deployedTxDate);
  const agingRaw = deployedTxDate ?? raw.modified_date ?? raw.created_date ?? null;
  const agingBasisDate = toDateStr(agingRaw);
  
  let agingBasisSource: AgingBasisSource | null = null;
  if (deployedTxDate) {
    agingBasisSource = "DEPLOYED_DATE";
  } else if (raw.modified_date) {
    agingBasisSource = "CYLINDER_MODIFIED_DATE_FALLBACK";
  } else if (raw.created_date) {
    agingBasisSource = "CYLINDER_CREATED_DATE_FALLBACK";
  }

  const daysWithCustomer = agingBasisDate !== null ? daysDiff(agingBasisDate) : null;

  // Last customer transaction metrics
  const lastTransactionDate = lastTx ? toDateStr(lastTx.transaction_date) : null;
  const daysSinceLastTransaction = lastTransactionDate !== null ? daysDiff(lastTransactionDate) : null;
  
  const customerActivityStatus = computeActivityStatus(daysSinceLastTransaction);
  const recommendedAction = computeRecommendedAction(daysSinceLastTransaction);

  const branchId =
    branch?.id ?? (typeof raw.current_branch_id === "number" ? raw.current_branch_id : null);

  return {
    cylinderAssetId: raw.id,
    serialNumber: raw.serial_number,

    productId: product?.product_id ?? (typeof raw.product_id === "number" ? raw.product_id : 0),
    productCode: product?.product_code ?? null,
    productName: product?.product_name ?? null,
    productWeight: product?.product_weight ?? null,

    cylinderStatus: raw.cylinder_status as CylinderStatus,
    cylinderCondition: raw.cylinder_condition as CylinderCondition,

    customerCode,
    customerName: customer?.customer_name ?? null,
    storeName: customer?.store_name ?? null,
    contactNumber: customer?.contact_number ?? null,
    customerEmail: customer?.customer_email ?? null,
    customerAddress: addressParts || null,

    branchId,
    branchName: branch?.branch_name ?? null,
    branchCode: branch?.branch_code ?? null,

    acquisitionDate: toDateStr(raw.acquisition_date),
    expirationDate: toDateStr(raw.expiration_date),
    tareWeight:
      raw.tare_weight !== null && raw.tare_weight !== undefined ? Number(raw.tare_weight) : null,
    cost: raw.cost !== null && raw.cost !== undefined ? Number(raw.cost) : null,

    // Deployed transaction context (latest OUT per cylinder+customer)
    deployedDate: deployedDate,
    deployedSourceModule: latestOut?.source_module ?? null,
    deployedTransactionSource: latestOut?.transaction_source ?? null,
    deployedInvoiceId: latestOut?.invoice_id ?? null,
    deployedInvoiceNo: latestOut?.invoice_no ?? null,
    deployedSalesOrderId: latestOut?.sales_order_id ?? null,
    deployedOrderNo: latestOut?.order_no ?? null,
    deployedPosTransactionId: latestOut?.pos_transaction_id ?? null,
    deployedConsolidatorId: latestOut?.consolidator_id ?? null,
    deployedConsolidatorNo: latestOut?.consolidator_no ?? null,
    deployedDispatchId: latestOut?.dispatch_id ?? null,
    deployedDispatchNo: latestOut?.dispatch_no ?? null,
    deployedPostDispatchDocNo: latestOut?.post_dispatch_doc_no ?? null,
    customerMappingConfidence: latestOut?.customer_mapping_confidence ?? null,

    agingBasisDate,
    agingBasisSource,
    daysWithCustomer,

    // Last transaction details (latest countable OUT per customer)
    lastTransactionDate,
    lastSourceModule: lastTx?.source_module ?? null,
    lastTransactionSource: lastTx?.transaction_source ?? null,
    lastInvoiceId: lastTx?.invoice_id ?? null,
    lastInvoiceNo: lastTx?.invoice_no ?? null,
    lastSalesOrderId: lastTx?.sales_order_id ?? null,
    lastOrderNo: lastTx?.order_no ?? null,
    lastPosTransactionId: lastTx?.pos_transaction_id ?? null,
    lastConsolidatorId: lastTx?.consolidator_id ?? null,
    lastConsolidatorNo: lastTx?.consolidator_no ?? null,
    lastDispatchId: lastTx?.dispatch_id ?? null,
    lastDispatchNo: lastTx?.dispatch_no ?? null,
    lastPostDispatchDocNo: lastTx?.post_dispatch_doc_no ?? null,
    lastNetAmount: lastTx?.net_amount ?? null,
    daysSinceLastTransaction,

    customerActivityStatus,
    recommendedAction,
  };
}

// ── Helper to fetch all historical transactions for a customer ─────────────────
async function fetchTransactionsForCustomer(
  base: string,
  customerCode: string
): Promise<CustomerTransactionHistoryRecord[]> {
  const posHistoryRecords: CustomerTransactionHistoryRecord[] = [];
  const bulkHistoryRecords: CustomerTransactionHistoryRecord[] = [];

  // 1. Fetch POS transactions for this customer
  // NOTE: isReplaced is boolean/BIT. Directus requires 'false' instead of '0'.
  const posInvoicesUrl = `${base}/items/sales_invoice?limit=-1` +
    `&filter[customer_code][_eq]=${encodeURIComponent(customerCode)}` +
    `&filter[sales_type][_eq]=5` +
    `&filter[isReplaced][_or][0][_null]=true` +
    `&filter[isReplaced][_or][1][_eq]=false` +
    `&fields=invoice_id,invoice_no,invoice_date,total_amount,gross_amount,discount_amount,net_amount`;
  
  const posInvoicesJson = await fetchJson<DirectusListResponse<any>>(posInvoicesUrl).catch(() => null);
  const invoices = posInvoicesJson?.data ?? [];
  const invoiceIds = invoices.map((inv) => inv.invoice_id).filter(Boolean);

  if (invoiceIds.length > 0) {
    const posSerials: any[] = [];
    for (const chunkIds of chunk(invoiceIds, 200)) {
      const encoded = encodeURIComponent(chunkIds.join(","));
      const url = `${base}/items/pos_transaction_serial?limit=-1` +
        `&filter[sales_invoice_id][_in]=${encoded}` +
        `&fields=id,sales_invoice_id,pos_transaction_id,product_id,serial_number,movement_type,created_at`;
      const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
      if (res?.data) posSerials.push(...res.data);
    }

    const posTxIds = Array.from(new Set(posSerials.map((p) => p.pos_transaction_id).filter(Boolean) as string[]));
    const posTxMap = new Map<string, any>();
    if (posTxIds.length > 0) {
      for (const chunkTxIds of chunk(posTxIds, 200)) {
        const encoded = encodeURIComponent(chunkTxIds.join(","));
        const url = `${base}/items/pos_transactions?limit=-1` +
          `&filter[transaction_id][_in]=${encoded}` +
          `&fields=transaction_id,status,void_status,created_at`;
        const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
        if (res?.data) {
          for (const pt of res.data) {
            posTxMap.set(pt.transaction_id, pt);
          }
        }
      }
    }

    const prodIds = Array.from(new Set(posSerials.map((p) => p.product_id).filter(Boolean) as number[]));
    const prodMap = new Map<number, any>();
    if (prodIds.length > 0) {
      for (const chunkProdIds of chunk(prodIds, 200)) {
        const encoded = encodeURIComponent(chunkProdIds.join(","));
        const url = `${base}/items/products?limit=-1` +
          `&filter[product_id][_in]=${encoded}` +
          `&fields=product_id,product_code,product_name`;
        const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
        if (res?.data) {
          for (const p of res.data) {
            prodMap.set(p.product_id, p);
          }
        }
      }
    }

    const invoicesMap = new Map(invoices.map((i) => [i.invoice_id, i]));
    for (const p of posSerials) {
      const inv = invoicesMap.get(p.sales_invoice_id);
      if (!inv) continue;
      const pt = p.pos_transaction_id ? posTxMap.get(p.pos_transaction_id) : null;
      if (pt) {
        if (pt.status !== null && pt.status !== undefined && pt.status !== "COMPLETED") continue;
        if (pt.void_status !== null && pt.void_status !== undefined && pt.void_status !== "ACTIVE") continue;
      }
      const prod = prodMap.get(p.product_id);
      const txDate = coalesceStr(inv.invoice_date, pt?.created_at, p.created_at);
      if (!txDate) continue;

      posHistoryRecords.push({
        id: `pos-${p.id}`,
        sourceModule: "POS",
        transactionSource: "POS_TRANSACTION",
        serialNumber: p.serial_number,
        movementType: p.movement_type,
        movementDescription: p.movement_type === "OUT" ? "DEPLOYED_TO_CUSTOMER" : "RETURNED_FROM_CUSTOMER",
        transactionDate: toDateStr(txDate) || txDate,
        referenceNo: inv.invoice_no || p.pos_transaction_id || null,
        productCode: prod?.product_code || null,
        productName: prod?.product_name || null,
        netAmount: coalesceNum(inv.net_amount),
      });
    }
  }

  // 2. Fetch Bulk / Consolidator mappings for this customer
  const bulkOrdersUrl = `${base}/items/sales_order?limit=-1` +
    `&filter[customer_code][_eq]=${encodeURIComponent(customerCode)}` +
    `&filter[isCancelled][_or][0][_null]=true` +
    `&filter[isCancelled][_or][1][_eq]=0` +
    `&fields=order_id,order_no,order_date,delivered_at,order_status,total_amount,discount_amount,net_amount`;
  
  const bulkOrdersJson = await fetchJson<DirectusListResponse<any>>(bulkOrdersUrl).catch(() => null);
  const orders = bulkOrdersJson?.data ?? [];
  const orderIds = orders.map((o) => o.order_id).filter(Boolean);

  if (orderIds.length > 0) {
    const dpDetails: any[] = [];
    for (const chunkIds of chunk(orderIds, 200)) {
      const encoded = encodeURIComponent(chunkIds.join(","));
      const url = `${base}/items/dispatch_plan_details?limit=-1` +
        `&filter[sales_order_id][_in]=${encoded}` +
        `&fields=detail_id,dispatch_id,sales_order_id`;
      const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
      if (res?.data) dpDetails.push(...res.data);
    }

    const dispatchIds = Array.from(new Set(dpDetails.map((d) => d.dispatch_id).filter(Boolean) as number[]));
    const dispatchPlansMap = new Map<number, any>();
    if (dispatchIds.length > 0) {
      for (const chunkIds of chunk(dispatchIds, 200)) {
        const encoded = encodeURIComponent(chunkIds.join(","));
        const url = `${base}/items/dispatch_plan?limit=-1` +
          `&filter[dispatch_id][_in]=${encoded}` +
          `&filter[is_delete][_or][0][_null]=true` +
          `&filter[is_delete][_or][1][_eq]=0` +
          `&fields=dispatch_id,dispatch_no,dispatch_date`;
        const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
        if (res?.data) {
          for (const dp of res.data) {
            dispatchPlansMap.set(dp.dispatch_id, dp);
          }
        }
      }
    }

    const dispatchNos = Array.from(new Set(Array.from(dispatchPlansMap.values()).map(dp => dp.dispatch_no).filter(Boolean) as string[]));
    const consolidatorDispatches: any[] = [];
    if (dispatchNos.length > 0) {
      for (const chunkNos of chunk(dispatchNos, 200)) {
        const encoded = encodeURIComponent(chunkNos.join(","));
        const url = `${base}/items/consolidator_dispatches?limit=-1` +
          `&filter[dispatch_no][_in]=${encoded}` +
          `&fields=consolidator_id,dispatch_no`;
        const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
        if (res?.data) consolidatorDispatches.push(...res.data);
      }
    }

    const consolidatorIds = Array.from(new Set(consolidatorDispatches.map(cd => cd.consolidator_id).filter(Boolean) as number[]));
    const consolidatorsMap = new Map<number, any>();
    if (consolidatorIds.length > 0) {
      for (const chunkIds of chunk(consolidatorIds, 200)) {
        const encoded = encodeURIComponent(chunkIds.join(","));
        const url = `${base}/items/consolidator?limit=-1` +
          `&filter[id][_in]=${encoded}` +
          `&filter[is_delete][_or][0][_null]=true` +
          `&filter[is_delete][_or][1][_eq]=0` +
          `&fields=id,consolidator_no`;
        const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
        if (res?.data) {
          for (const c of res.data) {
            consolidatorsMap.set(c.id, c);
          }
        }
      }
    }

    const consolidatorDetails: any[] = [];
    if (consolidatorIds.length > 0) {
      for (const chunkIds of chunk(consolidatorIds, 200)) {
        const encoded = encodeURIComponent(chunkIds.join(","));
        const url = `${base}/items/consolidator_details?limit=-1` +
          `&filter[consolidator_id][_in]=${encoded}` +
          `&fields=id,consolidator_id,product_id`;
        const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
        if (res?.data) consolidatorDetails.push(...res.data);
      }
    }

    const detailIds = consolidatorDetails.map(cd => cd.id).filter(Boolean);
    const mappings: any[] = [];
    if (detailIds.length > 0) {
      for (const chunkIds of chunk(detailIds, 200)) {
        const encoded = encodeURIComponent(chunkIds.join(","));
        const url = `${base}/items/consolidator_serial_mappings?limit=-1` +
          `&filter[detail_id][_in]=${encoded}` +
          `&fields=id,serial_number,scanned_at,detail_id`;
        const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
        if (res?.data) mappings.push(...res.data);
      }
    }

    const sodsMap = new Map<string, any>();
    for (const chunkIds of chunk(orderIds, 200)) {
      const encoded = encodeURIComponent(chunkIds.join(","));
      const url = `${base}/items/sales_order_details?limit=-1` +
        `&filter[order_id][_in]=${encoded}` +
        `&fields=order_id,product_id,gross_amount,net_amount`;
      const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
      if (res?.data) {
        for (const sod of res.data) {
          const oId = typeof sod.order_id === "object" ? sod.order_id?.order_id : sod.order_id;
          const pId = typeof sod.product_id === "object" ? sod.product_id?.product_id : sod.product_id;
          if (oId && pId) sodsMap.set(`${oId}-${pId}`, sod);
        }
      }
    }

    const prodIds = Array.from(new Set(consolidatorDetails.map(cd => cd.product_id).filter(Boolean) as number[]));
    const prodMap = new Map<number, any>();
    if (prodIds.length > 0) {
      for (const chunkProdIds of chunk(prodIds, 200)) {
        const encoded = encodeURIComponent(chunkProdIds.join(","));
        const url = `${base}/items/products?limit=-1` +
          `&filter[product_id][_in]=${encoded}` +
          `&fields=product_id,product_code,product_name`;
        const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
        if (res?.data) {
          for (const p of res.data) {
            prodMap.set(p.product_id, p);
          }
        }
      }
    }

    const matchedInvoices: any[] = [];
    for (const chunkIds of chunk(orderIds, 200)) {
      const encoded = encodeURIComponent(chunkIds.join(","));
      // NOTE: isReplaced is boolean/BIT. Directus requires 'false' instead of '0'.
      const url = `${base}/items/sales_invoice?limit=-1` +
        `&filter[customer_code][_eq]=${encodeURIComponent(customerCode)}` +
        `&filter[order_id][_in]=${encoded}` +
        `&filter[isReplaced][_or][0][_null]=true` +
        `&filter[isReplaced][_or][1][_eq]=false` +
        `&fields=invoice_id,invoice_no,invoice_date,total_amount,gross_amount,discount_amount,net_amount,order_id`;
      const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
      if (res?.data) matchedInvoices.push(...res.data);
    }

    const matchedInvoicesMap = new Map<string, any>();
    for (const si of matchedInvoices) {
      if (si.order_id) {
        matchedInvoicesMap.set(String(si.order_id).trim(), si);
      }
    }

    const matchedInvoiceIds = matchedInvoices.map(si => si.invoice_id).filter(Boolean);
    const postDispatchInvoicesMap = new Map<number, any>();
    if (matchedInvoiceIds.length > 0) {
      for (const chunkIds of chunk(matchedInvoiceIds, 200)) {
        const encoded = encodeURIComponent(chunkIds.join(","));
        const url = `${base}/items/post_dispatch_invoices?limit=-1` +
          `&filter[invoice_id][_in]=${encoded}` +
          `&fields=id,invoice_id,status,post_dispatch_plan_id.time_of_dispatch,post_dispatch_plan_id.time_of_arrival,post_dispatch_plan_id.doc_no`;
        const res = await fetchJson<DirectusListResponse<any>>(url).catch(() => null);
        if (res?.data) {
          for (const pdi of res.data) {
            postDispatchInvoicesMap.set(pdi.invoice_id, pdi);
          }
        }
      }
    }

    const ordersMap = new Map(orders.map((o) => [o.order_id, o]));
    const consolidatorDetailsMap = new Map(consolidatorDetails.map(cd => [cd.id, cd]));

    for (const mapping of mappings) {
      const cd = consolidatorDetailsMap.get(mapping.detail_id);
      if (!cd) continue;
      const ch = consolidatorsMap.get(cd.consolidator_id);
      if (!ch) continue;

      const matchingCDs = consolidatorDispatches.filter(cdisp => cdisp.consolidator_id === ch.id);
      for (const cdisp of matchingCDs) {
        const matchingDPs = Array.from(dispatchPlansMap.values()).filter(dp => dp.dispatch_no === cdisp.dispatch_no);
        for (const dp of matchingDPs) {
          const matchingDPDs = dpDetails.filter(dpd => dpd.dispatch_id === dp.dispatch_id);
          for (const dpd of matchingDPDs) {
            const so = ordersMap.get(dpd.sales_order_id);
            if (!so) continue;

            const sod = sodsMap.get(`${so.order_id}-${cd.product_id}`);
            if (!sod) continue;

            const si = matchedInvoicesMap.get(String(so.order_id).trim()) || matchedInvoicesMap.get(String(so.order_no).trim());
            const lpdi = si ? postDispatchInvoicesMap.get(si.invoice_id) : null;
            const pdp = lpdi?.post_dispatch_plan_id;

            const txDate = coalesceStr(
              pdp?.time_of_arrival,
              pdp?.time_of_dispatch,
              si?.invoice_date,
              so.delivered_at,
              dp.dispatch_date,
              mapping.scanned_at,
              so.order_date
            );

            if (!txDate) continue;

            const prod = prodMap.get(cd.product_id);

            bulkHistoryRecords.push({
              id: `bulk-${mapping.id}`,
              sourceModule: "BULK",
              transactionSource: "BULK_SALES_ORDER",
              serialNumber: mapping.serial_number,
              movementType: "OUT",
              movementDescription: "DEPLOYED_TO_CUSTOMER",
              transactionDate: toDateStr(txDate) || txDate,
              referenceNo: si?.invoice_no || so.order_no || dp.dispatch_no || null,
              productCode: prod?.product_code || null,
              productName: prod?.product_name || null,
              netAmount: coalesceNum(si?.net_amount, so.net_amount, sod.net_amount),
            });
          }
        }
      }
    }
  }

  return [...posHistoryRecords, ...bulkHistoryRecords].sort((a, b) => {
    return new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
  });
}

// ── GET handler ───────────────────────────────────────────────────────────────
/**
 * GET /api/ids/bia/customer-cylinder-aging
 *
 * Optional query params:
 *   view         - 'customer' (summary aggregation) or 'detail' (detailed customer metrics)
 *   customerCode - exact customer code match
 *   productId    - filter by product (integer)
 *   branchId     - filter by current_branch_id (integer)
 *   startDate    - acquisition_date >= YYYY-MM-DD
 *   endDate      - acquisition_date <= YYYY-MM-DD
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const base = getDirectusBase();
    const sp = req.nextUrl.searchParams;
    const view = sp.get("view")?.trim() || "customer";
    const customerCode = sp.get("customerCode")?.trim();

    if (view === "detail") {
      if (!customerCode) {
        return NextResponse.json(
          { ok: false, message: "customerCode is required for detail view" },
          { status: 400 }
        );
      }

      // 1. Fetch customer details
      const customerUrl = `${base}/items/customer?filter[customer_code][_eq]=${encodeURIComponent(customerCode)}&limit=1&fields=customer_code,customer_name,store_name,contact_number,customer_email,brgy,city,province`;
      const customerJson = await fetchJson<DirectusListResponse<DirectusCustomer>>(customerUrl);
      const customer = customerJson?.data?.[0];
      if (!customer) {
        return NextResponse.json(
          { ok: false, message: `Customer with code ${customerCode} not found` },
          { status: 404 }
        );
      }
      const addressParts = [customer.brgy, customer.city, customer.province].filter(Boolean).join(", ");

      // 2. Fetch connected cylinders
      const qs: string[] = [
        "limit=-1",
        `filter[current_customer_code][_eq]=${encodeURIComponent(customerCode)}`,
        "fields=id,serial_number,cylinder_status,cylinder_condition,current_customer_code,acquisition_date,expiration_date,tare_weight,cost,modified_date,created_date,is_deleted",
        "fields=product_id.product_id,product_id.product_code,product_id.product_name,product_id.product_weight",
        "fields=current_branch_id.id,current_branch_id.branch_name,current_branch_id.branch_code",
        "filter[cylinder_status][_eq]=WITH_CUSTOMER",
        "filter[is_deleted][_eq]=0",
      ];

      const productId = sp.get("productId")?.trim();
      if (productId && !isNaN(Number(productId))) {
        qs.push(`filter[product_id][_eq]=${encodeURIComponent(productId)}`);
      }
      const branchId = sp.get("branchId")?.trim();
      if (branchId && !isNaN(Number(branchId))) {
        qs.push(`filter[current_branch_id][_eq]=${encodeURIComponent(branchId)}`);
      }
      const startDate = sp.get("startDate")?.trim();
      if (startDate) {
        qs.push(`filter[acquisition_date][_gte]=${encodeURIComponent(startDate)}`);
      }
      const endDate = sp.get("endDate")?.trim();
      if (endDate) {
        qs.push(`filter[acquisition_date][_lte]=${encodeURIComponent(endDate)}`);
      }

      const cylinderUrl = `${base}/items/cylinder_assets?${qs.join("&")}`;
      const cylinderJson = await fetchJson<DirectusListResponse<DirectusCylinderAsset>>(cylinderUrl);
      const rows = Array.isArray(cylinderJson?.data) ? cylinderJson.data : [];

      let records: CustomerCylinderAgingRecord[] = [];
      if (rows.length > 0) {
        const serials = rows.map((r) => r.serial_number).filter(Boolean) as string[];
        const allTransactions = await fetchTransactionsForSerials(base, serials);

        // Group transactions by customer+serial mapping (Deployed Date)
        const latestOutTxMap = new Map<string, UnifiedTransaction>();
        const groupedByCylinderCustomer = new Map<string, UnifiedTransaction[]>();
        for (const tx of allTransactions) {
          if (tx.movement_type !== "OUT" || !tx.customer_code) continue;
          const key = `${tx.customer_code}-${tx.serial_number}`;
          if (!groupedByCylinderCustomer.has(key)) {
            groupedByCylinderCustomer.set(key, []);
          }
          groupedByCylinderCustomer.get(key)!.push(tx);
        }
        for (const [key, txs] of groupedByCylinderCustomer.entries()) {
          txs.sort((a, b) => {
            const dateDiff = new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return b.source_row_id - a.source_row_id;
          });
          latestOutTxMap.set(key, txs[0]);
        }

        // Group transactions by customer (Last Transaction Date)
        const lastCustomerTxMap = new Map<string, UnifiedTransaction>();
        const groupedByCustomer = new Map<string, UnifiedTransaction[]>();
        for (const tx of allTransactions) {
          if (tx.movement_type !== "OUT" || !tx.customer_code || tx.is_countable_for_aging !== 1) continue;
          const key = tx.customer_code;
          if (!groupedByCustomer.has(key)) {
            groupedByCustomer.set(key, []);
          }
          groupedByCustomer.get(key)!.push(tx);
        }
        for (const [key, txs] of groupedByCustomer.entries()) {
          txs.sort((a, b) => {
            const dateDiff = new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return b.source_row_id - a.source_row_id;
          });
          lastCustomerTxMap.set(key, txs[0]);
        }

        const customerMap = new Map<string, DirectusCustomer>([[customerCode, customer]]);
        records = rows
          .map((r) => transform(r, customerMap, latestOutTxMap, lastCustomerTxMap))
          .sort((a, b) => (b.daysWithCustomer ?? 0) - (a.daysWithCustomer ?? 0));
      }

      // 3. Fetch all history transactions for this customer
      const transactions = await fetchTransactionsForCustomer(base, customerCode);

      const detailPayload: CustomerCylinderDetail = {
        customerCode,
        customerName: customer.customer_name,
        storeName: customer.store_name,
        contactNumber: customer.contact_number,
        customerEmail: customer.customer_email,
        customerAddress: addressParts || null,
        branchName: records[0]?.branchName ?? null,
        branchCode: records[0]?.branchCode ?? null,
        connectedCylinders: records,
        transactions,
      };

      return NextResponse.json(detailPayload, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Otherwise (view === "customer"), perform aggregation ─────────────────
    // Step 1: Fetch cylinder assets matching status WITH_CUSTOMER
    const qs: string[] = [
      "limit=-1",
      "fields=id,serial_number,cylinder_status,cylinder_condition,current_customer_code,acquisition_date,expiration_date,tare_weight,cost,modified_date,created_date,is_deleted",
      "fields=product_id.product_id,product_id.product_code,product_id.product_name,product_id.product_weight",
      "fields=current_branch_id.id,current_branch_id.branch_name,current_branch_id.branch_code",
      "filter[cylinder_status][_eq]=WITH_CUSTOMER",
      "filter[is_deleted][_eq]=0",
      "filter[current_customer_code][_nnull]=true",
    ];

    const productId = sp.get("productId")?.trim();
    if (productId && !isNaN(Number(productId))) {
      qs.push(`filter[product_id][_eq]=${encodeURIComponent(productId)}`);
    }
    if (customerCode) {
      qs.push(`filter[current_customer_code][_eq]=${encodeURIComponent(customerCode)}`);
    }
    const branchId = sp.get("branchId")?.trim();
    if (branchId && !isNaN(Number(branchId))) {
      qs.push(`filter[current_branch_id][_eq]=${encodeURIComponent(branchId)}`);
    }
    const startDate = sp.get("startDate")?.trim();
    if (startDate) {
      qs.push(`filter[acquisition_date][_gte]=${encodeURIComponent(startDate)}`);
    }
    const endDate = sp.get("endDate")?.trim();
    if (endDate) {
      qs.push(`filter[acquisition_date][_lte]=${encodeURIComponent(endDate)}`);
    }

    const cylinderUrl = `${base}/items/cylinder_assets?${qs.join("&")}`;
    const cylinderJson = await fetchJson<DirectusListResponse<DirectusCylinderAsset>>(cylinderUrl);
    const rows = Array.isArray(cylinderJson?.data) ? cylinderJson.data : [];

    if (rows.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // Step 2: Fetch related transactions for all serials in parallel
    const serials = rows.map((r) => r.serial_number).filter(Boolean) as string[];
    const allTransactions = await fetchTransactionsForSerials(base, serials);

    // Group transactions by customer+serial mapping
    const latestOutTxMap = new Map<string, UnifiedTransaction>();
    const groupedByCylinderCustomer = new Map<string, UnifiedTransaction[]>();
    for (const tx of allTransactions) {
      if (tx.movement_type !== "OUT" || !tx.customer_code) continue;
      const key = `${tx.customer_code}-${tx.serial_number}`;
      if (!groupedByCylinderCustomer.has(key)) {
        groupedByCylinderCustomer.set(key, []);
      }
      groupedByCylinderCustomer.get(key)!.push(tx);
    }
    for (const [key, txs] of groupedByCylinderCustomer.entries()) {
      txs.sort((a, b) => {
        const dateDiff = new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.source_row_id - a.source_row_id;
      });
      latestOutTxMap.set(key, txs[0]);
    }

    // Group transactions by customer
    const lastCustomerTxMap = new Map<string, UnifiedTransaction>();
    const groupedByCustomer = new Map<string, UnifiedTransaction[]>();
    for (const tx of allTransactions) {
      if (tx.movement_type !== "OUT" || !tx.customer_code || tx.is_countable_for_aging !== 1) continue;
      const key = tx.customer_code;
      if (!groupedByCustomer.has(key)) {
        groupedByCustomer.set(key, []);
      }
      groupedByCustomer.get(key)!.push(tx);
    }
    for (const [key, txs] of groupedByCustomer.entries()) {
      txs.sort((a, b) => {
        const dateDiff = new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.source_row_id - a.source_row_id;
      });
      lastCustomerTxMap.set(key, txs[0]);
    }

    // Step 3: Collect unique customer_codes & fetch customer data
    const uniqueCodes = Array.from(
      new Set(rows.map((r) => r.current_customer_code).filter(Boolean) as string[])
    );

    const customerMap = new Map<string, DirectusCustomer>();
    const customerFields =
      "customer_code,customer_name,store_name,contact_number,customer_email,brgy,city,province";

    for (const codes of chunk(uniqueCodes, 250)) {
      const encoded = encodeURIComponent(codes.join(","));
      const custUrl =
        `${base}/items/customer?limit=-1` +
        `&filter[customer_code][_in]=${encoded}` +
        `&fields=${encodeURIComponent(customerFields)}`;
      const custJson = await fetchJson<DirectusListResponse<DirectusCustomer>>(custUrl);
      for (const c of custJson?.data ?? []) {
        if (c.customer_code) customerMap.set(c.customer_code, c);
      }
    }

    // Step 4: Transform rows
    const records = rows.map((r) => transform(r, customerMap, latestOutTxMap, lastCustomerTxMap));

    // Group records by customerCode to create summaries
    const customerGroups = new Map<string, CustomerCylinderAgingRecord[]>();
    for (const rec of records) {
      if (!rec.customerCode) continue;
      if (!customerGroups.has(rec.customerCode)) {
        customerGroups.set(rec.customerCode, []);
      }
      customerGroups.get(rec.customerCode)!.push(rec);
    }

    const summaries: CustomerCylinderAgingSummary[] = [];
    for (const [custCode, recs] of customerGroups.entries()) {
      const first = recs[0];
      const totalCylinders = recs.length;

      let activeCylinders = 0;
      let warningCylinders = 0;
      let criticalCylinders = 0;
      let sumDays = 0;
      let countDays = 0;
      let maxDays: number | null = null;
      let lastTxDate: string | null = null;

      for (const r of recs) {
        const days = r.daysWithCustomer;
        if (days !== null) {
          sumDays += days;
          countDays++;
          if (maxDays === null || days > maxDays) {
            maxDays = days;
          }
          if (days >= 91) {
            criticalCylinders++;
          } else if (days >= 31) {
            warningCylinders++;
          } else {
            activeCylinders++;
          }
        } else {
          activeCylinders++;
        }

        if (r.lastTransactionDate) {
          if (!lastTxDate || new Date(r.lastTransactionDate) > new Date(lastTxDate)) {
            lastTxDate = r.lastTransactionDate;
          }
        }
      }

      const averageDaysWithCustomer = countDays > 0 ? Math.round(sumDays / countDays) : null;
      const daysSince = lastTxDate ? daysDiff(lastTxDate) : null;
      const customerActivityStatus = computeActivityStatus(daysSince);
      const recommendedAction = computeRecommendedAction(daysSince);

      const productsDeployed = Array.from(
        new Set(recs.map((r) => r.productName || r.productCode).filter(Boolean) as string[])
      );

      summaries.push({
        customerCode: custCode,
        customerName: first.customerName,
        storeName: first.storeName,
        contactNumber: first.contactNumber,
        customerEmail: first.customerEmail,
        customerAddress: first.customerAddress,
        branchName: first.branchName,
        branchCode: first.branchCode,
        productsDeployed,
        totalCylinders,
        activeCylinders,
        warningCylinders,
        criticalCylinders,
        averageDaysWithCustomer,
        maxDaysWithCustomer: maxDays,
        lastTransactionDate: lastTxDate,
        daysSinceLastTransaction: daysSince,
        customerActivityStatus,
        recommendedAction,
      });
    }

    // Default sort summaries by total cylinders DESC
    summaries.sort((a, b) => b.totalCylinders - a.totalCylinders);

    return NextResponse.json(summaries, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[BFF:CylinderAging] Directus error:", detail);
    return NextResponse.json(
      { ok: false, message: "Upstream Error", detail },
      { status: 502 }
    );
  }
}

// Helper to generate cylinder detail rows for the HTML email - forced refresh
function generateCylinderRows(connectedCylinders: any[]): string {
  return connectedCylinders.map((c, idx) => {
    const days = c.daysWithCustomer;
    const isOverdue = days !== null && days >= 31;
    const cellBg = isOverdue ? "#fffbe6" : "transparent";
    const textWeight = isOverdue ? "bold" : "normal";
    const textColor = days !== null && days >= 91 ? "#ef4444" : days !== null && days >= 31 ? "#f59e0b" : "#0f172a";
    
    const formattedDate = c.deployedDate 
      ? new Date(c.deployedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : "—";

    return `
      <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${cellBg};">
        <td style="padding: 8px 12px; color: #64748b; font-family: monospace;">${idx + 1}</td>
        <td style="padding: 8px 12px;">
          <div style="font-weight: 600; color: #0f172a;">${c.productName || c.productCode || "Unknown Cylinder"}</div>
          <div style="font-size: 10px; color: #64748b; font-family: monospace; margin-top: 2px;">S/N: ${c.serialNumber}</div>
        </td>
        <td style="padding: 8px 12px; color: #475569;">${formattedDate}</td>
        <td style="padding: 8px 12px; text-align: right; color: ${textColor}; font-weight: ${textWeight}; font-family: monospace;">${days !== null ? `${days} days` : "—"}</td>
      </tr>
    `;
  }).join("");
}

// ── POST handler: Send Cylinder Aging Statement via SMTP ─────────────────────
/**
 * POST /api/ids/bia/customer-cylinder-aging
 *
 * Sends a detailed, styled HTML statement of overdue and active cylinders to the customer.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const base = getDirectusBase();
    const body = await req.json().catch(() => ({}));
    const {
      to,
      customerName,
      customerCode,
      storeName,
      contactNumber,
      connectedCylinders = [],
      avgDays = 0,
      maxDays = 0,
      warningCyls = 0,
      criticalCyls = 0,
    } = body;

    if (!to || !customerCode || !customerName) {
      return NextResponse.json(
        { ok: false, message: "Missing required fields (to, customerCode, customerName)" },
        { status: 400 }
      );
    }

    // 1. Fetch company details for company_id = 1
    let companyName = "VOS GAS";
    let companyLogoBase64: string | null = null;
    let companyTin = "N/A";
    let companyContact = "N/A";
    let companyEmailAddr = "N/A";

    try {
      const token = getDirectusToken();
      const companyUrl = `${base}/items/company?filter[company_id][_eq]=1&fields=company_name,company_logo,company_tin,company_contact,company_email`;
      const companyJson = await fetchJson<{ data: any[] }>(companyUrl);
      const companyData = companyJson?.data?.[0];
      
      if (companyData) {
        companyName = companyData.company_name || companyName;
        companyTin = companyData.company_tin || companyTin;
        companyContact = companyData.company_contact || companyContact;
        companyEmailAddr = companyData.company_email || companyEmailAddr;

        const logoUuid = companyData.company_logo;
        if (logoUuid) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(logoUuid);
          if (isUuid) {
            try {
              const assetUrl = `${base}/assets/${logoUuid}${token ? `?access_token=${token}` : ""}`;
              const imgRes = await fetch(assetUrl);
              if (imgRes.ok) {
                const contentType = imgRes.headers.get("content-type") || "image/png";
                const buffer = await imgRes.arrayBuffer();
                const base64 = Buffer.from(buffer).toString("base64");
                companyLogoBase64 = `data:${contentType};base64,${base64}`;
              }
            } catch (logoErr) {
              console.error("[BFF:CylinderAging:SendEmail] Error fetching company logo asset:", logoErr);
            }
          } else if (logoUuid.startsWith("http")) {
            try {
              const imgRes = await fetch(logoUuid);
              if (imgRes.ok) {
                const contentType = imgRes.headers.get("content-type") || "image/png";
                const buffer = await imgRes.arrayBuffer();
                const base64 = Buffer.from(buffer).toString("base64");
                companyLogoBase64 = `data:${contentType};base64,${base64}`;
              }
            } catch (logoErr) {
              console.error("[BFF:CylinderAging:SendEmail] Error fetching company logo URL:", logoErr);
            }
          } else if (logoUuid.startsWith("data:")) {
            companyLogoBase64 = logoUuid;
          }
        }
      }
    } catch (companyFetchErr) {
      console.warn("[BFF:CylinderAging:SendEmail] Failed to fetch company details, using fallbacks:", companyFetchErr);
    }

    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const emailFrom = process.env.EMAIL_FROM || smtpUser || "noreply@vosgas.com";

    if (!smtpUser || !smtpPassword) {
      return NextResponse.json(
        { ok: false, message: "SMTP credentials (SMTP_USER, SMTP_PASSWORD) are not configured in environment variables." },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Customer Cylinder Aging Statement</title>
        </head>
        <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px 20px; -webkit-font-smoothing: antialiased;">
          <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; padding: 40px;">
            
            <!-- Company Header Logo & Name Layout -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                ${companyLogoBase64 
                  ? `<td style="vertical-align: middle; padding-right: 16px; width: 1%;">
                       <img src="cid:company_logo" alt="${companyName} Logo" style="height: 52px; max-height: 52px; width: auto; object-fit: contain; display: block;" />
                     </td>` 
                  : ""
                }
                <td style="vertical-align: middle; text-align: left;">
                  <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: -0.01em; line-height: 1.3;">${companyName}</h1>
                  <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Cylinder Aging Statement</p>
                </td>
                <td style="vertical-align: middle; text-align: right;">
                  <span style="font-size: 10px; font-weight: 700; color: #be123c; background-color: #ffe4e6; padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">Overdue Notification</span>
                </td>
              </tr>
            </table>

            <!-- Intro -->
            <p style="font-size: 14px; line-height: 1.6; color: #0f172a; margin-top: 0;">Dear <strong>${customerName}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px;">This is a summary statement of the LPG cylinder assets currently deployed at your premises. Please review the details below regarding cylinder deployment durations and holding limits.</p>

            <!-- Customer Info Grid -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <h4 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Customer Details</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; width: 120px;">Customer Code:</td>
                  <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${customerCode}</td>
                </tr>
                ${storeName ? `
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Store Name:</td>
                  <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${storeName}</td>
                </tr>` : ""}
                ${contactNumber ? `
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Contact No:</td>
                  <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${contactNumber}</td>
                </tr>` : ""}
              </table>
            </div>

            <!-- KPI Summary Cards -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="width: 50%; padding-right: 8px; padding-bottom: 16px;">
                  <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
                    <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Active Cylinders</span>
                    <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">${connectedCylinders.length}</div>
                  </div>
                </td>
                <td style="width: 50%; padding-left: 8px; padding-bottom: 16px;">
                  <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
                    <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Avg. Days Held</span>
                    <div style="font-size: 20px; font-weight: 800; color: #10b981; margin-top: 4px;">${avgDays} days</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="width: 50%; padding-right: 8px;">
                  <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
                    <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Max Days Held</span>
                    <div style="font-size: 20px; font-weight: 800; color: #ef4444; margin-top: 4px;">${maxDays} days</div>
                  </div>
                </td>
                <td style="width: 50%; padding-left: 8px;">
                  <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
                    <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Warning / Critical</span>
                    <div style="font-size: 20px; font-weight: 800; color: #f59e0b; margin-top: 4px;">${warningCyls + criticalCyls} <span style="font-size: 12px; font-weight: 500; color: #64748b;">(${warningCyls}W / ${criticalCyls}C)</span></div>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Cylinder Detail Table -->
            <h4 style="margin: 0 0 10px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">Cylinder Asset Breakdown</h4>
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
                <thead>
                  <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <th style="padding: 10px 12px; font-weight: 700; color: #475569; width: 30px;">#</th>
                    <th style="padding: 10px 12px; font-weight: 700; color: #475569;">Asset / Serial</th>
                    <th style="padding: 10px 12px; font-weight: 700; color: #475569;">Deployed Date</th>
                    <th style="padding: 10px 12px; font-weight: 700; color: #475569; text-align: right;">Days Held</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateCylinderRows(connectedCylinders)}
                </tbody>
              </table>
            </div>

            <!-- Action Required Notice -->
            ${warningCyls + criticalCyls > 0 ? `
            <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="vertical-align: top; width: 24px; padding-right: 12px; font-size: 18px;">
                    ⚠️
                  </td>
                  <td style="vertical-align: top;">
                    <h5 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #92400e;">Action Required: Overdue Cylinders Detected</h5>
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #b45309;">One or more cylinders listed above have exceeded the allowed return duration limit of 30 days. Please arrange to have these empty cylinders returned at your earliest convenience or contact our logistics desk.</p>
                  </td>
                </tr>
              </table>
            </div>
            ` : ""}

            <p style="font-size: 13px; line-height: 1.6; color: #334155;">Best regards,</p>
            <p style="font-size: 13px; line-height: 1.6; color: #0f172a; font-weight: 700; margin: 4px 0 0 0;">Logistics & Asset Management Desk</p>
            <p style="font-size: 12px; color: #64748b; margin: 0;">${companyName} Distribution System</p>

            <div style="margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 10px; color: #94a3b8; line-height: 1.5; text-align: center;">
              <p style="margin: 0;">TIN: ${companyTin} | Contact: ${companyContact} | Email: ${companyEmailAddr}</p>
              <p style="margin: 4px 0 0 0;">This is an automatically generated system notification. Replies to this inbox are not monitored.</p>
            </div>

          </div>
        </body>
      </html>
    `;

    const attachments: nodemailer.SendMailOptions["attachments"] = [];
    if (companyLogoBase64) {
      let cleanBase64 = companyLogoBase64;
      let contentType = "image/png";
      if (companyLogoBase64.startsWith("data:")) {
        const parts = companyLogoBase64.split(";base64,");
        if (parts.length === 2) {
          contentType = parts[0].replace("data:", "");
          cleanBase64 = parts[1];
        }
      }
      attachments.push({
        filename: "company_logo",
        content: Buffer.from(cleanBase64, "base64"),
        contentType,
        cid: "company_logo",
      });
    }

    const mailOptions = {
      from: `"${companyName.toUpperCase()}" <${emailFrom}>`,
      to,
      subject: `${companyName} - Customer Cylinder Aging Statement (${customerCode})`,
      html: htmlContent,
      attachments,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ ok: true, message: "Aging statement email sent successfully." }, { status: 200 });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[BFF:CylinderAging:SendEmail] SMTP error:", detail);
    return NextResponse.json(
      { ok: false, message: "Failed to send email statement via SMTP", detail },
      { status: 500 }
    );
  }
}

