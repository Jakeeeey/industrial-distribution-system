// src/app/api/ids/arf/inventory-management/physical-inventory/serial-onhand/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";
const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === "true";

type SpringSerialOnhandRow = {
    id?: number;
    productId: number;
    branchId?: number;
    serialNumber?: string;
};

type SerialOnhandResult = {
    ok: boolean;
    item: SpringSerialOnhandRow | null;
    message?: string;
};

function toProductItem(payload: unknown): SpringSerialOnhandRow | null {
    // Spring returns a single object: { id, productId, branchId, serialNumber }
    if (Array.isArray(payload) && payload.length > 0) {
        const first = payload[0];
        if (
            first &&
            typeof first === "object" &&
            "productId" in first &&
            Number.isFinite(Number((first as { productId: unknown }).productId))
        ) {
            return first as SpringSerialOnhandRow;
        }
    }

    if (
        payload &&
        typeof payload === "object" &&
        "productId" in payload &&
        Number.isFinite(Number((payload as { productId: unknown }).productId))
    ) {
        return payload as SpringSerialOnhandRow;
    }

    return null;
}

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
        const serial = incomingUrl.searchParams.get("serial")?.trim() ?? "";
        const branchId = incomingUrl.searchParams.get("branchId")?.trim() ?? "";

        if (!serial) {
            return NextResponse.json(
                { ok: false, message: "Serial tag is required." },
                { status: 400 },
            );
        }

        if (!branchId) {
            return NextResponse.json(
                { ok: false, message: "branchId is required." },
                { status: 400 },
            );
        }

        // Correct Spring Boot endpoint: /api/v-serial-onhand/filter?serialNumber=...&branchId=...
        const targetUrl = new URL(
            `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/filter`,
        );

        targetUrl.searchParams.set("serialNumber", serial);
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

        const text = await springRes.text();

        if (!springRes.ok) {
            return new NextResponse(text || "Serial on-hand lookup failed.", {
                status: springRes.status,
                headers: {
                    "Content-Type":
                        springRes.headers.get("content-type") ?? "application/json",
                },
            });
        }

        const parsed: unknown = text ? JSON.parse(text) : null;
        const item = toProductItem(parsed);

        const result: SerialOnhandResult = {
            ok: true,
            item,
            message: item ? undefined : "Serial not found in on-hand records.",
        };

        return NextResponse.json(result);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Serial on-hand lookup failed.";

        return NextResponse.json(
            { ok: false, message },
            { status: 502 },
        );
    }
}