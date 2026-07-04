// src/app/api/ids/dashboard/low-stock/route.ts
// BFF route that computes low-stock alerts dynamically by counting the 'AVAILABLE' status cylinders in cylinder_assets.
// Supports optional branchId filtering.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DirectusProduct {
  product_id: number;
  product_code: string | null;
  product_name: string | null;
  is_serialized?: number | string | boolean | null;
  parent_id?: number | null;
  maintaining_quantity?: number | null;
  product_category?: {
    category_name: string | null;
  } | null;
}

interface DirectusCylinderAsset {
  id: number;
  cylinder_status: string | null;
  current_branch_id: number | { id: number } | null;
  product_id: number | { product_id: number } | null;
  is_deleted?: number | boolean | null;
}

function getDirectusBase(): string {
  const raw = (
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (!raw) throw new Error("Directus URL is not configured.");
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

function getDirectusToken(): string {
  return (
    process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || ""
  ).trim();
}

function getDirectusHeaders(): Record<string, string> {
  const token = getDirectusToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || "all";

    const base = getDirectusBase();
    const headers = getDirectusHeaders();

    // 1. Fetch all products to resolve codes, categories, parents, and maintaining_quantity
    const productsUrl = `${base}/items/products?limit=-1&fields=product_id,product_code,product_name,is_serialized,parent_id,maintaining_quantity,product_category.category_name&filter[is_serialized][_eq]=1&filter[parent_id][_null]=true`;
    const productsRes = await fetch(productsUrl, { headers, cache: "no-store" });
    
    let products: DirectusProduct[] = [];
    if (productsRes.ok) {
      const payload = await productsRes.json();
      if (payload && Array.isArray(payload.data)) {
        products = payload.data;
      }
    } else {
      console.warn(`[Low Stock BFF] Failed to fetch products: ${productsRes.status}`);
    }

    // 2. Fetch all cylinder assets that are currently 'AVAILABLE' (as per user "only available" comment)
    const assetsUrl = `${base}/items/cylinder_assets?limit=-1&fields=id,cylinder_status,current_branch_id,product_id,is_deleted&filter[cylinder_status][_eq]=AVAILABLE`;
    const assetsRes = await fetch(assetsUrl, { headers, cache: "no-store" });

    let assets: DirectusCylinderAsset[] = [];
    if (assetsRes.ok) {
      const payload = await assetsRes.json();
      if (payload && Array.isArray(payload.data)) {
        assets = payload.data;
      }
    } else {
      console.warn(`[Low Stock BFF] Failed to fetch cylinder assets: ${assetsRes.status}`);
    }

    // Helpers to safely extract relational IDs
    const getBranchIdStr = (row: DirectusCylinderAsset): string => {
      if (!row.current_branch_id) return "";
      if (typeof row.current_branch_id === "object") {
        return String(row.current_branch_id.id || "");
      }
      return String(row.current_branch_id);
    };

    const getProductIdStr = (row: DirectusCylinderAsset): string => {
      if (!row.product_id) return "";
      if (typeof row.product_id === "object") {
        return String(row.product_id.product_id || "");
      }
      return String(row.product_id);
    };

    const isDeleted = (row: DirectusCylinderAsset): boolean => {
      return row.is_deleted === true || row.is_deleted === 1;
    };

    // 3. Map products by ID for fast lookup
    const productMap = new Map<number, DirectusProduct>();
    products.forEach((prod) => {
      productMap.set(prod.product_id, prod);
    });

    // 4. Count 'AVAILABLE' cylinders in memory grouped strictly by direct product ID
    const countsMap = new Map<string, number>();
    
    assets.forEach((asset) => {
      if (isDeleted(asset)) return;

      // Filter by branch if not 'all'
      if (branchId !== "all" && getBranchIdStr(asset) !== branchId) {
        return;
      }

      const pIdStr = getProductIdStr(asset);
      if (pIdStr) {
        countsMap.set(pIdStr, (countsMap.get(pIdStr) || 0) + 1);
      }
    });

    // 5. Evaluate stock count for each product against threshold limits (parent products only)
    interface StockAlertItem {
      productCode: string;
      productName: string;
      category: string;
      stockOnHand: number;
      reorderPoint: number;
      status: "Critical" | "Warning";
    }

    const alerts: StockAlertItem[] = [];

    // Filter to only parent products (where parent_id is null/undefined/0/empty)
    const parentProducts = products.filter(
      (prod) => !prod.parent_id || prod.parent_id <= 0
    );

    parentProducts.forEach((prod) => {
      // Cylinder products are serialized products
      const isSerialized = prod.is_serialized === 1 || prod.is_serialized === "1" || prod.is_serialized === true;
      if (!isSerialized) {
        return;
      }

      const code = prod.product_code || "";
      const pIdStr = String(prod.product_id);
      const stockOnHand = countsMap.get(pIdStr) || 0;
      
      const name = prod.product_name || "Unknown Product";
      const category = prod.product_category?.category_name || "LPG";

      // Reorder limit thresholds based on maintaining_quantity
      const mq = Number(prod.maintaining_quantity ?? 0);
      const reorderPoint = mq > 0 ? mq : 25;

      if (stockOnHand < reorderPoint) {
        const isCritical = mq > 0 ? (stockOnHand < mq * 0.20) : (stockOnHand < 10);
        alerts.push({
          productCode: code,
          productName: name,
          category,
          stockOnHand,
          reorderPoint,
          status: isCritical ? "Critical" : "Warning",
        });
      }
    });

    return NextResponse.json(alerts);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("[Low Stock BFF] Route Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
