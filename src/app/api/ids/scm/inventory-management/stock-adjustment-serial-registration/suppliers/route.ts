import { NextResponse } from "next/server";
import { stockAdjustmentService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/services/stock-adjustment-serial-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-registration/utils/error-handler";

/**
 * GET /api/scm/inventory-management/stock-adjustment-registration/suppliers
 * Returns active suppliers (nonBuy = 0) for the supplier filter dropdown.
 */
export async function GET() {
  try {
    const data = await stockAdjustmentService.fetchSuppliers(1);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
