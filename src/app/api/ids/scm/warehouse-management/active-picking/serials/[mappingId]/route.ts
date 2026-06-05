import { NextRequest, NextResponse } from "next/server";
import { ActivePickingService } from "@/modules/industrial-distribution-system/supply-chain-management/warehouse-management/active-picking/services/active-picking.service";

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
        const userId = searchParams.get("userId") ? parseInt(searchParams.get("userId")!) : null;

        const result = await ActivePickingService.removeSerialPick(id, detailId, userId);
        
        return NextResponse.json(result);
    } catch (err) {
        const error = err as Error;
        return NextResponse.json({ error: "Failed to delete serial", details: error.message }, { status: 400 });
    }
}
