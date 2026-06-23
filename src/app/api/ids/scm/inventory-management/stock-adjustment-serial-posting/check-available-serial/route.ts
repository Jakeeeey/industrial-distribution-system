import { NextResponse, NextRequest } from "next/server";
import { stockAdjustmentService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/services/stock-adjustment-serial-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/error-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serial = searchParams.get("serial");
    const branchId = searchParams.get("branchId");
    
    const token = request.cookies.get("vos_access_token")?.value;

    if (!serial) {
      return NextResponse.json({ error: "Missing serial" }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: "No access token found" }, { status: 401 });
    }

    const { exists, location } = await stockAdjustmentService.checkSerialExists(
      serial, 
      token, 
      branchId ? Number(branchId) : undefined
    );
    
    return NextResponse.json({ exists, location });
  } catch (error) {
    return handleApiError(error);
  }
}
