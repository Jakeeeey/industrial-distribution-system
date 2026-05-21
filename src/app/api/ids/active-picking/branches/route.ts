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
    } catch (err) {
        const error = err as Error;
        return NextResponse.json({ error: "Failed to fetch branches", details: error.message }, { status: 500 });
    }
}
