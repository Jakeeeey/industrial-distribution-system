import { NextRequest, NextResponse } from "next/server";

import {
  cylinderPurchaseFilterSchema,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.schema";
import {
  UpstreamContractError,
  UpstreamHttpError,
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

  if (error instanceof UpstreamContractError) {
    return NextResponse.json(
      {
        ok: false,
        code: "UPSTREAM_CONTRACT_ERROR",
        message: "The report service returned invalid quantity data.",
      },
      { status: 502 },
    );
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return NextResponse.json(
      {
        ok: false,
        code: "UPSTREAM_TIMEOUT",
        message: "The report service timed out.",
      },
      { status: 504 },
    );
  }
  if (error instanceof UpstreamHttpError) {
    return NextResponse.json(
      {
        ok: false,
        code: "UPSTREAM_UNAVAILABLE",
        message: "The report service is unavailable.",
      },
      { status: 502 },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Unable to load the cylinder purchase report.",
    },
    { status: 500 },
  );
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
