import { NextRequest, NextResponse } from "next/server";
import { lpgSiteService as lpgSiteServerService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/lpg-site-management/services/lpgSiteServerService";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    if (!siteId) return NextResponse.json({ data: [] });

    const data = await lpgSiteServerService.fetchCylindersAtSite(parseInt(siteId));
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);

    const data = await lpgSiteServerService.installCylinder({
      ...body,
      created_by: userId || undefined
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const assetId = searchParams.get("assetId");
    const status = searchParams.get("status") || "RETURNED";

    if (!id || !assetId) throw new Error("Missing parameters");

    await lpgSiteServerService.removeCylinder(parseInt(id), parseInt(assetId), status);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
