// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/services/cylinder-stock-report.service.ts
// ==============================================================================
// Cylinder Stock Report - Data Service (Optimized)
// Performance Enhancements:
// 1. Completely excludes heavy v_serial_movements view from the main report query
//    (movements are fetched lazily only when opening the drawer for a specific serial).
// 2. Implements a high-speed in-memory cache for static lookup reference tables (5-min TTL).
// 3. Pre-filters cylinder_assets by branchId directly in Directus when specified.
// ==============================================================================

import {
  aggregateCylinderStockReport,
  type AggregationSourceData,
  type RawCylinderAsset,
  type RawProduct,
  type RawBranch,
  type RawCustomer,
} from "./cylinder-stock-report.aggregation";
import type { CylinderStockFilterInput } from "../types/cylinder-stock-report.schema";
import type {
  CylinderStockReportResponse,
  CylinderStockLookupsResponse,
  SerialMovementItem,
  RawUnit,
} from "../types/cylinder-stock-report.types";

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
    if (!res.ok) {
      console.warn(`[Cylinder Stock Service] Directus request ${path} returned ${res.status}`);
      return [];
    }
    const json = (await res.json()) as { data?: T[] };
    return json.data ?? [];
  } catch (err) {
    console.error(`[Cylinder Stock Service] fetchDirectus error for ${path}:`, err);
    return [];
  }
}

// ==============================================================================
// In-Memory Reference Cache (5-Minute TTL)
// Avoids hammering Directus with duplicate static queries on every filter change.
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
 * Fetches movements from Spring Boot view table v_serial_movements using JWT token.
 * Highly optimized: Only queries for a specific serial number when requested by drawer.
 */
export async function fetchSerialMovements(token?: string, serialNumber?: string): Promise<SerialMovementItem[]> {
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

    if (!res.ok) {
      console.warn(`[Cylinder Stock Service] Spring API view-serial-movements returned status ${res.status}`);
      return [];
    }

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
      supplier_name: r.supplier_name != null ? String(r.supplier_name) : (r.supplierName != null ? String(r.supplierName) : null),
      branch_name: String(r.branch_name ?? r.branchName ?? ""),
      product_name: String(r.product_name ?? r.productName ?? ""),
      uom_ids: r.uom_ids ? String(r.uom_ids) : undefined,
    }));
  } catch (err) {
    console.error("[Cylinder Stock Service] Error fetching v_serial_movements:", err);
    return [];
  }
}

/**
 * Valid cylinder UOM variant states strictly excluding standard weight units like KG.
 */
const CYLINDER_VARIANT_NAMES = ["EMPTY", "SWAP", "REFILL", "DEPOSIT", "OUTRIGHT", "FULL"];

/**
 * Fetches lightweight lookup data for filter dropdowns (served instantly via cache).
 */
export async function fetchCylinderStockLookups(): Promise<CylinderStockLookupsResponse> {
  return getCachedOrFetch("cylinder_lookups", async () => {
    const [branches, products, units] = await Promise.all([
      fetchDirectus<RawBranch>("items/branches?fields=id,branch_code,branch_name,isActive&limit=-1"),
      fetchDirectus<RawProduct>(
        "items/products?fields=product_id,product_code,product_name,is_serialized,description,weight,isActive&limit=-1"
      ),
      fetchDirectus<RawUnit>("items/units?fields=unit_id,unit_name,unit_shortcut,sku_code&limit=-1"),
    ]);

    const serializedProducts = products.filter(
      (p) => p.product_name && (p.is_serialized === true || Number(p.is_serialized) > 0 || String(p.is_serialized) === "1")
    );

    const cylinderUnits = units.filter((u) => {
      const name = (u.unit_name || "").toUpperCase();
      const shortcut = (u.unit_shortcut || "").toUpperCase();
      return CYLINDER_VARIANT_NAMES.includes(name) || CYLINDER_VARIANT_NAMES.includes(shortcut);
    });

    const variantStates = cylinderUnits.length > 0
      ? Array.from(new Set(cylinderUnits.map((u) => (u.unit_shortcut || u.unit_name).toUpperCase())))
      : CYLINDER_VARIANT_NAMES;

    return {
      branches: branches
        .filter((b) => b.branch_name)
        .map((b) => ({ id: b.id, branch_code: b.branch_code, branch_name: b.branch_name })),
      products: serializedProducts.map((p) => ({
        product_id: p.product_id,
        product_code: p.product_code || "",
        product_name: p.product_name || "",
      })),
      variantStates,
    };
  });
}

/**
 * Fetches the full Cylinder Stock Report dataset.
 * Optimized: Runs in parallel, caches reference tables, and skips upfront movements.
 */
export async function fetchCylinderStockReport(
  filters: CylinderStockFilterInput
): Promise<CylinderStockReportResponse> {
  // 1. Fetch static reference tables from cache (branches, units, customers, products)
  const [branches, units, customers, products] = await Promise.all([
    getCachedOrFetch("branches_all", () =>
      fetchDirectus<RawBranch>("items/branches?fields=id,branch_code,branch_name,isActive&limit=-1")
    ),
    getCachedOrFetch("units_all", () =>
      fetchDirectus<RawUnit>("items/units?fields=unit_id,unit_name,unit_shortcut,sku_code&limit=-1")
    ),
    getCachedOrFetch("customers_all", () =>
      fetchDirectus<RawCustomer>("items/customer?fields=customer_code,customer_name,store_name&limit=-1")
    ),
    getCachedOrFetch("products_all", () =>
      fetchDirectus<RawProduct>(
        "items/products?fields=product_id,product_code,product_name,is_serialized,weight,product_weight,unit_of_measurement,uom_ids,description,isActive&limit=-1"
      )
    ),
  ]);

  // 2. Fetch cylinder assets (optionally pre-filtered by branchId if specified)
  let assetPath =
    "items/cylinder_assets?fields=id,product_id,serial_number,cylinder_status,cylinder_condition,current_branch_id,current_customer_code,current_supplier_id,acquisition_date,expiration_date,tare_weight,cost,remarks,is_deleted,created_date,modified_date&filter[is_deleted][_neq]=1&limit=-1";

  if (filters.branchId) {
    assetPath += `&filter[current_branch_id][_eq]=${filters.branchId}`;
  }

  const assets = await fetchDirectus<RawCylinderAsset>(assetPath);

  // 3. Aggregate without heavy upfront movements view (movements are strictly on-demand in drawer)
  const sourceData: AggregationSourceData = {
    assets,
    products,
    units,
    branches,
    customers,
    movements: [], // Empty upfront for blazing-fast initial load
  };

  return aggregateCylinderStockReport(sourceData, filters);
}
