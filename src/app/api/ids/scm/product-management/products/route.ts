import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const COLLECTION = "products";

function getHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (DIRECTUS_TOKEN) {
    headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  }
  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const category = searchParams.get("category");
    const brand = searchParams.get("brand");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const sort = searchParams.get("sort") || "-created_at";

    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    params.set("meta", "filter_count,total_count");
    params.set("fields", "product_id,isActive,product_brand,product_code,product_name,description,short_description,unit_of_measurement,unit_of_measurement_count,product_category,cost_per_unit,price_per_unit,is_serialized,product_image,status,created_at,created_by,updated_at,updated_by,last_updated,parent_id,uom_ids");
    params.set("sort", sort);

    let filterIdx = 0;

    if (q) {
      params.set(`filter[_and][${filterIdx}][_or][0][product_name][_contains]`, q);
      params.set(`filter[_and][${filterIdx}][_or][1][product_code][_contains]`, q);
      filterIdx++;
    }

    if (category && category !== "all") {
      params.set(`filter[_and][${filterIdx}][product_category][_eq]`, category);
      filterIdx++;
    }

    if (brand && brand !== "all") {
      params.set(`filter[_and][${filterIdx}][product_brand][_eq]`, brand);
      filterIdx++;
    }

    if (status && status !== "all") {
      params.set(`filter[_and][${filterIdx}][status][_eq]`, status);
      filterIdx++;
    }

    // Filter only industrial brand products and active products
    params.set(`filter[_and][${filterIdx}][product_brand][is_industrial][_eq]`, "1");
    filterIdx++;
    params.set(`filter[_and][${filterIdx}][isActive][_eq]`, "1");
    filterIdx++;

    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}?${params.toString()}`, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if we are creating a parent product (no parent_id and no uom_ids)
    const hasParentId = body.parent_id !== undefined && body.parent_id !== null && body.parent_id !== "" && body.parent_id !== 0;
    const hasUomIds = body.uom_ids !== undefined && body.uom_ids !== null && body.uom_ids !== "";
    const isParent = !hasParentId && !hasUomIds;

    // Hardcode Manila Time (UTC+8)
    const manilaTime = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19);

    // Fetch units table to resolve unit_id by matching unit_shortcut
    const unitsRes = await fetch(
      `${DIRECTUS_URL}/items/units?limit=-1&fields=unit_id,unit_shortcut`,
      { headers: getHeaders(), cache: "no-store" }
    );
    const unitsJson = unitsRes.ok ? await unitsRes.json() : {};
    const allUnits: { unit_id: number; unit_shortcut: string }[] = unitsJson.data ?? [];

    // Build a case-insensitive unit_shortcut → unit_id map
    const unitShortcutMap = new Map<string, number>();
    for (const u of allUnits) {
      if (u.unit_shortcut) unitShortcutMap.set(u.unit_shortcut.trim().toUpperCase(), u.unit_id);
    }

    const isSerialized = body.is_serialized === 1 || body.is_serialized === "1" || body.is_serialized === true;

    const resolvedParentUomId = isSerialized ? (unitShortcutMap.get("FULL") ?? 16) : (body.unit_of_measurement || 16);

    const parentPayload = {
      ...body,
      unit_of_measurement: resolvedParentUomId,
      date_added: manilaTime,
      status: "Approved"
    };

    // Create the primary product first
    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(parentPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    const parentData = await response.json();
    const parentProduct = parentData.data;

    // If it is a parent product, automatically generate the standard children variations
    if (isParent && parentProduct && parentProduct.product_id && isSerialized) {
      const variants = ["EMPTY", "SWAP", "OUTRIGHT", "DEPOSIT", "REFILL"];
      const parentId = parentProduct.product_id;

      const children = variants.map(variant => {
        // Resolve unit_id from units table where unit_shortcut matches the variant; fallback to 16
        const resolvedUomId = unitShortcutMap.get(variant.toUpperCase()) ?? 16;

        return {
          ...body,
          parent_id: parentId,
          uom_ids: variant,
          product_name: parentProduct.product_name || body.product_name,
          description: `${parentProduct.description || body.description || ""} ${variant}`.trim(),
          product_code: `${parentProduct.product_code || body.product_code || ""} ${variant}`.trim(),
          isActive: 1,
          unit_of_measurement: resolvedUomId,
          date_added: manilaTime,
          status: "Approved"
        };
      });

      const childrenRes = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(children),
      });

      if (!childrenRes.ok) {
        const childError = await childrenRes.text();
        console.error("[Products API] Failed to auto-generate child products:", childError);
      }
    }

    return NextResponse.json(parentData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const body = await req.json();
    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const ids = searchParams.get("ids"); // For bulk delete

    if (ids) {
      const idList = ids.split(",");
      const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          keys: idList,
          data: {
            isActive: 0,
            status: "Inactive"
          }
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json({ error }, { status: response.status });
      }
      return NextResponse.json({ success: true });
    }

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({
        isActive: 0,
        status: "Inactive"
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
