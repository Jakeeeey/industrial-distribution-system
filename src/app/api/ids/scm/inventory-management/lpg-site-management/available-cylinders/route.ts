import { NextRequest, NextResponse } from "next/server";
import { lpgSiteService as lpgSiteServerService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/lpg-site-management/services/lpgSiteServerService";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/error-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const productId = searchParams.get("productId") ? parseInt(searchParams.get("productId")!) : undefined;
    const data = await lpgSiteServerService.fetchAvailableCylinders(search, productId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
