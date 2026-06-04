import { NextRequest, NextResponse } from "next/server";
import { ActivePickingService } from "@/modules/industrial-distribution-system/supply-chain-management/warehouse-management/active-picking/services/active-picking.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const detailId = parseInt(id);

        if (isNaN(detailId)) {
            return NextResponse.json({ error: "Invalid detail ID" }, { status: 400 });
        }

        const serials = await ActivePickingService.getSerialsForDetail(detailId);
        
        return NextResponse.json(serials);
    } catch (err) {
        const error = err as Error;
        return NextResponse.json({ error: "Failed to fetch serials", details: error.message }, { status: 500 });
    }
}
