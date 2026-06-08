import { NextRequest, NextResponse } from "next/server";
import {
  fetchTransactions,
  createUnifiedTransaction,
  fetchAllActiveSites,
  fetchActiveSiteCylinders,
  fetchAvailableCylinders,
  fetchBillableWiwoHeaders,
  type CreateTransactionPayload,
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/unified-billing/providers/unified-billing.provider";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/auth-utils";
import type { BillingMode } from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/unified-billing/types";

/**
 * GET /api/ids/scm/lpg-billing-management/unified-billing
 * ?type=sites               → all active LPG sites (both billing modes)
 * ?type=site-cylinders&siteId= → active cylinders for a site
 * ?type=available-cylinders&customerCode= → refilled cylinders for customer
 * ?type=wiwo-headers&customerCode=&siteId= → pending WIWO headers to link
 * (default) → paginated transaction list
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "sites") {
      const sites = await fetchAllActiveSites();
      return NextResponse.json({ data: sites });
    }

    if (type === "site-cylinders") {
      const siteId = Number(searchParams.get("siteId"));
      if (!siteId) return NextResponse.json({ data: [] });
      const cylinders = await fetchActiveSiteCylinders(siteId);
      return NextResponse.json({ data: cylinders });
    }

    if (type === "available-cylinders") {
      const customerCode = searchParams.get("customerCode") ?? "";
      if (!customerCode) return NextResponse.json({ data: [] });
      const cylinders = await fetchAvailableCylinders(customerCode);
      return NextResponse.json({ data: cylinders });
    }

    if (type === "wiwo-headers") {
      const customerCode = searchParams.get("customerCode") ?? "";
      const siteId = Number(searchParams.get("siteId"));
      if (!customerCode || !siteId) return NextResponse.json({ data: [] });
      const headers = await fetchBillableWiwoHeaders(customerCode, siteId);
      return NextResponse.json({ data: headers });
    }

    const result = await fetchTransactions({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      billingMode: (searchParams.get("billingMode") as BillingMode) || undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 20,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/ids/scm/lpg-billing-management/unified-billing
 * Body: CreateTransactionPayload
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);
    const body = (await request.json()) as CreateTransactionPayload;
    const tx = await createUnifiedTransaction({ ...body, userId });
    return NextResponse.json({ data: tx }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
