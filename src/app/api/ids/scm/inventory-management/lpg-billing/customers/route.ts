import { NextResponse } from "next/server";
import { lpgBillingService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/lpg-billing/services/lpg-billing-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment/utils/error-handler";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const data = await lpgBillingService.fetchCustomers(search);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
