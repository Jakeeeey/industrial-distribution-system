import { NextRequest, NextResponse } from "next/server";
import { stockAdjustmentService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/services/stock-adjustment-serial-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/auth-utils";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const data = await stockAdjustmentService.fetchById(Number(id));
        return NextResponse.json({ data });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Extract userId from cookie
        const token = request.cookies.get("vos_access_token")?.value;
        const userId = getUserIdFromToken(token);

        console.log(`[API] Updating serial stock adjustment ID: ${id} with userId: ${userId}`);
        const data = await stockAdjustmentService.update(Number(id), { ...body, userId: userId || undefined });
        return NextResponse.json({ data });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await stockAdjustmentService.deleteStockAdjustment(Number(id));
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleApiError(error);
    }
}
