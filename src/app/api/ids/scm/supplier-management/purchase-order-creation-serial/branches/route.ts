// src/app/api/ids/scm/supplier-management/purchase-order-creation-serial/branches/route.ts
// Purpose: Fetch all active branches for the Cylinder Serial Return PO module.

import { NextResponse } from "next/server";

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

export async function GET() {
    try {
        const base = getDirectusBase();

        const url =
            `${base}/items/branches` +
            `?limit=-1` +
            `&sort=branch_code` +
            `&fields=id,branch_name,branch_description,branch_code`;

        const res = await directusFetch(url);
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
            return NextResponse.json({ error: "Failed to fetch branches", details: json }, { status: res.status });
        }

        const branches = (Array.isArray(json?.data) ? json.data : []).map(
            (b: Record<string, unknown>) => ({
                id: String(b.id ?? ""),
                name: String(b.branch_name ?? b.branch_description ?? "—"),
                code: String(b.branch_code ?? ""),
            })
        );

        return NextResponse.json({ data: branches });
    } catch (e: unknown) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
