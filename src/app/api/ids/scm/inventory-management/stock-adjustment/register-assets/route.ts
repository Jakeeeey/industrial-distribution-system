
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { assets } = await req.json();

    if (!assets || !Array.isArray(assets)) {
      return NextResponse.json({ error: "Invalid assets data" }, { status: 400 });
    }

    const directusBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const directusToken = process.env.DIRECTUS_STATIC_TOKEN;

    if (!directusBase || !directusToken) {
      throw new Error("Directus configuration missing");
    }

    const url = `${directusBase.replace(/\/$/, "")}/items/cylinder_assets_draft`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${directusToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(assets),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Directus registration error:", errorData);
      return NextResponse.json({ error: errorData.errors?.[0]?.message || "Failed to register cylinders in Directus" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ data: data.data });
  } catch (err) {
    console.error("Register Assets API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
