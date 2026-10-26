// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/services/lost-damaged-cylinder.service.ts
// ==============================================================================
// Lost and Damaged Cylinder Report - Backend Service
// Fetches records from Directus and Spring Boot view endpoints with error tolerance.
// ==============================================================================

import {
  aggregateLostDamagedReport,
  type AggregationSourceData,
  type RawCylinderAsset,
  type RawProduct,
  type RawBranch,
  type RawCustomer,
  type RawStockAdjustmentHeader,
  type RawStockAdjustmentSerial,
  type RawSalesReturnHeader,
  type RawSalesReturnSerial,
  type RawSerialMovement,
} from "./lost-damaged-cylinder.aggregation";
import type { LostDamagedFilterInput } from "../types/lost-damaged-cylinder.schema";
import type {
  LostDamagedReportResponse,
  LostDamagedLookupsResponse,
} from "../types/lost-damaged-cylinder.types";

function getDirectusBase(): string {
  const raw = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (!raw) return "http://127.0.0.1:8055";
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

function getSpringBase(): string {
  return (process.env.SPRING_API_BASE_URL || "").trim().replace(/\/$/, "");
}

function getDirectusToken(): string {
  return (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || "").trim();
}

function directusHeaders(): Record<string, string> {
  const token = getDirectusToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchDirectus<T>(path: string): Promise<T[]> {
  try {
    const base = getDirectusBase();
    const url = `${base}/${path.replace(/^\//, "")}`;
    const res = await fetch(url, { headers: directusHeaders(), cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: T[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

async function fetchSpringMovements(token?: string): Promise<RawSerialMovement[]> {
  const springBase = getSpringBase();
  if (!springBase || !token) return [];
  try {
    const url = `${springBase}/api/view-serial-movements/all`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown[];
    if (!Array.isArray(json)) return [];

    return (json as Record<string, unknown>[]).map((r) => ({
      ts: String(r.ts ?? r.movementAt ?? r.created_at ?? "").trim(),
      product_id: Number(r.product_id ?? r.productId ?? 0),
      branch_id: Number(r.branch_id ?? r.branchId ?? 0),
      serial_number: String(r.serial_number ?? r.serialNumber ?? "").trim().toUpperCase(),
      doc_no: String(r.doc_no ?? r.docNo ?? r.documentNo ?? "—").trim(),
      doc_type: String(r.doc_type ?? r.docType ?? r.documentType ?? "Movement").trim(),
      in_qty: Number(r.in_qty ?? r.inQty ?? 0),
      out_qty: Number(r.out_qty ?? r.outQty ?? 0),
      customer_code: r.customer_code != null ? String(r.customer_code) : (r.customerCode != null ? String(r.customerCode) : null),
      customer_name: r.customer_name != null ? String(r.customer_name) : (r.customerName != null ? String(r.customerName) : null),
      branch_name: String(r.branch_name ?? r.branchName ?? ""),
      product_name: String(r.product_name ?? r.productName ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function fetchLostDamagedLookups(): Promise<LostDamagedLookupsResponse> {
  const [branches, products] = await Promise.all([
    fetchDirectus<RawBranch>("items/branches?fields=id,branch_code,branch_name,isActive&limit=-1"),
    fetchDirectus<RawProduct>(
      "items/products?fields=product_id,product_code,product_name&filter[is_serialized][_gt]=0&limit=-1"
    ),
  ]);

  return {
    branches: branches
      .filter((b) => b.branch_name)
      .map((b) => ({ id: b.id, branch_code: b.branch_code, branch_name: b.branch_name })),
    products: products
      .filter((p) => p.product_name)
      .map((p) => ({
        product_id: p.product_id,
        product_code: p.product_code || "",
        product_name: p.product_name || "",
      })),
  };
}

export async function fetchLostDamagedReport(
  filters: LostDamagedFilterInput,
  token?: string
): Promise<LostDamagedReportResponse> {
  // Concurrently fetch source records
  const [
    assets,
    products,
    branches,
    customers,
    adjustments,
    adjustmentSerials,
    salesReturns,
    salesReturnSerials,
    movements,
  ] = await Promise.all([
    fetchDirectus<RawCylinderAsset>(
      "items/cylinder_assets?fields=id,product_id,serial_number,cylinder_status,cylinder_condition,current_branch_id,current_customer_code,tare_weight,cost,remarks,created_date,modified_date,is_deleted&filter[is_deleted][_neq]=1&limit=-1"
    ),
    fetchDirectus<RawProduct>(
      "items/products?fields=product_id,product_code,product_name,cost_per_unit,price_per_unit,estimated_unit_cost,product_weight,is_serialized&filter[is_serialized][_gt]=0&limit=-1"
    ),
    fetchDirectus<RawBranch>("items/branches?fields=id,branch_code,branch_name,isActive&limit=-1"),
    fetchDirectus<RawCustomer>(
      "items/customer?fields=customer_code,customer_name,store_name,contact_number,city,province&limit=-1"
    ),
    fetchDirectus<RawStockAdjustmentHeader>(
      "items/stock_adjustment_header?fields=id,doc_no,branch_id,type,isPosted,posted_by,postedAt,remarks,amount&filter[isPosted][_eq]=true&limit=-1"
    ),
    fetchDirectus<RawStockAdjustmentSerial>(
      "items/stock_adjustment_serial?fields=id,stock_adjustment_id,serial_number,created_at&limit=-1"
    ),
    fetchDirectus<RawSalesReturnHeader>(
      "items/sales_return?fields=return_id,return_number,customer_code,branch_id,return_date,isReceived,received_at&filter[isReceived][_eq]=true&limit=-1"
    ),
    fetchDirectus<RawSalesReturnSerial>(
      "items/sales_return_serial?fields=id,sales_return_detail_id,serial_number,created_at&limit=-1"
    ),
    fetchSpringMovements(token),
  ]);

  const sourceData: AggregationSourceData = {
    assets,
    products,
    branches,
    customers,
    adjustments,
    adjustmentSerials,
    salesReturns,
    salesReturnSerials,
    movements,
  };

  return aggregateLostDamagedReport(sourceData, filters);
}
