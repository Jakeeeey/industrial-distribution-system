import { NextRequest, NextResponse } from "next/server";
import {
  fetchWiwoTransactions,
  fetchInvoices,
  createInvoice,
  fetchKiloSites,
  fetchSiteCylinders,
  fetchAvailableCylinders,
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/kilo-consumption-billing/providers/kilo-consumption.provider";
// Updated import paths from stock-adjustment to stock-adjustment-serial-posting
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/auth-utils";

/**
 * GET /api/ids/scm/lpg-billing-management/kilo-consumption-billing
 * Query params:
 *   type=wiwo              → returns lpg_wiwo_headers (pending transactions)
 *   type=invoice           → returns lpg_kilo_billing_invoices
 *   type=sites             → returns KILO sites
 *   type=site-cylinders    → returns connected site cylinders
 *   type=available         → returns available cylinders
 *   search, status, page, limit, siteId, productId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "wiwo";
    
    if (type === "sites") {
      const data = await fetchKiloSites();
      return NextResponse.json({ data });
    }

    if (type === "site-cylinders") {
      const siteId = Number(searchParams.get("siteId"));
      if (!siteId) return NextResponse.json({ error: "siteId is required" }, { status: 400 });
      const data = await fetchSiteCylinders(siteId);
      return NextResponse.json({ data });
    }

    if (type === "available") {
      const productId = searchParams.get("productId") ? Number(searchParams.get("productId")) : undefined;
      const data = await fetchAvailableCylinders(productId);
      return NextResponse.json({ data });
    }

    const params = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 10,
    };

    if (type === "invoice") {
      const result = await fetchInvoices(params);
      return NextResponse.json(result);
    }

    // default: wiwo transactions
    const result = await fetchWiwoTransactions(params);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/ids/scm/lpg-billing-management/kilo-consumption-billing
 * Body: Partial<KiloBillingInvoice> or operational payloads
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);

    // Create invoice
    const data = await createInvoice({
      ...body,
      created_by: userId ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

