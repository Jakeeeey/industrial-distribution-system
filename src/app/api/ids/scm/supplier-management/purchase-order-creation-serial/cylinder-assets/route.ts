// src/app/api/ids/scm/supplier-management/purchase-order-creation-serial/cylinder-assets/route.ts
// Purpose: Verify if a serial number exists in cylinder_assets table.
// Filters: Enforce that it matches the serial_number exactly.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDirectusBase(): string {
    const raw = process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const cleaned = raw.trim().replace(/\/$/, "");
    if (!cleaned) throw new Error("DIRECTUS_URL is not set.");
    return /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
}

function getDirectusToken(): string {
    const token = (process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_TOKEN || "").trim();
    if (!token) throw new Error("DIRECTUS_STATIC_TOKEN is not set.");
    return token;
}

async function directusFetch(url: string): Promise<Response> {
    return fetch(url, {
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getDirectusToken()}`,
        },
    });
}

export async function GET(req: NextRequest) {
    try {
        const base = getDirectusBase();
        const { searchParams } = new URL(req.url);
        const serialNumber = searchParams.get("serial_number");

        if (!serialNumber) {
            return NextResponse.json({ error: "serial_number is required" }, { status: 400 });
        }

        const encodedSerial = encodeURIComponent(serialNumber.trim());
        const url = `${base}/items/cylinder_assets?filter[serial_number][_eq]=${encodedSerial}&fields=id,serial_number,product_id.product_id,product_id.product_name,cylinder_status`;
        const res = await directusFetch(url);
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
            return NextResponse.json({ error: "Failed to fetch cylinder assets", details: json }, { status: res.status });
        }

        const data = json?.data || [];

        if (data.length > 0) {
            const asset = data[0];
            return NextResponse.json({ 
                exists: true, 
                asset: {
                    id: asset.id,
                    serial_number: asset.serial_number,
                    product_id: asset.product_id?.product_id || asset.product_id,
                    product_name: asset.product_id?.product_name || "Unknown Product",
                    cylinder_status: asset.cylinder_status
                },
                is_empty: asset.cylinder_status === "EMPTY" || asset.cylinder_status === "AVAILABLE"
            });
        }

        return NextResponse.json({ exists: false });
    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
