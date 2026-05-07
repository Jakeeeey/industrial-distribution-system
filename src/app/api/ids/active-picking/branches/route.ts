import { NextRequest, NextResponse } from "next/server";
import { ActivePickingService } from "@/modules/industrial-distribution-system/active-picking/services/active-picking.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const divisionIdStr = searchParams.get("divisionId") || "1";
        const divisionId = parseInt(divisionIdStr);

        if (isNaN(divisionId)) {
            return NextResponse.json({ error: "Invalid division ID" }, { status: 400 });
        }

        const branches = await ActivePickingService.getBranches(divisionId);
        
        return NextResponse.json(branches);
    } catch (err: any) {
        console.error("[Active Picking API] Error fetching branches:", err.message);
        return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
    }
}
