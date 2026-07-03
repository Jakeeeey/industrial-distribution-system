// src/app/api/ids/arf/traceability-compliance/cylinder-movements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { rawSerialMovementListSchema } from "@/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/schema";
import { SerialMovement } from "@/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

/**
 * Normalizes snake_case or camelCase properties from Spring Boot to a strict camelCase SerialMovement object.
 */
function normalizeRow(raw: any): SerialMovement {
    return {
        movementAt: String(raw.movementAt ?? raw.ts ?? "").trim(),
        productId: Number(raw.productId ?? raw.product_id ?? 0),
        productName: String(raw.productName ?? raw.product_name ?? "").trim(),
        serialNumber: String(raw.serialNumber ?? raw.serial_number ?? "").trim(),
        branchId: Number(raw.branchId ?? raw.branch_id ?? 0),
        branchName: String(raw.branchName ?? raw.branch_name ?? "").trim(),
        documentNo: String(raw.documentNo ?? raw.docNo ?? raw.doc_no ?? "").trim(),
        documentType: String(raw.documentType ?? raw.docType ?? raw.doc_type ?? "").trim(),
        inQty: Number(raw.inQty ?? raw.in_qty ?? 0),
        outQty: Number(raw.outQty ?? raw.out_qty ?? 0),
    };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
        console.error("[Cylinder Movements Proxy] No vos_access_token cookie found!");
        return NextResponse.json(
            { ok: false, message: "Unauthorized: Missing access token" },
            { status: 401 },
        );
    }

    if (!SPRING_API_BASE_URL) {
        console.error("[Cylinder Movements Proxy] SPRING_API_BASE_URL is not defined in environment");
        return NextResponse.json(
            { ok: false, error: "SPRING_API_BASE_URL is not configured." },
            { status: 500 },
        );
    }

    try {
        const targetUrl = `${SPRING_API_BASE_URL.replace(/\/$/, "")}/api/view-serial-movements/all`;
        console.log(`[Cylinder Movements Proxy] Proxying GET request to: ${targetUrl}`);

        const springRes = await fetch(targetUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        console.log(`[Cylinder Movements Proxy] Spring Response Code: ${springRes.status}`);

        if (!springRes.ok) {
            const errorText = await springRes.text().catch(() => "");
            console.error(`[Cylinder Movements Proxy] Spring error: ${springRes.statusText} (${errorText})`);
            return NextResponse.json(
                { ok: false, error: `Spring API returned error status ${springRes.status}` },
                { status: springRes.status },
            );
        }

        const rawData = await springRes.json();

        // Extract array from either raw list or wrapped envelopes
        let dataArray: any[] = [];
        if (Array.isArray(rawData)) {
            dataArray = rawData;
        } else if (rawData && typeof rawData === "object") {
            if (Array.isArray(rawData.v_serial_movements)) {
                dataArray = rawData.v_serial_movements;
            } else if (Array.isArray(rawData.data)) {
                dataArray = rawData.data;
            }
        }

        // 1. Zod runtime verification (optional validation check)
        const parsed = rawSerialMovementListSchema.safeParse(dataArray);
        if (!parsed.success) {
            console.error("[Cylinder Movements Proxy] Schema validation failed:", parsed.error.format());
        }

        // 2. Normalization & Filtering (Trim blank/invalid serials)
        const normalized: SerialMovement[] = dataArray
            .map(normalizeRow)
            .filter((row) => {
                // Treat blank serial numbers as invalid
                return row.serialNumber && row.serialNumber !== "—" && row.serialNumber !== "";
            });

        return NextResponse.json({ ok: true, data: normalized });
    } catch (err) {
        console.error("[Cylinder Movements Proxy] Network or server error:", err);
        return NextResponse.json(
            { ok: false, error: "Internal Server Error during endpoint proxying" },
            { status: 500 },
        );
    }
}
