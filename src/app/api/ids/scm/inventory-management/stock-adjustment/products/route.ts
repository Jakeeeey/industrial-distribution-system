import { NextResponse } from "next/server";
import { stockAdjustmentService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/services/stock-adjustment-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";

/**
 * GET /api/scm/inventory-management/stock-adjustment/products
 *
 * Query params:
 *   - search   (optional) — filter by product name/code/barcode
 *   - supplierId (optional) — when provided, only products linked to this supplier
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const supplierId = searchParams.get("supplierId");

    const data = await stockAdjustmentService.fetchProducts({ 
      search: search || undefined, 
      supplierId: supplierId ? Number(supplierId) : undefined 
    });

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
