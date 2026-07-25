import { NextRequest, NextResponse } from "next/server";

import {
  cylinderPurchaseFilterSchema,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.schema";
import {
  classifyCylinderPurchaseReportRouteError,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.errors";
import { getCylinderPurchaseDashboard } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reportErrorResponse(error: unknown): NextResponse {
  const name = error instanceof Error ? error.name : "UnknownError";
  console.error("[Cylinder purchase report]", {
    name,
    message: "Cylinder purchase report request failed.",
  });

  const classification = classifyCylinderPurchaseReportRouteError(error);
  return NextResponse.json(classification.body, {
    status: classification.status,
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = cylinderPurchaseFilterSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_FILTERS",
        message: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await getCylinderPurchaseDashboard(parsed.data), {
      status: 200,
    });
  } catch (error) {
    return reportErrorResponse(error);
  }
}
