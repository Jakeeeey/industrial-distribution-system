import { NextRequest, NextResponse } from "next/server";
import { cylinderAssetsService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/services/cylinder-assets-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/cylinder-assets/utils/auth-utils";

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const id = Number(params.id);
    const body = await request.json();

    const token = request.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);

    const data = await cylinderAssetsService.update(id, {
      ...body,
      modified_by: userId || undefined
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const id = Number(params.id);

    await cylinderAssetsService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
