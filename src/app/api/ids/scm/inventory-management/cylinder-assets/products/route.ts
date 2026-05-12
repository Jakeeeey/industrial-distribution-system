import { NextResponse } from "next/server";
import { cylinderAssetsService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/services/cylinder-assets-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/utils/error-handler";

export async function GET() {
  try {
    const data = await cylinderAssetsService.fetchSerializedProducts();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
