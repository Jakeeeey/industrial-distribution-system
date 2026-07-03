// src/app/api/ids/arf/traceability-compliance/cylinder-movements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { rawSerialMovementListSchema } from "@/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/schema";
import { SerialMovement } from "@/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPRING_API_BASE_URL = process.env.SPRING_API_BASE_URL;
const COOKIE_NAME = "vos_access_token";

interface RawSerialMovement {
    movementAt?: unknown;
    ts?: unknown;
    productId?: unknown;
    product_id?: unknown;
    productName?: unknown;
    product_name?: unknown;
    serialNumber?: unknown;
    serial_number?: unknown;
    branchId?: unknown;
    branch_id?: unknown;
    branchName?: unknown;
    branch_name?: unknown;
    documentNo?: unknown;
    docNo?: unknown;
    doc_no?: unknown;
    documentType?: unknown;
    docType?: unknown;
    doc_type?: unknown;
    inQty?: unknown;
    in_qty?: unknown;
    outQty?: unknown;
    out_qty?: unknown;
}

/**
 * Normalizes snake_case or camelCase properties from Spring Boot to a strict camelCase SerialMovement object.
 */
// Comment: Normalized shape from Spring Boot API response avoiding explicit any
function normalizeRow(raw: unknown): SerialMovement {
    const r = raw as RawSerialMovement;
    return {
        movementAt: String(r.movementAt ?? r.ts ?? "").trim(),
        productId: Number(r.productId ?? r.product_id ?? 0),
        productName: String(r.productName ?? r.product_name ?? "").trim(),
        serialNumber: String(r.serialNumber ?? r.serial_number ?? "").trim(),
        branchId: Number(r.branchId ?? r.branch_id ?? 0),
        branchName: String(r.branchName ?? r.branch_name ?? "").trim(),
        documentNo: String(r.documentNo ?? r.docNo ?? r.doc_no ?? "").trim(),
        documentType: String(r.documentType ?? r.docType ?? r.doc_type ?? "").trim(),
        inQty: Number(r.inQty ?? r.in_qty ?? 0),
        outQty: Number(r.outQty ?? r.out_qty ?? 0),
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

        // Comment: Avoid explicit 'any' for incoming raw json data
        const rawData = (await springRes.json()) as unknown;

        // Extract array from either raw list or wrapped envelopes
        let dataArray: unknown[] = [];
        if (Array.isArray(rawData)) {
            dataArray = rawData;
        } else if (rawData && typeof rawData === "object") {
            const obj = rawData as Record<string, unknown>;
            if (Array.isArray(obj.v_serial_movements)) {
                dataArray = obj.v_serial_movements;
            } else if (Array.isArray(obj.data)) {
                dataArray = obj.data;
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
