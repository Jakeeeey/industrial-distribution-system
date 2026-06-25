import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth-utils";
import { ActivePickingRepo } from "@/modules/industrial-distribution-system/supply-chain-management/warehouse-management/active-picking/services/active-picking.repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DecodedToken {
    id?: number | string;
    sub?: number | string;
    userId?: number | string;
    user_id?: number | string;
}

// Added DecodedToken interface and updated return type from any to resolve @typescript-eslint/no-explicit-any
function decodeJwtPayload(token: string): DecodedToken | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const base64Url = parts[1];
        if (!base64Url) return null;

        let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) {
            base64 += "=";
        }

        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return JSON.parse(jsonPayload) as DecodedToken;
    } catch {
        return null;
    }
}


function getUserIdFromToken(token: string | undefined): number | null {
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    if (!payload) return null;
    const idValue = payload.id ?? payload.sub ?? payload.userId ?? payload.user_id;
    if (idValue === undefined || idValue === null) return null;
    const num = Number(idValue);
    return isNaN(num) ? null : num;
}

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("vos_access_token")?.value || cookieStore.get(COOKIE_NAME)?.value;
        const userId = getUserIdFromToken(token);

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized: Invalid or missing session" }, { status: 401 });
        }

        const body = await req.json();
        const { product_id, serial_number, cylinder_condition, current_branch_id, expiration_date, tare_weight, remarks } = body;

        if (!product_id || !serial_number || !current_branch_id) {
            return NextResponse.json({ error: "Missing required fields (product_id, serial_number, current_branch_id)" }, { status: 400 });
        }

        const now = new Date();
        const manilaOffset = 8 * 60; // minutes
        const manilaTime = new Date(now.getTime() + (manilaOffset + now.getTimezoneOffset()) * 60000);
        const timestamp = manilaTime.toISOString().replace('Z', '+08:00');

        const payload = {
            product_id: Number(product_id),
            serial_number: serial_number.trim().toUpperCase(),
            cylinder_status: "AVAILABLE",
            cylinder_condition: cylinder_condition || "GOOD",
            current_branch_id: Number(current_branch_id),
            expiration_date: expiration_date || null,
            tare_weight: tare_weight ? parseFloat(tare_weight) : null,
            remarks: remarks || null,
            created_by: userId,
            created_date: timestamp
        };

        const result = await ActivePickingRepo.createCylinderAsset(payload);

        return NextResponse.json({ success: true, data: result }, { status: 201 });
    } catch (err) {
        const error = err as Error;
        return NextResponse.json({ error: "Failed to register cylinder asset", details: error.message }, { status: 400 });
    }
}
