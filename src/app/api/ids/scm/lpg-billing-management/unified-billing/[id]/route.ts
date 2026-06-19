import { NextRequest, NextResponse } from "next/server";
import {
  fetchTransactionById,
  updateUnifiedTransaction,
  postTransaction,
  cancelTransaction,
  type CreateTransactionPayload,
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/unified-billing/providers/unified-billing.provider";
// Updated import paths from stock-adjustment to stock-adjustment-serial-posting
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/auth-utils";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/ids/scm/lpg-billing-management/unified-billing/[id]
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const tx = await fetchTransactionById(Number(id));
    if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: tx });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/ids/scm/lpg-billing-management/unified-billing/[id]
 * Body: { action: 'update' | 'post' | 'cancel', ...payload }
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const token = request.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);
    const { id } = await ctx.params;
    const numId = Number(id);

    const body = (await request.json()) as { action?: string; reason?: string } & Partial<CreateTransactionPayload>;
    const action = body.action ?? "update";

    if (action === "post") {
      const tx = await postTransaction(numId, userId);
      return NextResponse.json({ data: tx });
    }

    if (action === "cancel") {
      const tx = await cancelTransaction(numId, body.reason ?? "Cancelled by user", userId);
      return NextResponse.json({ data: tx });
    }

    // default: update draft
    const existingReadingId = (body as unknown as Record<string, unknown>)["existingReadingId"] as
      | number
      | null
      | undefined;
    const tx = await updateUnifiedTransaction(numId, {
      ...body,
      userId,
      existingReadingId,
    });
    return NextResponse.json({ data: tx });
  } catch (error) {
    return handleApiError(error);
  }
}
