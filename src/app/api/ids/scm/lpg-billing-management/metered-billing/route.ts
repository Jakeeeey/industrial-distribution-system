import { NextRequest, NextResponse } from "next/server";
import {
  fetchMeteredTransactions,
  createMeteredTransaction,
  fetchMeteredSites,
  fetchMeterReadings,
  fetchUnbilledWiwoHeaders,
  updateSiteReading,
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/metered-wiwo-billing/providers/metered-wiwo.provider";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/auth-utils";

/**
 * GET /api/ids/scm/lpg-billing-management/metered-billing
 * Query params: type, siteId, customerCode, headerId, search, status, page, limit
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
      const siteId = searchParams.get("siteId") ? Number(searchParams.get("siteId")) : undefined;
      const readings = await fetchMeterReadings(siteId);
      return NextResponse.json({ data: readings });
    }

    if (type === "wiwo-headers") {
      const customerCode = searchParams.get("customerCode") || undefined;
      const siteId = searchParams.get("siteId") ? Number(searchParams.get("siteId")) : undefined;
      const headers = await fetchUnbilledWiwoHeaders(customerCode, siteId);
      return NextResponse.json({ data: headers });
    }

    if (type === "wiwo-kg") {
      const headerId = Number(searchParams.get("headerId"));
      if (!headerId) return NextResponse.json({ wiwo_kg: 0 });
      
      const { fetchWiwoById } = await import("@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/kilo-consumption-billing/providers/kilo-consumption.provider");
      const wiwo = await fetchWiwoById(headerId);
      return NextResponse.json({ wiwo_kg: wiwo?.total_wiwo_kg ?? 0 });
    }

    const params = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
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
      transaction_type: "REGULAR_BILLING" as unknown,
      created_by: userId ?? undefined,
    });

    // Update site readings if status is POSTED
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

