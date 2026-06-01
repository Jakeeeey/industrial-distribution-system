import { NextResponse } from "next/server";
import { stockAdjustmentService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/services/stock-adjustment-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const divisionId = searchParams.get("division_id");
    
    const data = await stockAdjustmentService.fetchBranches(
      divisionId ? { divisionId: Number(divisionId) } : undefined
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
