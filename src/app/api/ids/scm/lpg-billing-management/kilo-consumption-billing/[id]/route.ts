import { NextRequest, NextResponse } from "next/server";
import {
  fetchWiwoById,
  fetchInvoiceById,
  updateInvoice,
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/kilo-consumption-billing/providers/kilo-consumption.provider";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/auth-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ids/scm/lpg-billing-management/kilo-consumption-billing/[id]
 * Query: type=wiwo (default) | type=invoice
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: rawId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "wiwo";
    const id = Number(rawId);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    if (type === "invoice") {
      const data = await fetchInvoiceById(id);
      return NextResponse.json({ data });
    }

    const data = await fetchWiwoById(id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/ids/scm/lpg-billing-management/kilo-consumption-billing/[id]
 * Updates an existing invoice (status change, posting, etc.)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const token = request.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);

    const data = await updateInvoice(id, {
      ...body,
      modified_by: userId ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
