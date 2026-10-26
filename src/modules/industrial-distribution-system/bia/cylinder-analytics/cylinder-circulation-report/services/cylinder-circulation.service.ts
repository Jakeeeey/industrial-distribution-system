// services/cylinder-circulation.service.ts
// ──────────────────────────────────────────────────────────────────────────────
// Backend service layer for Cylinder Circulation Report.
// Queries Directus (cylinder_assets, products, branches) and Spring Boot (v_serial_movements).
// Includes strict normalization of Spring Boot API properties (camelCase <-> snake_case).
// ──────────────────────────────────────────────────────────────────────────────

import {
  computeCirculationReport,
  type RawMovementRow,
  type RawCylinderAssetRow,
  type RawProductRow,
  type RawBranchRow,
} from "./cylinder-circulation.aggregation";
import type { CylinderCirculationFilterInput } from "../types/cylinder-circulation.schema";
import type {
  CylinderCirculationReportResponse,
  CylinderCirculationLookupsResponse,
} from "../types/cylinder-circulation.types";

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
  const raw = (process.env.SPRING_API_BASE_URL || "").trim().replace(/\/$/, "");
  return raw;
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

/**
 * Normalizes raw Spring Boot serial movement records.
 * Spring Boot view endpoints return camelCase properties (serialNumber, movementAt, docNo, etc.)
 * whereas database views are snake_case. This ensures robust matching.
 */
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
    customer_code: r.customer_code !== undefined || r.customerCode !== undefined
      ? String(r.customer_code ?? r.customerCode ?? "").trim() || null
      : null,
    customer_name: r.customer_name !== undefined || r.customerName !== undefined
      ? String(r.customer_name ?? r.customerName ?? "").trim() || null
      : null,
    supplier_name: r.supplier_name !== undefined || r.supplierName !== undefined
      ? String(r.supplier_name ?? r.supplierName ?? "").trim() || null
      : null,
    product_name: String(r.product_name ?? r.productName ?? "").trim(),
    branch_name: String(r.branch_name ?? r.branchName ?? "").trim(),
    uom_ids: r.uom_ids !== undefined || r.uomIds !== undefined
      ? String(r.uom_ids ?? r.uomIds ?? "").trim() || null
      : null,
  };
}

async function fetchSpringMovements(token?: string): Promise<RawMovementRow[]> {
  const springBase = getSpringBase();
  if (!springBase || !token) return [];
  try {
    const url = `${springBase}/api/view-serial-movements/all`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[Cylinder Circulation Service] Spring request returned ${res.status}`);
      return [];
    }
    const json = (await res.json()) as Record<string, unknown> | unknown[];
    let rawList: unknown[] = [];
    if (Array.isArray(json)) {
      rawList = json;
    } else if (json && typeof json === "object") {
      const obj = json as Record<string, unknown>;
      if (Array.isArray(obj.data)) rawList = obj.data;
      else if (Array.isArray(obj.v_serial_movements)) rawList = obj.v_serial_movements;
    }
    return rawList.map(normalizeMovementRow).filter((m) => Boolean(m.serial_number));
  } catch (err) {
    console.error("[Cylinder Circulation Service] Spring query error:", err);
    return [];
  }
}

export async function getCylinderCirculationLookups(): Promise<CylinderCirculationLookupsResponse> {
  const base = getDirectusBase();

  const [branchesRes, productsRes] = await Promise.all([
    fetchDirectus<{ data: RawBranchRow[] }>(
      `${base}/items/branches?filter[isActive][_eq]=1&limit=-1&fields=id,branch_name,branch_code`
    ),
    fetchDirectus<{ data: RawProductRow[] }>(
      `${base}/items/products?filter[isActive][_eq]=1&filter[is_serialized][_eq]=1&limit=-1&fields=product_id,product_name,product_code`
    ),
  ]);

  const branches = (branchesRes?.data || []).map((b) => ({
    value: String(b.id),
    label: b.branch_name,
    code: b.branch_code,
  }));

  const products = (productsRes?.data || []).map((p) => ({
    value: String(p.product_id),
    label: p.product_name,
    code: p.product_code,
  }));

  return { branches, products };
}

export async function generateCylinderCirculationReport(
  filters: CylinderCirculationFilterInput,
  userToken?: string
): Promise<CylinderCirculationReportResponse> {
  const base = getDirectusBase();

  // 1. Concurrently fetch cylinder assets, products, branches, and Spring movement view
  const [assetsRes, productsRes, branchesRes, movements] = await Promise.all([
    fetchDirectus<{ data: RawCylinderAssetRow[] }>(
      `${base}/items/cylinder_assets?limit=-1&fields=id,product_id.product_id,product_id.product_name,product_id.product_code,serial_number,cylinder_status,cylinder_condition,current_branch_id.id,current_branch_id.branch_name,current_customer_code,current_supplier_id,tare_weight,modified_date,created_date`
    ),
    fetchDirectus<{ data: RawProductRow[] }>(
      `${base}/items/products?filter[isActive][_eq]=1&filter[is_serialized][_eq]=1&limit=-1&fields=product_id,product_name,product_code,is_serialized`
    ),
    fetchDirectus<{ data: RawBranchRow[] }>(
      `${base}/items/branches?limit=-1&fields=id,branch_name,branch_code`
    ),
    fetchSpringMovements(userToken),
  ]);

  const rawAssets = assetsRes?.data || [];
  const rawProducts = productsRes?.data || [];
  const rawBranches = branchesRes?.data || [];

  // 2. Compute circulation analytics, detect breaks, and aggregate
  const { cylinders, kpis, charts } = computeCirculationReport(
    movements,
    rawAssets,
    rawProducts,
    rawBranches,
    filters
  );

  return {
    filters: {
      branchId: filters.branchId,
      productId: filters.productId,
      circulationStatus: filters.circulationStatus,
      serialNumber: filters.serialNumber,
      serialNumbers: filters.serialNumbers,
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    generatedAt: new Date().toISOString(),
    cutoffDate: filters.endDate || new Date().toISOString().split("T")[0],
    kpis,
    charts,
    cylinders,
  };
}
