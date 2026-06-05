import { NextRequest, NextResponse } from "next/server";
import {
  fetchMeteredTransactionById,
  updateMeteredTransaction,
  updateSiteReading,
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/metered-wiwo-billing/providers/metered-wiwo.provider";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/auth-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ids/scm/lpg-billing-management/metered-billing/[id]
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const data = await fetchMeteredTransactionById(id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/ids/scm/lpg-billing-management/metered-billing/[id]
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

    const data = await updateMeteredTransaction(id, {
      ...body,
      modified_by: userId ?? undefined,
    });

    // Update site readings if status becomes POSTED
    if (body.status === "POSTED" && body.lpg_site_id && body.current_reading != null) {
      await updateSiteReading(
        Number(body.lpg_site_id),
        Number(body.current_reading),
        body.transaction_date || new Date().toISOString().split('T')[0]
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

