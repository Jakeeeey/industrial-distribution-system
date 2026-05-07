import { NextRequest, NextResponse } from "next/server";
import { ActivePickingService } from "@/modules/industrial-distribution-system/active-picking/services/active-picking.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { consolidatorId, serial_number, branchId } = body;
        const userId = body.userId || null;
        
        // Extract session token
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get(COOKIE_NAME)?.value || null;

        if (!consolidatorId || !serial_number || !branchId) {
            return NextResponse.json({ error: "Missing required fields (consolidatorId, serial_number, branchId)" }, { status: 400 });
        }

        const result = await ActivePickingService.processSerialPick(consolidatorId, serial_number, userId, branchId, sessionToken);
        
        return NextResponse.json(result);
    } catch (err) {
        const error = err as Error;
        console.error("[Active Picking API] Error processing pick:", error.message);
        
        return NextResponse.json({ error: "Failed to process pick", details: error.message }, { status: 400 });
    }
}
