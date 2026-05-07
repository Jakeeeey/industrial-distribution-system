import { NextRequest, NextResponse } from "next/server";
import { ActivePickingService } from "@/modules/industrial-distribution-system/active-picking/services/active-picking.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const consolidatorId = parseInt(id);

        if (isNaN(consolidatorId)) {
            return NextResponse.json({ error: "Invalid consolidator ID" }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const branchIdStr = searchParams.get("branchId") || "196";
        const branchId = parseInt(branchIdStr);

        const details = await ActivePickingService.getPickingDetails(consolidatorId, branchId);
        
        return NextResponse.json(details);
    } catch (err: any) {
        console.error(`[Active Picking API] Error fetching details for ID ${err.message}`);
        return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
    }
}
