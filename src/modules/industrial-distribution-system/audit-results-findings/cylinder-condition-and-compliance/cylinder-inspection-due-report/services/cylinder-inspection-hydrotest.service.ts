// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/services/cylinder-inspection-hydrotest.service.ts
// ==============================================================================
// Cylinder Inspection and Hydrotest Due Report - Backend Service
// Performance Enhancements:
// 1. In-Memory Reference Cache (5-min TTL) for static lookup tables (branches, products, units, customer).
// 2. Skips upfront v_serial_movements fetch on initial fleet load.
// 3. Dedicated fetchSerialMovements endpoint for on-demand drawer inspection.
// ==============================================================================

import {
  aggregateInspectionHydrotestReport,
  type AggregationSourceData,
} from "./cylinder-inspection-hydrotest.aggregation";
import type {
  RawCylinderAsset,
  RawProduct,
  RawUnit,
  RawBranch,
  RawCustomer,
  CylinderInspectionLookupsResponse,
  CylinderInspectionReportResponse,
  MovementTracePoint,
} from "../types/cylinder-inspection-hydrotest.types";
import type { CylinderInspectionFilterInput } from "../types/cylinder-inspection-hydrotest.schema";

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
  } catch (error) {
    console.error("[Cylinder Inspection Service] Directus Fetch Error:", error);
    return [];
  }
}

// ==============================================================================
// In-Memory Reference Cache (5-Minute TTL)
// Avoids duplicate static queries on every filter change.
// ==============================================================================
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const memoryCache = new Map<string, CacheEntry<unknown>>();

async function getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const fresh = await fetcher();
  memoryCache.set(key, { data: fresh, expiresAt: now + CACHE_TTL_MS });
  return fresh;
}

/**
 * Fetches movements from Spring Boot v_serial_movements view for a specific serial number on-demand.
 * Used exclusively when the user opens the slide-over inspection drawer.
 */
export async function fetchSerialMovements(token?: string, serialNumber?: string): Promise<MovementTracePoint[]> {
  const springBase = getSpringBase();
  if (!springBase || !token || !serialNumber) return [];
  try {
    const url = `${springBase}/api/view-serial-movements/all?serialNumber=${encodeURIComponent(
      serialNumber.trim().toUpperCase()
    )}`;
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

    const raw = (json as Record<string, unknown>[]).map((r) => ({
      ts: String(r.ts ?? r.movementAt ?? r.created_at ?? "").trim(),
      product_id: Number(r.product_id ?? r.productId ?? 0),
      branch_id: Number(r.branch_id ?? r.branchId ?? 0),
      serial_number: String(r.serial_number ?? r.serialNumber ?? "").trim().toUpperCase(),
      doc_no: String(r.doc_no ?? r.docNo ?? r.documentNo ?? "—").trim(),
      doc_type: String(r.doc_type ?? r.docType ?? r.documentType ?? "Movement").trim(),
      in_qty: Number(r.in_qty ?? r.inQty ?? 0),
      out_qty: Number(r.out_qty ?? r.outQty ?? 0),
      customer_code: r.customer_code != null ? String(r.customer_code) : null,
      customer_name: r.customer_name != null ? String(r.customer_name) : null,
      supplier_name: r.supplier_name != null ? String(r.supplier_name) : null,
      product_name: String(r.product_name ?? r.productName ?? ""),
      branch_name: String(r.branch_name ?? r.branchName ?? ""),
      uom_ids: r.uom_ids != null ? String(r.uom_ids) : null,
    }));

    return raw
      .map((m) => {
        let movementType: MovementTracePoint["movementType"] = "ASSIGNMENT";
        if (m.in_qty > 0 && m.out_qty === 0) movementType = "IN";
        else if (m.out_qty > 0 && m.in_qty === 0) movementType = "OUT";
        else if (m.doc_type?.toLowerCase().includes("transfer")) movementType = "TRANSFER";

        return {
          timestamp: m.ts,
          docNo: m.doc_no || "—",
          docType: m.doc_type || "Movement",
          branchName: m.branch_name || "Branch",
          counterparty: m.customer_name || m.supplier_name || m.customer_code || "Warehouse",
          movementType,
          quantity: Math.max(m.in_qty, m.out_qty, 1),
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error("[Cylinder Inspection Service] Spring Movements Fetch Error:", error);
    return [];
  }
}

/**
 * Fetches lookup data for branch and product dropdown filters.
 */
export async function fetchInspectionHydrotestLookups(): Promise<CylinderInspectionLookupsResponse> {
  return getCachedOrFetch("inspection_lookups", async () => {
    const [branches, products] = await Promise.all([
      fetchDirectus<RawBranch>("items/branches?fields=id,branch_code,branch_name,isActive&limit=-1"),
      fetchDirectus<RawProduct>(
        "items/products?fields=product_id,product_code,product_name,is_serialized,description,weight,isActive&limit=-1"
      ),
    ]);

    // Robust in-memory filtering for serialized cylinder products
    const serializedProducts = products.filter(
      (p) =>
        p.product_name &&
        (p.is_serialized === true ||
          Number(p.is_serialized) > 0 ||
          String(p.is_serialized) === "1")
    );

    return {
      branches: branches
        .filter((b) => b.branch_name)
        .map((b) => ({ id: Number(b.id), branch_code: b.branch_code, branch_name: b.branch_name })),
      products: serializedProducts.map((p) => ({
        product_id: Number(p.product_id),
        product_code: p.product_code || "",
        product_name: p.product_name || "",
      })),
    };
  });
}

/**
 * Fetches cylinder assets and correlated metadata, applying compliance business logic.
 * Optimized: Caches static reference tables and skips upfront movements.
 */
export async function fetchInspectionHydrotestReport(
  filters: CylinderInspectionFilterInput
): Promise<CylinderInspectionReportResponse> {
  // 1. Fetch static reference tables from in-memory cache
  const [rawProducts, units, branches, customers] = await Promise.all([
    getCachedOrFetch("inspection_products_all", () =>
      fetchDirectus<RawProduct>(
        "items/products?fields=product_id,product_code,product_name,is_serialized,weight,product_weight,unit_of_measurement,uom_ids,description,isActive&limit=-1"
      )
    ),
    getCachedOrFetch("inspection_units_all", () =>
      fetchDirectus<RawUnit>(
        "items/units?fields=unit_id,unit_name,unit_shortcut,sku_code&filter[unit_id][_in]=1,18,19,20,21,22,23&limit=-1"
      )
    ),
    getCachedOrFetch("inspection_branches_all", () =>
      fetchDirectus<RawBranch>("items/branches?fields=id,branch_code,branch_name,isActive&limit=-1")
    ),
    getCachedOrFetch("inspection_customers_all", () =>
      fetchDirectus<RawCustomer>(
        "items/customer?fields=customer_code,customer_name,store_name,contact_number,city,province&limit=-1"
      )
    ),
  ]);

  // Ensure products retain all active serialized items
  const products = rawProducts.filter(
    (p) =>
      p.is_serialized === true ||
      Number(p.is_serialized) > 0 ||
      String(p.is_serialized) === "1"
  );

  // 2. Fetch cylinder assets (optionally pre-filtered by branchId if specified)
  let assetPath =
    "items/cylinder_assets?fields=id,product_id,serial_number,cylinder_status,cylinder_condition,current_branch_id,current_customer_code,current_supplier_id,acquisition_date,expiration_date,tare_weight,cost,remarks,is_deleted,created_date,modified_date&filter[is_deleted][_neq]=1&limit=-1";

  if (filters.branchId) {
    assetPath += `&filter[current_branch_id][_eq]=${filters.branchId}`;
  }

  const assets = await fetchDirectus<RawCylinderAsset>(assetPath);

  // 3. Aggregate without heavy upfront movements (movements are fetched lazily in drawer)
  const sourceData: AggregationSourceData = {
    assets,
    products,
    units,
    branches,
    customers,
    movements: [],
  };

  return aggregateInspectionHydrotestReport(sourceData, filters);
}
