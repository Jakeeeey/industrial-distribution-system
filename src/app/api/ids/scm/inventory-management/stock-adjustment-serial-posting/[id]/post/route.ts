import { NextRequest, NextResponse } from "next/server";
import { stockAdjustmentService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/services/stock-adjustment-serial-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/auth-utils";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Extract userId from cookie
        const token = request.cookies.get("vos_access_token")?.value;
        const userId = getUserIdFromToken(token);

        console.log(`[API] Posting serial adjustment ${id} with userId: ${userId}`);
        await stockAdjustmentService.postStockAdjustment(Number(id), userId || undefined);

        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
