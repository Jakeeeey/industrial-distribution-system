import { NextRequest, NextResponse } from "next/server";
import { ActivePickingService } from "@/modules/industrial-distribution-system/active-picking/services/active-picking.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { consolidatorId, status } = body;

        if (!consolidatorId) {
            return NextResponse.json({ error: "consolidatorId is required" }, { status: 400 });
        }

        await ActivePickingService.completePicking(consolidatorId, status || "Picked");
        
        return NextResponse.json({ success: true });
    } catch (err) {
        const error = err as Error;
        console.error(`[Active Picking API] Error completing picking: ${error.message}`);
        return NextResponse.json({ error: "Failed to complete picking" }, { status: 500 });
    }
}
