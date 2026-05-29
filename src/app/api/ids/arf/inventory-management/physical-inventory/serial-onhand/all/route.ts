// src/app/api/ids/arf/inventory-management/physical-inventory/serial-onhand/all/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";
const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === "true";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    // When auth is disabled (dev mode), skip the token check
    if (!AUTH_DISABLED && !token) {
        return NextResponse.json(
            { ok: false, message: "Unauthorized: Missing access token" },
            { status: 401 },
        );
    }

    if (!SPRING_API_BASE_URL) {
        return NextResponse.json(
            { ok: false, message: "SPRING_API_BASE_URL is not configured." },
            { status: 500 },
        );
    }

    try {
        const incomingUrl = new URL(req.url);
        const branchId = incomingUrl.searchParams.get("branchId")?.trim() ?? "";

        if (!branchId) {
            return NextResponse.json(
                { ok: false, message: "branchId is required." },
                { status: 400 },
            );
        }

        // Fetch all serials for a branch using the filter endpoint without a serialNumber
        const targetUrl = new URL(
            `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/filter`,
        );

        targetUrl.searchParams.set("branchId", branchId);

        const headers: Record<string, string> = {
            Accept: "application/json",
        };

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
            headers["Cookie"] = `vos_access_token=${token}`;
        }

        const springRes = await fetch(targetUrl.toString(), {
            method: "GET",
            headers,
            cache: "no-store",
        });

        if (!springRes.ok) {
            const text = await springRes.text();
            return new NextResponse(text || "Bulk Serial on-hand fetch failed.", {
                status: springRes.status,
                headers: {
                    "Content-Type":
                        springRes.headers.get("content-type") ?? "application/json",
                },
            });
        }

        const data = await springRes.json();
        // Normalize: Spring may return a single object or an array
        const normalized = Array.isArray(data) ? data : [data].filter(Boolean);
        return NextResponse.json({ ok: true, data: normalized });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Bulk Serial on-hand fetch failed.";

        return NextResponse.json(
            { ok: false, message },
            { status: 502 },
        );
    }
}
