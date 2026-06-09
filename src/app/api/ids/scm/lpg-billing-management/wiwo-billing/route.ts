import { NextRequest, NextResponse } from "next/server";
import {
  fetchWiwoBillingTransactions,
  fetchCustomers,
  fetchSites,
  fetchAvailableCylinders,
  fetchActiveSiteCylinders,
  validateSerialForOnboarding,
  processOnboardingBaseline,
  processRegularSwap,
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
    const authorization = request.headers.get("authorization");
    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : undefined;
    const token = request.cookies.get("vos_access_token")?.value ?? bearerToken;
    const tokenUserId = getUserIdFromToken(token);
    const developmentUserId =
      process.env.NEXT_PUBLIC_AUTH_DISABLED === "true"
        ? Number(process.env.WIWO_DEV_USER_ID ?? 24)
        : null;
    const userId =
      tokenUserId ??
      (developmentUserId !== null &&
      Number.isInteger(developmentUserId) &&
      developmentUserId > 0
        ? developmentUserId
        : null);

    const txType = body.transaction_type;
    const customerCode =
      typeof body.customer_code === "string" ? body.customer_code.trim() : "";
    const siteId = Number(body.lpg_site_id);

    if (!customerCode) {
      return NextResponse.json({ error: "customer_code is required" }, { status: 400 });
    }
    if (!Number.isInteger(siteId) || siteId <= 0) {
      return NextResponse.json({ error: "lpg_site_id is required" }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json(
        { error: "Authenticated user is required to post WIWO billing." },
        { status: 401 }
      );
    }

    if (txType === "ONBOARDING_BASELINE") {
      const data = await processOnboardingBaseline({
        customerCode,
        siteId,
        transactionDate: body.transaction_date,
        cylinders: body.cylinders || [],
        userId,
      });
      return NextResponse.json({ data });
    }

    if (txType === "REGULAR_BILLING") {
      const data = await processRegularSwap({
        customerCode,
        siteId,
        transactionDate: body.transaction_date,
        previousMeterReading: Number(body.previous_reading ?? 0),
        currentMeterReading: Number(body.current_reading ?? 0),
        pricePerKg: Number(body.price_per_kg ?? 0),
        returnedCylinders: body.returned_cylinders || [],
        newCylinders: body.new_cylinders || [],
        varianceReasonCode: body.varianceReasonCode || "NONE",
        remarks: body.remarks || "",
        userId,
        transactionId: body.transaction_id ? Number(body.transaction_id) : undefined,
        isNoSwap: !!body.is_no_swap,
        attachments: body.attachments || [],
      });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid transaction_type" }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}
