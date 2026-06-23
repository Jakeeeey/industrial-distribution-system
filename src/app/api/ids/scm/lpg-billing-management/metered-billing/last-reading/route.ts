import { NextRequest, NextResponse } from "next/server";
import { fetchLastReadingByInvoice } from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/metered-billing/metered-billing-creation/providers/metered-billing.provider";
// Updated import path from stock-adjustment to stock-adjustment-serial-posting
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/error-handler";

/**
 * GET /api/ids/scm/lpg-billing-management/metered-billing/last-reading
 *
 * Returns the current_reading of the most recent transaction that matches
 * the given siteId + customerCode, optionally filtered by salesInvoiceNo.
 *
 * Query params:
 *   siteId         - number  (required)
 *   customerCode   - string  (required)
 *   salesInvoiceNo - string  (optional — when omitted, matches any invoice)
 *
 * Response:
 *   { last_current_reading: number, transaction_date: string, billing_period_to: string | null }
 *   or null when no matching transaction exists
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const siteIdRaw = searchParams.get("siteId");
    const customerCode = searchParams.get("customerCode");
    const salesInvoiceNo = searchParams.get("salesInvoiceNo") ?? undefined; // optional

    if (!siteIdRaw || !customerCode) {
      return NextResponse.json(
        { error: "siteId and customerCode are required." },
        { status: 400 },
      );
    }

    const siteId = Number(siteIdRaw);
    if (isNaN(siteId) || siteId <= 0) {
      return NextResponse.json(
        { error: "siteId must be a valid positive integer." },
        { status: 400 },
      );
    }

    const result = await fetchLastReadingByInvoice(siteId, customerCode, salesInvoiceNo);

    return NextResponse.json(result ?? null);
  } catch (error) {
    return handleApiError(error);
  }
}
