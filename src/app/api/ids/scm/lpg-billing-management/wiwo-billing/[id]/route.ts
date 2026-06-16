import { NextRequest, NextResponse } from "next/server";
import {
  fetchWiwoBillingTransactionById,
  cancelWiwoBillingTransaction
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/wiwo-billing/wiwo-billing-creation/providers/wiwo-billing.provider";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/auth-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ids/scm/lpg-billing-management/wiwo-billing/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const data = await fetchWiwoBillingTransactionById(id);
    if (!data) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/ids/scm/lpg-billing-management/wiwo-billing/[id]
 * Specifically triggers the rollback/cancellation flow
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

    if (body.action === "CANCEL") {
      if (!body.cancelled_reason?.trim()) {
        return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 });
      }

      await cancelWiwoBillingTransaction(id, {
        cancelledBy: userId ?? 1,
        cancelledReason: body.cancelled_reason,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}
