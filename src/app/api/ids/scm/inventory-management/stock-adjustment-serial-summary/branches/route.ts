import { NextResponse } from "next/server";
import { stockAdjustmentService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/services/stock-adjustment-serial-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/utils/error-handler";

export async function GET() {
  try {
    const data = await stockAdjustmentService.fetchBranches();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
