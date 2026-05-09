import { NextResponse } from "next/server";
import { cylinderAssetsService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/services/cylinder-assets-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/utils/error-handler";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const data = await cylinderAssetsService.fetchCustomers(search);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
