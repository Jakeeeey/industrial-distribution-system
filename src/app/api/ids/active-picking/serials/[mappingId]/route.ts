import { NextRequest, NextResponse } from "next/server";
import { ActivePickingService } from "@/modules/industrial-distribution-system/active-picking/services/active-picking.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ mappingId: string }> }
) {
    try {
        const { mappingId } = await params;
        const id = parseInt(mappingId);

        if (isNaN(id)) {
            return NextResponse.json({ error: "Invalid mapping ID" }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const detailIdStr = searchParams.get("detailId");
        if (!detailIdStr) {
            return NextResponse.json({ error: "detailId is required" }, { status: 400 });
        }
        const detailId = parseInt(detailIdStr);

        const result = await ActivePickingService.removeSerialPick(id, detailId);
        
        return NextResponse.json(result);
    } catch (err: any) {
        console.error(`[Active Picking API] Error deleting serial ${err.message}`);
        return NextResponse.json({ error: "Failed to delete serial" }, { status: 500 });
    }
}
