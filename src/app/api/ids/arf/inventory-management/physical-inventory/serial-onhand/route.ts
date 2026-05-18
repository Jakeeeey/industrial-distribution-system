import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

type SpringSerialOnhandRow = {
    productId: number;
};

type SerialOnhandResult = {
    ok: boolean;
    item: SpringSerialOnhandRow | null;
    message?: string;
};

function toProductItem(payload: unknown): SpringSerialOnhandRow | null {
    if (Array.isArray(payload) && payload.length > 0) {
        const first = payload[0];
        if (
            first &&
            typeof first === "object" &&
            "productId" in first &&
            Number.isFinite(Number((first as { productId: unknown }).productId))
        ) {
            return {
                productId: Number((first as { productId: unknown }).productId),
            };
        }
    }

    if (
        payload &&
        typeof payload === "object" &&
        "productId" in payload &&
        Number.isFinite(Number((payload as { productId: unknown }).productId))
    ) {
        return {
            productId: Number((payload as { productId: unknown }).productId),
        };
    }

    return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
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

        const targetUrl = new URL(
            `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/v-serial-onhand/filter`,
        );

        targetUrl.searchParams.set("serialNumber", serial);
        targetUrl.searchParams.set("branchId", branchId);

        const springRes = await fetch(targetUrl.toString(), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
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

        const parsed: unknown = text ? JSON.parse(text) : [];
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