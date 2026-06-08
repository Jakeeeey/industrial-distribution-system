import { NextRequest, NextResponse } from "next/server";
import {
  fetchWiwoBillingTransactions,
  fetchCustomers,
  fetchSites,
  fetchAvailableCylinders,
  fetchActiveSiteCylinders,
  validateSerialForOnboarding,
  processOnboardingBaseline,
  processRegularSwap
} from "@/modules/industrial-distribution-system/supply-chain-management/lpg-billing-management/wiwo-billing/providers/wiwo-billing.provider";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";
import { getUserIdFromToken } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/auth-utils";

/**
 * GET /api/ids/scm/lpg-billing-management/wiwo-billing
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "customers") {
      const data = await fetchCustomers();
      return NextResponse.json({ data });
    }

    if (type === "sites") {
      const customerCode = searchParams.get("customerCode") || undefined;
      const data = await fetchSites(customerCode);
      return NextResponse.json({ data });
    }

    if (type === "available") {
      const data = await fetchAvailableCylinders();
      return NextResponse.json({ data });
    }

    if (type === "site-cylinders") {
      const siteId = Number(searchParams.get("siteId"));
      if (!siteId) return NextResponse.json({ error: "siteId is required" }, { status: 400 });
      const data = await fetchActiveSiteCylinders(siteId);
      return NextResponse.json({ data });
    }

    if (type === "validate-serial") {
      const serial = searchParams.get("serial");
      if (!serial) return NextResponse.json({ error: "Serial number is required" }, { status: 400 });
      const data = await validateSerialForOnboarding(serial);
      return NextResponse.json({ data });
    }

    const params = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 10,
    };

    const result = await fetchWiwoBillingTransactions(params);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/ids/scm/lpg-billing-management/wiwo-billing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.cookies.get("vos_access_token")?.value;
    const userId = getUserIdFromToken(token);

    const txType = body.transaction_type;

    if (txType === "ONBOARDING_BASELINE") {
      const data = await processOnboardingBaseline({
        customerCode: body.customer_code,
        siteId: Number(body.lpg_site_id),
        transactionDate: body.transaction_date,
        cylinders: body.cylinders || [],
        userId: userId ?? undefined
      });
      return NextResponse.json({ data });
    }

    if (txType === "REGULAR_BILLING") {
      const data = await processRegularSwap({
        customerCode: body.customer_code,
        siteId: Number(body.lpg_site_id),
        transactionDate: body.transaction_date,
        previousMeterReading: Number(body.previous_reading ?? 0),
        currentMeterReading: Number(body.current_reading ?? 0),
        pricePerKg: Number(body.price_per_kg ?? 0),
        returnedCylinders: body.returned_cylinders || [],
        newCylinders: body.new_cylinders || [],
        varianceReasonCode: body.varianceReasonCode || "NONE",
        remarks: body.remarks || "",
        userId: userId ?? undefined
      });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid transaction_type" }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}
