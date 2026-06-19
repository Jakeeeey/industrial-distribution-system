import { NextRequest, NextResponse } from "next/server";
import { stockAdjustmentService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/services/stock-adjustment-serial-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/utils/error-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = {
      search: searchParams.get("search") || undefined,
      branchId: searchParams.get("branchId") ? Number(searchParams.get("branchId")) : undefined,
      type: searchParams.get("type") || undefined,
      status: searchParams.get("status") || undefined,
    };

    const data = await stockAdjustmentService.fetchAllHeaders(params);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
