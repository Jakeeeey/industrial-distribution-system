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

        const sessionToken = req.cookies.get("springboot_token")?.value || req.cookies.get("vos_access_token")?.value || null;
        const details = await ActivePickingService.getPickingDetails(consolidatorId, branchId, sessionToken);
        
        return NextResponse.json(details);
    } catch (err) {
        const error = err as Error;
        return NextResponse.json({ error: "Failed to fetch details", details: error.message }, { status: 500 });
    }
}
