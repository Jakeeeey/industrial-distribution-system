import { NextRequest, NextResponse } from "next/server";
import {
  fetchMeteredTransactions,
  createMeteredTransaction,
  fetchMeteredSites,
  fetchMeterReadings,
  fetchLastMeteredTransaction,
  fetchUnbilledWiwoHeaders,
  updateSiteReading,
  fetchNextTxSeq,
  fetchNextMeterReadingSeq,
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/metered-wiwo-billing/providers/metered-wiwo.provider";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/auth-utils";
import type { TransactionType } from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/metered-wiwo-billing/types";

/**
 * GET /api/ids/scm/lpg-billing-management/metered-billing
 * Query params:
 *   type=sites | readings | wiwo-headers | next-tx-seq | next-seq | wiwo-kg
 *   transactionType=ONBOARDING_BASELINE | REGULAR_BILLING | ALL
 *   siteId, customerCode, headerId, search, status, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "sites") {
      const sites = await fetchMeteredSites();
      return NextResponse.json({ data: sites });
    }

    if (type === "readings") {
      const siteId = searchParams.get("siteId")
        ? Number(searchParams.get("siteId"))
        : undefined;
      const readings = await fetchMeterReadings(siteId);
      return NextResponse.json({ data: readings });
    }

    if (type === "wiwo-headers") {
      const customerCode = searchParams.get("customerCode") || undefined;
      const siteId = searchParams.get("siteId")
        ? Number(searchParams.get("siteId"))
        : undefined;
      const headers = await fetchUnbilledWiwoHeaders(customerCode, siteId);
      return NextResponse.json({ data: headers });
    }

    /**
     * New: per-site, per-day, per-type sequence number
     * ?type=next-tx-seq&txType=REGULAR_BILLING&siteId=5&date=2025-06-08
     */
    if (type === "next-tx-seq") {
      const txType = (searchParams.get("txType") || "REGULAR_BILLING") as TransactionType;
      const siteId = Number(searchParams.get("siteId") ?? 0);
      const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
      if (!siteId) return NextResponse.json({ seq: 1 });
      const seq = await fetchNextTxSeq(txType, siteId, date);
      return NextResponse.json({ seq });
    }

    /**
     * Legacy: fallback for old MTR-sequence-number approach (kept for compat)
     */
    if (type === "next-seq") {
      const customerCode = searchParams.get("customerCode");
      const date = searchParams.get("date");
      if (!customerCode || !date) return NextResponse.json({ seq: 1 });
      const seq = await fetchNextMeterReadingSeq(customerCode, date);
      return NextResponse.json({ seq });
    }

    if (type === "last-transaction") {
      const siteId = Number(searchParams.get("siteId") ?? 0);
      if (!siteId) return NextResponse.json({ data: null });

      const lastTx = await fetchLastMeteredTransaction(siteId);
      return NextResponse.json({ data: lastTx });
    }

    if (type === "wiwo-kg") {
      const headerId = Number(searchParams.get("headerId"));
      if (!headerId) return NextResponse.json({ wiwo_kg: 0 });
      const { fetchWiwoById } = await import(
        "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/kilo-consumption-billing/providers/kilo-consumption.provider"
      );
      const wiwo = await fetchWiwoById(headerId);
      return NextResponse.json({ wiwo_kg: wiwo?.total_wiwo_kg ?? 0 });
    }

    // ── Main list ──────────────────────────────────────────────────────────
    const txTypeParam = searchParams.get("transactionType");
    const params = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      transactionType: (txTypeParam || "ALL") as TransactionType | "ALL",
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 10,
    };

    const result = await fetchMeteredTransactions(params);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/ids/scm/lpg-billing-management/metered-billing
 * Body: Partial<MeteredWiwoTransaction>
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);

    const data = await createMeteredTransaction({
      ...body,
      created_by: userId ?? undefined,
    });

    // Update site last_meter_reading when POSTED
    if (body.status === "POSTED" && body.lpg_site_id && body.current_reading != null) {
      await updateSiteReading(
        Number(body.lpg_site_id),
        Number(body.current_reading),
        body.transaction_date || new Date().toISOString().split("T")[0]
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
