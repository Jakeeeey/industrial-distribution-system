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
    
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    params.set("meta", "filter_count,total_count");
    params.set("fields", "product_id,isActive,product_brand,product_code,product_name,description,short_description,unit_of_measurement,unit_of_measurement_count,product_category,cost_per_unit,price_per_unit,is_serialized,product_image,status,created_at,created_by,updated_at,updated_by,last_updated"); 
    params.set("sort", "-created_at");
    
    let filterIdx = 0;
    
    if (q) {
      params.set(`filter[_and][${filterIdx}][_or][0][product_name][_contains]`, q);
      params.set(`filter[_and][${filterIdx}][_or][1][product_code][_contains]`, q);
      filterIdx++;
    }
    
    if (category) {
      params.set(`filter[_and][${filterIdx}][product_category][_eq]`, category);
      filterIdx++;
    }
    
    if (brand) {
      params.set(`filter[_and][${filterIdx}][product_brand][_eq]`, brand);
      filterIdx++;
    }

    if (status) {
      params.set(`filter[_and][${filterIdx}][status][_eq]`, status);
      filterIdx++;
    }

    // Filter only serialized and active products
    params.set(`filter[_and][${filterIdx}][is_serialized][_eq]`, "1");
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
    
    // Add audit fields if necessary or let Directus handle it
    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}`, {
      method: "POST",
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
