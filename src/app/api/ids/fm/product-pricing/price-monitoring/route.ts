// =============================================================================
// API Route: /api/ids/fm/product-pricing/price-monitoring
// Module    : Price Monitoring (Directus Direct Query Fallback)
// Params    : productId (required), supplierId (optional)
// Returns   : ViewPriceMonitoringRow[] — APPROVED rows resolved via Directus
// =============================================================================

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

interface SupplierDetail {
  id?: number | string;
  supplier_name?: string;
  supplier_shortcut?: string;
  supplier_type?: string;
}

interface ProductPerSupplierRow {
  id?: number;
  supplier_id?: number | SupplierDetail | null;
}

interface DirectusPriceChangeRequest {
  request_id: number | string;
  product_id?:
    | number
    | string
    | {
        product_id?: number | string | null;
        product_code?: string | null;
        product_name?: string | null;
      }
    | null;
  price_type_id?:
    | number
    | string
    | {
        price_type_id?: number | string | null;
        price_type_name?: string | null;
        sort?: number | string | null;
        order?: number | string | null;
      }
    | null;
  proposed_price?: number | string | null;
  status?: string | null;
  requested_by?: number | string | null;
  requested_at?: string | null;
  approved_by?: number | string | null;
  approved_at?: string | null;
  rejected_by?: number | string | null;
  rejected_at?: string | null;
  reject_reason?: string | null;
}

interface ProductPerPriceTypeRow {
  price_type_id?:
    | number
    | string
    | {
        price_type_id?: number | string | null;
      }
    | null;
  price?: number | string | null;
  status?: string | null;
}

interface DirectusUserRow {
  user_id?: number | string;
  id?: number | string;
  user_fname?: string;
  user_lname?: string;
  first_name?: string;
  last_name?: string;
}

function getDirectusHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

async function fetchDirectus<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...getDirectusHeaders(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Directus query failed: ${res.status} - ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

export async function GET(req: NextRequest) {
  try {
    const token =
      req.headers.get("authorization")?.replace("Bearer ", "") ||
      req.cookies.get("vos_access_token")?.value;

    const { searchParams } = new URL(req.url);

    // =========================================================================
    // DIRECTUS PROXY
    // =========================================================================
    const directusCollection = searchParams.get("directusCollection");

    if (directusCollection) {
      if (!DIRECTUS_BASE) {
        return NextResponse.json(
          { error: "DIRECTUS base URL not configured" },
          { status: 500 },
        );
      }

      const proxyParams = new URLSearchParams(searchParams.toString());
      proxyParams.delete("directusCollection");

      const target = `${DIRECTUS_BASE}/items/${encodeURIComponent(
        directusCollection,
      )}${proxyParams.toString() ? `?${proxyParams.toString()}` : ""}`;

      const res = await fetch(target, {
        method: "GET",
        headers: getDirectusHeaders(),
      });

      if (res.status === 401) {
        return NextResponse.json(
          { error: "Directus authentication failed" },
          { status: 502 },
        );
      }

      if (res.status === 403) {
        return NextResponse.json(
          {
            error:
              "Directus 403 Forbidden. Check DIRECTUS_STATIC_TOKEN permissions.",
          },
          { status: 502 },
        );
      }

      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "content-type":
            res.headers.get("content-type") || "application/json",
        },
      });
    }

    // =========================================================================
    // VALIDATION
    // =========================================================================
    const productIdRaw = searchParams.get("productId");

    if (!productIdRaw || productIdRaw.trim() === "") {
      return NextResponse.json(
        { error: "productId is required." },
        { status: 400 },
      );
    }

    const productId = Number(productIdRaw);
    if (!Number.isFinite(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "productId must be a positive integer." },
        { status: 400 },
      );
    }

    const supplierIdRaw = searchParams.get("supplierId");
    if (supplierIdRaw && supplierIdRaw.trim() !== "") {
      const supplierId = Number(supplierIdRaw);
      if (!Number.isFinite(supplierId) || supplierId <= 0) {
        return NextResponse.json(
          { error: "supplierId must be a positive integer when provided." },
          { status: 400 },
        );
      }
    }

    // =========================================================================
    // AUTH CHECK
    // =========================================================================
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: no token provided" },
        { status: 401 },
      );
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus base URL is not configured" },
        { status: 500 },
      );
    }

    // =========================================================================
    // 1. FETCH PRODUCT-SUPPLIER MAPPINGS
    // =========================================================================
    const ppsUrl = new URL(`${DIRECTUS_BASE}/items/product_per_supplier`);
    ppsUrl.searchParams.set("filter[product_id][_eq]", String(productId));
    ppsUrl.searchParams.set(
      "fields",
      "id,supplier_id,supplier_id.id,supplier_id.supplier_name,supplier_id.supplier_shortcut,supplier_id.supplier_type",
    );
    ppsUrl.searchParams.set("limit", "-1");

    const ppsRes = await fetchDirectus<{ data?: ProductPerSupplierRow[] }>(
      ppsUrl.toString(),
    );
    const mappings = ppsRes.data ?? [];

    const supplierIdsToFetch = Array.from(
      new Set(
        mappings
          .map((m) => {
            if (typeof m.supplier_id === "object" && m.supplier_id) {
              return Number(m.supplier_id.id);
            }
            return Number(m.supplier_id);
          })
          .filter(Boolean),
      ),
    );

    const suppliersMap = new Map<number, SupplierDetail>();
    if (supplierIdsToFetch.length > 0) {
      const sUrl = new URL(`${DIRECTUS_BASE}/items/suppliers`);
      sUrl.searchParams.set("filter[id][_in]", supplierIdsToFetch.join(","));
      sUrl.searchParams.set(
        "fields",
        "id,supplier_name,supplier_shortcut,supplier_type",
      );
      sUrl.searchParams.set("limit", "-1");
      const sRes = await fetchDirectus<{ data?: SupplierDetail[] }>(sUrl.toString());
      for (const s of sRes.data ?? []) {
        if (s.id) {
          suppliersMap.set(Number(s.id), s);
        }
      }
    }

    // Resolve target supplier and validation state
    let targetSupplierId = 0;
    let targetSupplierName: string | null = null;
    let targetSupplierShortcut: string | null = null;
    let targetSupplierType: string | null = null;
    let productSupplierMappingId: number | null = null;
    let supplierProductValidation: "VALID" | "SUPPLIER NOT MAPPED TO PRODUCT" =
      "VALID";

    const filteredSupplierId = supplierIdRaw ? Number(supplierIdRaw) : null;

    if (filteredSupplierId) {
      const matched = mappings.find((m) => {
        const sid =
          typeof m.supplier_id === "object" && m.supplier_id
            ? Number(m.supplier_id.id)
            : Number(m.supplier_id);
        return sid === filteredSupplierId;
      });

      targetSupplierId = filteredSupplierId;

      if (matched) {
        productSupplierMappingId = matched.id ?? null;
        supplierProductValidation = "VALID";
        const details = suppliersMap.get(filteredSupplierId);
        if (details) {
          targetSupplierName = details.supplier_name ?? null;
          targetSupplierShortcut = details.supplier_shortcut ?? null;
          targetSupplierType = details.supplier_type ?? null;
        }
      } else {
        supplierProductValidation = "SUPPLIER NOT MAPPED TO PRODUCT";
        // Fetch details of this unmapped supplier so UI displays it properly
        let details = suppliersMap.get(filteredSupplierId);
        if (!details) {
          try {
            const rawRes = await fetchDirectus<{ data?: SupplierDetail }>(
              `${DIRECTUS_BASE}/items/suppliers/${filteredSupplierId}`,
            );
            details = rawRes?.data || (rawRes as unknown as SupplierDetail);
          } catch {
            details = {
              supplier_name: "",
              supplier_shortcut: "",
              supplier_type: "",
            };
          }
        }
        if (details) {
          targetSupplierName = details.supplier_name ?? null;
          targetSupplierShortcut = details.supplier_shortcut ?? null;
          targetSupplierType = details.supplier_type ?? null;
        }
      }
    } else {
      if (mappings.length > 0) {
        const first = mappings[0];
        productSupplierMappingId = first.id ?? null;
        const sid =
          typeof first.supplier_id === "object" && first.supplier_id
            ? Number(first.supplier_id.id)
            : Number(first.supplier_id);
        targetSupplierId = sid;
        supplierProductValidation = "VALID";
        const details = suppliersMap.get(sid);
        if (details) {
          targetSupplierName = details.supplier_name ?? null;
          targetSupplierShortcut = details.supplier_shortcut ?? null;
          targetSupplierType = details.supplier_type ?? null;
        }
      } else {
        supplierProductValidation = "SUPPLIER NOT MAPPED TO PRODUCT";
        targetSupplierId = 0;
      }
    }

    // =========================================================================
    // 2. FETCH PRICE CHANGE REQUESTS (APPROVED)
    // =========================================================================
    const pcrUrl = new URL(`${DIRECTUS_BASE}/items/price_change_requests`);
    pcrUrl.searchParams.set("filter[product_id][_eq]", String(productId));
    pcrUrl.searchParams.set("filter[status][_eq]", "APPROVED");
    pcrUrl.searchParams.set(
      "fields",
      "request_id,product_id,product_id.product_id,product_id.product_code,product_id.product_name,price_type_id,price_type_id.price_type_id,price_type_id.price_type_name,price_type_id.sort,price_type_id.order,proposed_price,status,requested_by,requested_at,approved_by,approved_at,rejected_by,rejected_at,reject_reason",
    );
    pcrUrl.searchParams.set("limit", "-1");
    pcrUrl.searchParams.set("sort", "approved_at,request_id");

    const pcrRes = await fetchDirectus<{ data?: DirectusPriceChangeRequest[] }>(
      pcrUrl.toString(),
    );
    const requests = pcrRes.data ?? [];

    // =========================================================================
    // 3. FETCH LIVE PRICES FROM PRODUCT_PER_PRICE_TYPE
    // =========================================================================
    const pptUrl = new URL(`${DIRECTUS_BASE}/items/product_per_price_type`);
    pptUrl.searchParams.set("filter[product_id][_eq]", String(productId));
    pptUrl.searchParams.set("fields", "price_type_id,price,status");
    pptUrl.searchParams.set("limit", "-1");

    const pptRes = await fetchDirectus<{ data?: ProductPerPriceTypeRow[] }>(
      pptUrl.toString(),
    );
    const pptMap = new Map<number, { price: number | null; status: string | null }>();
    for (const item of pptRes.data ?? []) {
      const ptid =
        typeof item.price_type_id === "object" && item.price_type_id
          ? Number(item.price_type_id.price_type_id)
          : Number(item.price_type_id);
      if (ptid) {
        pptMap.set(ptid, {
          price: item.price !== undefined ? Number(item.price) : null,
          status: item.status ?? null,
        });
      }
    }

    // =========================================================================
    // 4. BATCH RESOLVE USER NAMES
    // =========================================================================
    const userIdsSet = new Set<string>();
    for (const r of requests) {
      if (r.requested_by) userIdsSet.add(String(r.requested_by));
      if (r.approved_by) userIdsSet.add(String(r.approved_by));
      if (r.rejected_by) userIdsSet.add(String(r.rejected_by));
    }
    const userIds = Array.from(userIdsSet);

    const userNamesMap = new Map<string, string>();
    if (userIds.length > 0) {
      try {
        const numericIds = userIds.filter((id) => /^\d+$/.test(id));
        const uuidIds = userIds.filter((id) => !/^\d+$/.test(id));

        if (numericIds.length > 0) {
          const uUrl = new URL(`${DIRECTUS_BASE}/items/user`);
          uUrl.searchParams.set("fields", "user_id,user_fname,user_lname");
          uUrl.searchParams.set("filter[user_id][_in]", numericIds.join(","));
          uUrl.searchParams.set("limit", "-1");
          const uJ = await fetchDirectus<{ data: DirectusUserRow[] }>(uUrl.toString());
          for (const u of uJ.data ?? []) {
            userNamesMap.set(
              String(u.user_id),
              [u.user_fname, u.user_lname].filter(Boolean).join(" ") || "—",
            );
          }
        }

        if (uuidIds.length > 0) {
          const uUrl = new URL(`${DIRECTUS_BASE}/users`);
          uUrl.searchParams.set("fields", "id,first_name,last_name");
          uUrl.searchParams.set("filter[id][_in]", uuidIds.join(","));
          uUrl.searchParams.set("limit", "-1");
          const uJ = await fetchDirectus<{ data: DirectusUserRow[] }>(uUrl.toString());
          for (const u of uJ.data ?? []) {
            userNamesMap.set(
              String(u.id),
              [u.first_name, u.last_name].filter(Boolean).join(" ") || "—",
            );
          }
        }
      } catch (err) {
        console.error("[price-monitoring] User fetch error:", err);
      }
    }

    // =========================================================================
    // 5. ASSEMBLE ViewPriceMonitoringRow DATA
    // =========================================================================
    const records = requests.map((r) => {
      const pId =
        typeof r.product_id === "object" && r.product_id
          ? Number(r.product_id.product_id)
          : Number(r.product_id);
      const pCode =
        typeof r.product_id === "object" && r.product_id
          ? r.product_id.product_code
          : null;
      const pName =
        typeof r.product_id === "object" && r.product_id
          ? r.product_id.product_name
          : null;

      const ptId =
        typeof r.price_type_id === "object" && r.price_type_id
          ? Number(r.price_type_id.price_type_id)
          : Number(r.price_type_id);
      const ptName =
        typeof r.price_type_id === "object" && r.price_type_id
          ? r.price_type_id.price_type_name
          : null;
      const ptSort =
        typeof r.price_type_id === "object" && r.price_type_id
          ? Number(r.price_type_id.sort ?? r.price_type_id.order ?? 0)
          : 0;

      const live = pptMap.get(ptId);

      return {
        requestId: Number(r.request_id),
        headerId: 0,
        referenceNo: null,
        headerRemarks: null,
        headerStatus: "APPROVED",

        // Supplier fields
        supplierId: targetSupplierId,
        supplierName: targetSupplierName,
        supplierShortcut: targetSupplierShortcut,
        supplierType: targetSupplierType,

        // Product fields
        productId: pId,
        productCode: pCode,
        productName: pName,

        // Price type fields
        priceTypeId: ptId,
        priceTypeName: ptName,
        priceTypeSort: ptSort,

        // Status
        requestStatus: "APPROVED",

        // Price values
        oldPrice: null, // calculated client-side
        newPrice:
          r.proposed_price !== null && r.proposed_price !== undefined
            ? Number(r.proposed_price)
            : null,
        priceDifference: null,
        priceMovement: null,
        priceChangePercentage: null,

        currentLivePrice: live?.price ?? null,
        currentPriceStatus: live?.status ?? null,

        // Audit timestamps
        requestedAt: r.requested_at ?? null,
        approvedAt: r.approved_at ?? null,
        rejectedAt: r.rejected_at ?? null,
        priceChangeDatetime: r.approved_at ?? r.requested_at ?? null,

        // Audit metadata
        rejectReason: r.reject_reason ?? null,
        productSupplierMappingId: productSupplierMappingId,
        supplierProductValidation: supplierProductValidation,

        // User references
        requestedBy:
          r.requested_by && /^\d+$/.test(String(r.requested_by))
            ? Number(r.requested_by)
            : null,
        requestedByName: r.requested_by
          ? userNamesMap.get(String(r.requested_by)) ?? null
          : null,
        approvedBy:
          r.approved_by && /^\d+$/.test(String(r.approved_by))
            ? Number(r.approved_by)
            : null,
        approvedByName: r.approved_by
          ? userNamesMap.get(String(r.approved_by)) ?? null
          : null,
        rejectedBy:
          r.rejected_by && /^\d+$/.test(String(r.rejected_by))
            ? Number(r.rejected_by)
            : null,
        rejectedByName: r.rejected_by
          ? userNamesMap.get(String(r.rejected_by)) ?? null
          : null,
      };
    });

    return NextResponse.json(records);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Internal server error";

    console.error("[price-monitoring] API Route Error:", error);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
