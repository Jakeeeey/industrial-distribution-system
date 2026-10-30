// services/customer-cylinder-aging.service.ts
// ──────────────────────────────────────────────────────────────────────────────
// Backend service layer for Customer Cylinder Aging Report.
// Fetches Directus tables (cylinder_assets, customer, branches, products)
// and Spring Boot view (v_serial_movements), feeding the aggregation engine.
// Includes client-side lookups caching and filters products for serialized cylinders.
// ──────────────────────────────────────────────────────────────────────────────

import {
  computeCustomerCylinderAgingReport,
  type RawCylinderAsset,
  type RawCustomerRecord,
  type RawBranchRecord,
  type RawMovementRow,
} from "./customer-cylinder-aging.aggregation";
import type { CustomerCylinderAgingFilterInput } from "../types/customer-cylinder-aging.schema";
import type {
  CustomerCylinderAgingReportResponse,
  CustomerCylinderAgingLookupsResponse,
  LookupOption,
} from "../types/customer-cylinder-aging.types";

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchDirectus<T = unknown>(url: string): Promise<T> {
  try {
    const res = await fetch(url, { headers: directusHeaders(), cache: "no-store" });
    if (!res.ok) return { data: [] } as unknown as T;
    return (await res.json()) as T;
  } catch {
    return { data: [] } as unknown as T;
  }
}

function normalizeMovementRow(raw: unknown): RawMovementRow {
  const r = (raw || {}) as Record<string, unknown>;
  return {
    ts: String(r.ts ?? r.movementAt ?? r.created_at ?? "").trim(),
    product_id: Number(r.product_id ?? r.productId ?? 0),
    branch_id: Number(r.branch_id ?? r.branchId ?? 0),
    serial_number: String(r.serial_number ?? r.serialNumber ?? "").trim().toUpperCase(),
    doc_no: String(r.doc_no ?? r.docNo ?? r.documentNo ?? "—").trim(),
    doc_type: String(r.doc_type ?? r.docType ?? r.documentType ?? "Movement").trim(),
    in_qty: Number(r.in_qty ?? r.inQty ?? 0),
    out_qty: Number(r.out_qty ?? r.outQty ?? 0),
    customer_code:
      r.customer_code !== undefined || r.customerCode !== undefined
        ? String(r.customer_code ?? r.customerCode ?? "").trim() || null
        : null,
    customer_name:
      r.customer_name !== undefined || r.customerName !== undefined
        ? String(r.customer_name ?? r.customerName ?? "").trim() || null
        : null,
    branch_name: String(r.branch_name ?? r.branchName ?? "").trim(),
  };
}

async function fetchSpringMovements(token?: string): Promise<RawMovementRow[]> {
  const springBase = getSpringBase();
  if (!springBase || !token) return [];
  try {
    const url = `${springBase}/api/view-serial-movements/all`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const list = (await res.json()) as unknown[];
    return Array.isArray(list) ? list.map(normalizeMovementRow) : [];
  } catch {
    return [];
  }
}

export async function fetchCustomerCylinderAgingReport(
  filters: CustomerCylinderAgingFilterInput,
  userToken?: string
): Promise<CustomerCylinderAgingReportResponse> {
  const directusBase = getDirectusBase();

  // 1. Fetch cylinder_assets with WITH_CUSTOMER status
  const cylinderFields = [
    "id",
    "serial_number",
    "cylinder_status",
    "cylinder_condition",
    "tare_weight",
    "acquisition_date",
    "created_date",
    "modified_date",
    "current_customer_code",
    "product_id.product_id",
    "product_id.product_code",
    "product_id.product_name",
    "product_id.product_weight",
    "product_id.is_serialized",
    "current_branch_id.id",
    "current_branch_id.branch_code",
    "current_branch_id.branch_name",
  ].join(",");

  const cylinderParams = new URLSearchParams({
    fields: cylinderFields,
    limit: "-1",
    "filter[cylinder_status][_eq]": "WITH_CUSTOMER",
    "filter[is_deleted][_eq]": "0",
  });

  if (filters.branchId) {
    cylinderParams.set("filter[current_branch_id][_eq]", String(filters.branchId));
  }
  if (filters.customerCode) {
    cylinderParams.set("filter[current_customer_code][_eq]", filters.customerCode);
  }
  if (filters.productId) {
    cylinderParams.set("filter[product_id][_eq]", String(filters.productId));
  }

  const [cylindersRes, customersRes, branchesRes, movements] = await Promise.all([
    fetchDirectus<{ data: RawCylinderAsset[] }>(
      `${directusBase}/items/cylinder_assets?${cylinderParams.toString()}`
    ),
    fetchDirectus<{ data: RawCustomerRecord[] }>(
      `${directusBase}/items/customer?fields=customer_code,customer_name,store_name,contact_number,customer_email,brgy,city,province&limit=-1`
    ),
    // AG-COMMENT: Restrict branch queries strictly to Industrial Division (division_id = 1)
    fetchDirectus<{ data: RawBranchRecord[] }>(
      `${directusBase}/items/branches?fields=id,branch_code,branch_name&filter[division_id][_eq]=1&limit=-1`
    ),
    fetchSpringMovements(userToken),
  ]);

  return computeCustomerCylinderAgingReport({
    cylinders: cylindersRes.data || [],
    customers: customersRes.data || [],
    branches: branchesRes.data || [],
    movements,
    filters,
  });
}

// In-memory cache for customer lookups across server requests in this process
let cachedCustomers: LookupOption[] | null = null;
let lastCustomerCacheTime = 0;
const CUSTOMER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

export async function fetchCustomerCylinderAgingLookups(): Promise<CustomerCylinderAgingLookupsResponse> {
  const directusBase = getDirectusBase();

  const now = Date.now();
  const needCustomerFetch = !cachedCustomers || now - lastCustomerCacheTime > CUSTOMER_CACHE_TTL;

  // 1. Fetch branches, serialized cylinder products, and cached customers
  const productParams = new URLSearchParams({
    fields: "product_id,product_code,product_name,is_serialized",
    sort: "product_name",
    limit: "-1",
    "filter[isActive][_eq]": "1",
    "filter[is_serialized][_nnull]": "true",
    "filter[is_serialized][_neq]": "0",
  });

  // AG-COMMENT: Filter for active branches in the Industrial Division (division_id = 1, isActive = 1)
  const [branchesRes, productsRes, customersRes] = await Promise.all([
    fetchDirectus<{ data: Array<{ id: number; branch_code: string; branch_name: string }> }>(
      `${directusBase}/items/branches?filter[isActive][_eq]=1&filter[division_id][_eq]=1&fields=id,branch_code,branch_name&sort=branch_name&limit=-1`
    ),
    fetchDirectus<{ data: Array<{ product_id: number; product_code: string; product_name: string; is_serialized?: number | boolean | string | null }> }>(
      `${directusBase}/items/products?${productParams.toString()}`
    ),
    needCustomerFetch
      ? fetchDirectus<{ data: Array<{ customer_code: string; customer_name: string; store_name: string | null; isActive?: number | boolean | null }> }>(
          `${directusBase}/items/customer?fields=customer_code,customer_name,store_name&sort=customer_name&limit=-1`
        )
      : Promise.resolve({ data: [] }),
  ]);

  if (needCustomerFetch && customersRes.data && customersRes.data.length > 0) {
    cachedCustomers = customersRes.data
      .filter((c) => Boolean(c.customer_code && c.customer_name))
      .map((c) => ({
        value: c.customer_code,
        label: c.store_name
          ? `${c.customer_name} - ${c.store_name} (${c.customer_code})`
          : `${c.customer_name} (${c.customer_code})`,
        code: c.customer_code,
      }));
    lastCustomerCacheTime = now;
  }

  // Filter products to guarantee only true serialized products are included
  const serializedProducts = (productsRes.data || []).filter((p) => {
    const isSer = p.is_serialized;
    return isSer !== null && isSer !== undefined && isSer !== 0 && isSer !== "0" && isSer !== false;
  });

  return {
    branches: (branchesRes.data || []).map((b) => ({
      value: String(b.id),
      label: `${b.branch_name} (${b.branch_code})`,
      code: b.branch_code,
    })),
    customers: cachedCustomers || [],
    products: serializedProducts.map((p) => ({
      value: String(p.product_id),
      label: p.product_name,
      code: p.product_code,
    })),
  };
}
