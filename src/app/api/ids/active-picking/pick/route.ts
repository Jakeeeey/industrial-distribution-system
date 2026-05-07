import { NextRequest, NextResponse } from "next/server";
import { ActivePickingService } from "@/modules/industrial-distribution-system/active-picking/services/active-picking.service";
import { ScanSerialSchema } from "@/modules/industrial-distribution-system/active-picking/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // Validate basic payload
        const { detail_id, serial_number, branchId } = body;
        const userId = body.userId || null;

        if (!detail_id || !serial_number || !branchId) {
            return NextResponse.json({ error: "Missing required fields (detail_id, serial_number, branchId)" }, { status: 400 });
        }

        const result = await ActivePickingService.processSerialPick(detail_id, serial_number, userId, branchId);
        
        return NextResponse.json(result);
    } catch (err: any) {
        console.error("[Active Picking API] Error processing pick:", err.message);
        
        return NextResponse.json({ error: "Failed to process pick", details: err.message }, { status: 400 });
    }
}
