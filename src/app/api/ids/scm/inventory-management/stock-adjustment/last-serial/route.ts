import { NextResponse, NextRequest } from "next/server";
import { stockAdjustmentService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/services/stock-adjustment-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";

/**
 * GET /api/ids/scm/inventory-management/stock-adjustment/last-serial
 * 
 * Fetches the latest serial number for a product to help with auto-increment.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const branchId = searchParams.get("branchId");
    const token = request.cookies.get("vos_access_token")?.value;

    if (!productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lastSerial = await stockAdjustmentService.fetchLastSerialNumber(
      Number(productId),
      token,
      branchId ? Number(branchId) : undefined
    );

    return NextResponse.json({ lastSerial });
  } catch (error) {
    return handleApiError(error);
  }
}
