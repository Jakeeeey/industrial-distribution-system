import { NextRequest, NextResponse } from "next/server";
import { cylinderAssetsService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/services/cylinder-assets-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/utils/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") ? Number(searchParams.get("branchId")) : undefined;
    const productId = searchParams.get("productId") ? Number(searchParams.get("productId")) : undefined;

    const params = {
      search: searchParams.get("search") || undefined,
      branchId: (branchId !== undefined && !isNaN(branchId)) ? branchId : undefined,
      status: searchParams.get("status") || undefined,
      productId: (productId !== undefined && !isNaN(productId)) ? productId : undefined,
      condition: searchParams.get("condition") || undefined,
      expirationStatus: searchParams.get("expirationStatus") || undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 10,
      sort: searchParams.get("sort") || undefined,
      serials: searchParams.get("serials") || undefined,
    };

    const { data, total } = await cylinderAssetsService.fetchAll(params);
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

    if (Array.isArray(body)) {
      // Bulk creation
      const payloads = body.map((item) => ({ ...item, created_by: userId || undefined }));
      const data = await cylinderAssetsService.createBulk(payloads);
      return NextResponse.json({ data });
    } else {
      // Single creation
      const data = await cylinderAssetsService.create({ ...body, created_by: userId || undefined });
      return NextResponse.json({ data });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
