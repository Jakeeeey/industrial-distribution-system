import { NextResponse } from "next/server";
import { lpgBillingService } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/lpg-billing/services/lpg-billing-service";
import { handleApiError } from "@/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-adjustment-serial-posting/utils/error-handler";

export async function GET() {
  try {
    const data = await lpgBillingService.fetchBranches();
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
