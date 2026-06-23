// =============================================================================
// API Route: /api/ids/fm/product-pricing/price-monitoring
// Module    : Price Monitoring (Phase 1 — read-only)
// Spring    : GET /api/view-price-monitoring/filter
// Params    : productId (required), supplierId (optional)
// Returns   : ViewPriceMonitoringDto[] — APPROVED rows only (filtered by Spring)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE = process.env.SPRING_API_BASE_URL;
const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

/**
 * Spring Boot endpoint for the v_price_monitoring view.
 * Accepts: productId (required), supplierId (optional).
 * Always returns only APPROVED request rows (enforced by the view query).
 */
const SPRING_ENDPOINT = "/api/view-price-monitoring/filter";

/**
 * Filter keys forwarded to the Spring API.
 * productId  → required; validated below before forwarding.
 * supplierId → optional; omit when blank/missing to return all suppliers.
 */
const FILTER_KEYS = ["productId", "supplierId"] as const;

function getDirectusHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

export async function GET(req: NextRequest) {
  try {
    const token =
      req.headers.get("authorization")?.replace("Bearer ", "") ||
      req.cookies.get("vos_access_token")?.value;

    const { searchParams } = new URL(req.url);

    // =========================================================================
    // DIRECTUS PROXY (inherited from standard route template)
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
    // VALIDATION — productId is required (spec §4.1 and §6.2)
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

    // supplierId is optional — validate only when present
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

    if (!SPRING_API_BASE) {
      return NextResponse.json(
        { error: "Spring API base URL is not configured" },
        { status: 500 },
      );
    }

    // =========================================================================
    // SPRING API REQUEST
    // Forwards productId and supplierId (when present and valid).
    // =========================================================================
    const url = new URL(`${SPRING_API_BASE}${SPRING_ENDPOINT}`);

    /**
     * Append each filter key if present, non-blank, and not "all".
     * CSV multi-value is not used here — Spring accepts single values.
     */
    const appendFilterValue = (name: (typeof FILTER_KEYS)[number]) => {
      const raw = searchParams.get(name);
      if (!raw || raw.trim() === "" || raw.toLowerCase() === "all") return;
      url.searchParams.append(name, raw.trim());
    };

    FILTER_KEYS.forEach(appendFilterValue);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    // =========================================================================
    // SAFE PARSE
    // =========================================================================
    const text = await response.text();
    let data: unknown = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        {
          error: response.ok
            ? "Unexpected non-JSON response"
            : text || "Request failed",
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    // =========================================================================
    // HANDLE ERROR RESPONSE
    // =========================================================================
    if (!response.ok) {
      const dataObj =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : null;

      const errMsg =
        dataObj?.message || dataObj?.error || "Backend request failed";

      return NextResponse.json(
        { error: errMsg },
        { status: response.status },
      );
    }

    // =========================================================================
    // NORMALIZE RESPONSE
    // Spring returns: ViewPriceMonitoringDto[] (flat array)
    // Spec §7.1: Body is Array<ViewPriceMonitoringDto>
    // =========================================================================
    let records: unknown[] = [];

    if (Array.isArray(data)) {
      records = data;
    } else if (data && typeof data === "object") {
      const dataObj = data as Record<string, unknown>;
      if (Array.isArray(dataObj.data)) {
        records = dataObj.data as unknown[];
      }
    }
    return NextResponse.json(records);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Internal server error";

    console.error("[price-monitoring] API Route Error:", error);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
