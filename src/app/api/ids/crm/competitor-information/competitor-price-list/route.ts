import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDirectusBase(): string {
  const raw =
    process.env.DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_DIRECTUS_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";
  const cleaned = raw.trim().replace(/\/$/, "");
  if (!cleaned) return "";
  return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

function getDirectusToken(): string {
  return (
    process.env.DIRECTUS_STATIC_TOKEN ||
    process.env.DIRECTUS_TOKEN ||
    process.env.NEXT_PUBLIC_DIRECTUS_STATIC_TOKEN ||
    ""
  ).trim();
}

const DIRECTUS_BASE = getDirectusBase();
const DIRECTUS_TOKEN = getDirectusToken();

function getDirectusHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

async function directusFetch(path: string): Promise<Response> {
  if (!DIRECTUS_BASE) {
    throw new Error("Directus base URL is not configured");
  }
  return fetch(`${DIRECTUS_BASE}${path}`, {
    method: "GET",
    headers: getDirectusHeaders(),
  });
}

export async function GET(req: NextRequest) {
  try {
    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "DIRECTUS base URL not configured" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(req.url);

    // ─── Directus Proxy (generic) ─────────────────────────────────────────────
    // Used for competitors dropdown: ?directusCollection=competitors
    const directusCollection = searchParams.get("directusCollection");
    if (directusCollection) {
      const proxyParams = new URLSearchParams(searchParams.toString());
      proxyParams.delete("directusCollection");

      const res = await directusFetch(
        `/items/${encodeURIComponent(directusCollection)}${
          proxyParams.toString() ? `?${proxyParams.toString()}` : ""
        }`,
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const status =
          res.status === 401 || res.status === 403 ? 502 : res.status;
        return NextResponse.json(
          {
            error:
              res.status === 401 || res.status === 403
                ? `Directus authentication failed (${res.status})`
                : `Directus request failed (${res.status})`,
            details: body || undefined,
          },
          { status },
        );
      }

      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "content-type": res.headers.get("content-type") || "application/json",
        },
      });
    }

    // ─── Competitor Price List — Directus query ────────────────────────────────
    //
    // All data lives in Directus: /items/competitor_price_list
    // We expand competitor_id so the UI can display the competitor name.
    // Filters are applied server-side via Directus filter syntax.
    //
    const params = new URLSearchParams();

    // Fetch the price-list fields plus a lightweight competitor expansion.
    params.set(
      "fields",
      "id,competitor_id.*,product_id,source_type,size,price,price_vs_us,created_at",
    );
    params.set("limit", "-1"); // fetch all (analytics computed client-side)
    params.set("sort", "-created_at");

    // Filter: competitor
    const competitorId = searchParams.get("competitorId");
    if (competitorId && competitorId !== "all") {
      params.set("filter[competitor_id][_eq]", competitorId);
    }

    // Filter: province
    const province = searchParams.get("province");
    if (province && province !== "all") {
      params.set("filter[competitor_id][province][_eq]", province);
    }

    // Filter: municipality
    const municipality = searchParams.get("municipality");
    if (municipality && municipality !== "all") {
      params.set("filter[competitor_id][city][_eq]", municipality);
    }

    // Filter: barangay
    const barangay = searchParams.get("barangay");
    if (barangay && barangay !== "all") {
      params.set("filter[competitor_id][barangay][_eq]", barangay);
    }

    // Filter: source_type
    const sourceType = searchParams.get("sourceType");
    if (sourceType && sourceType !== "all") {
      params.set("filter[source_type][_eq]", sourceType);
    }

    const res = await directusFetch(
      `/items/competitor_price_list?${params.toString()}`,
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const status =
        res.status === 401 || res.status === 403 ? 502 : res.status;
      return NextResponse.json(
        {
          error:
            res.status === 401 || res.status === 403
              ? `Directus authentication failed (${res.status})`
              : `Failed to load competitor price list (${res.status})`,
          details: body || undefined,
        },
        { status },
      );
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "Unexpected non-JSON response from Directus",
          details: text.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const dataObj =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    const records = Array.isArray(dataObj?.data) ? dataObj.data : [];

    const mappedRecords = records.map((r) => {
      const record = r as Record<string, unknown>;
      if (
        record &&
        record.competitor_id &&
        typeof record.competitor_id === "object"
      ) {
        const comp = record.competitor_id as Record<string, unknown>;
        return {
          ...record,
          province: comp.province,
          municipality: comp.city,
          barangay: comp.barangay,
        };
      }
      return record;
    });

    return NextResponse.json(mappedRecords);
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Competitor Price List API Route Error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
