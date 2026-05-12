import { NextRequest, NextResponse } from "next/server";
import { lpgSiteService as lpgSiteServerService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/lpg-site-management/services/lpgSiteServerService";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const data = await lpgSiteServerService.fetchCustomers(search);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
