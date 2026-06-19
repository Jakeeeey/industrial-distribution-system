import { NextRequest, NextResponse } from "next/server";
import { lpgSiteServerService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/lpg-site-management/services/lpgSiteServerService";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = {
      search: searchParams.get("search") || undefined,
      customer_code: searchParams.get("customer_code") || undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 10,
      sort: searchParams.get("sort") || undefined,
    };

    const { data, total } = await lpgSiteServerService.fetchSites(params);
    return NextResponse.json({ data, total });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);

    const data = await lpgSiteServerService.createSite({
      ...body,
      created_by: userId || undefined
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
