import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const COLLECTION = "categories";

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
    
    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("fields", "category_id,category_name,sku_code,image,created_by,created_at,updated_by,updated_at");
    params.set("sort", "category_name");
    
    if (q) {
      params.set("filter[category_name][_icontains]", q);
    }
    
    params.set("filter[is_industrial][_eq]", "1");

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

function getManilaTimeString(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).replace(" ", "T");
}

// AG-COMMENT: Helper to extract authenticated user ID from JWT cookies or Authorization header
function extractUserIdFromRequest(req: NextRequest, explicitUserId?: number | string | null): number {
  if (explicitUserId !== undefined && explicitUserId !== null && !isNaN(Number(explicitUserId)) && Number(explicitUserId) > 0) {
    return Number(explicitUserId);
  }

  try {
    const token = req.cookies.get("vos_access_token")?.value ||
                  req.cookies.get("springboot_token")?.value ||
                  req.cookies.get("token")?.value ||
                  (req.headers.get("authorization")?.startsWith("Bearer ")
                    ? req.headers.get("authorization")?.substring(7)
                    : req.headers.get("authorization"));

    if (token) {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const payloadPart = parts[1];
        const pad = "=".repeat((4 - (payloadPart.length % 4)) % 4);
        const b64 = (payloadPart + pad).replace(/-/g, "+").replace(/_/g, "/");
        const jsonStr = Buffer.from(b64, "base64").toString("utf8");
        const payload = JSON.parse(jsonStr);

        const rawId = payload.user_id ?? payload.userId ?? payload.id ?? payload.sub;
        if (rawId !== undefined && rawId !== null) {
          const num = Number(rawId);
          if (!isNaN(num) && num > 0) return num;
        }
      }
    }
  } catch (err) {
    console.error("[Categories API] Error decoding JWT token for user ID:", err);
  }

  return 1;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const manilaTime = getManilaTimeString();
    const userId = extractUserIdFromRequest(req, body.created_by || body.updated_by);

    const payload = {
      ...body,
      created_at: manilaTime,
      updated_at: manilaTime,
      created_by: userId,
      updated_by: userId,
    };

    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
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
    const manilaTime = getManilaTimeString();
    const userId = extractUserIdFromRequest(req, body.updated_by);

    const payload = {
      ...body,
      updated_at: manilaTime,
      updated_by: userId,
    };

    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(payload),
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
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const response = await fetch(`${DIRECTUS_URL}/items/${COLLECTION}/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
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
