// src/modules/.../inventory-control/providers/fetchprovider.ts

import type {
  BranchInfo,
  CategoryInfo,
  DirectusItemsResponse,
  ProductInfo,
  SerialOnhandRecord,
} from "../type";

const API_BASE = "/api/ids/scm/inventory-management/inventory-control";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function apiGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${path} failed [${res.status}]: ${text}`);
  }

  const text = await res.text();
  if (!text) throw new Error(`Empty response from ${path}`);
  return JSON.parse(text) as T;
}

async function directusGetItems<T>(
  collection: string,
  params?: Record<string, string>,
): Promise<T[]> {
  const queryParams: Record<string, string> = {
    directusCollection: collection,
    ...params,
  };
  const json = await apiGet<DirectusItemsResponse<T>>(API_BASE, queryParams);
  return Array.isArray(json.data) ? json.data : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSerialOnhand(
  branchId: number,
): Promise<SerialOnhandRecord[]> {
  const res = await apiGet<SerialOnhandRecord[]>(API_BASE, {
    branchId: String(branchId),
    limit: "-1",
  });

  return Array.isArray(res) ? res : [];
}

export async function fetchBranches(): Promise<BranchInfo[]> {
  // Only include branches that belong to division_id = 1
  return directusGetItems<BranchInfo>("branches", {
    fields: "id,branch_name",
    sort: "branch_name",
    limit: "-1",
    filter: JSON.stringify({ division_id: { _eq: 1 } }),
  });
}

export async function fetchProducts(): Promise<ProductInfo[]> {
  return directusGetItems<ProductInfo>("products", {
    fields: "product_id,parent_id,product_name,barcode,product_category",
    sort: "product_name",
    limit: "-1",
    filter: JSON.stringify({ isActive: { _eq: 1 } }),
  });
}

export async function fetchCategories(): Promise<CategoryInfo[]> {
  return directusGetItems<CategoryInfo>("categories", {
    fields: "category_id,category_name",
    sort: "category_name",
    limit: "-1",
  });
}
