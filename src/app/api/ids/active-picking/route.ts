import { NextRequest, NextResponse } from "next/server";
import { ActivePickingService } from "@/modules/industrial-distribution-system/active-picking/services/active-picking.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        
        const divisionIdStr = searchParams.get("divisionId") || "1";
        const divisionId = parseInt(divisionIdStr);
        const status = searchParams.get("status") || "Picking";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";

        if (isNaN(divisionId)) {
            return NextResponse.json({ error: "Invalid division ID" }, { status: 400 });
        }

        const result = await ActivePickingService.getPickings(divisionId, status, page, limit, search);
        
        return NextResponse.json({ 
            data: result.data, 
            meta: { total: result.meta.filter_count, page, limit } 
        });
    } catch (err) {
        const error = err as Error;
        return NextResponse.json({ error: "Failed to fetch pickings", details: error.message }, { status: 500 });
    }
}
