// src/app/api/ids/crm/customer-reports/customer-order-and-consumption-report/route.ts
// ============================================================
// BFF route for the Customer Order & Consumption Report.
// Validates the query string, then delegates every data decision to the
// service layer. No SQL, no Directus token, no aggregation in here.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { UpstreamContractError } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.errors";
import {
  fetchCustomerOrderConsumptionDetail,
  fetchCustomerOrderConsumptionReport,
} from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/services/customer-order-consumption.service";
import {
  customerOrderConsumptionDetailSchema,
  customerOrderConsumptionFilterSchema,
  readFilterParams,
  readLabelList,
} from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/types/customer-order-consumption.schema";
import type { AppliedFilterContext } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-order-and-consumption-report/types/customer-order-consumption.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABEL_FIELDS = [
  "customerLabels",
  "branchLabels",
  "salesmanLabels",
  "classificationLabels",
] as const;

/**
 * Display labels come from the filter bar so the response can echo the chips
 * the user actually saw. They are never used in a query, but they are still
 * length-capped because they round-trip into exports and the PDF footer.
 */
function readLabels(
  params: URLSearchParams
): Pick<AppliedFilterContext, (typeof LABEL_FIELDS)[number]> {
  const labels: Record<string, string[] | undefined> = {};
  for (const field of LABEL_FIELDS) {
    const values = readLabelList(params, field);
    if (values.length > 0) labels[field] = values;
  }
  return labels as Pick<AppliedFilterContext, (typeof LABEL_FIELDS)[number]>;
}

function invalidFilters(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: "INVALID_FILTERS", message },
    { status: 400 }
  );
}

/**
 * Upstream failures are reported as 502 so the UI can distinguish "the
 * warehouse said no" from "this app broke".
 */
function reportError(error: unknown): NextResponse {
  if (error instanceof UpstreamContractError) {
    console.error("[CustomerOrderConsumption] contract break", error.message);
    return NextResponse.json(
      {
        ok: false,
        code: "UPSTREAM_CONTRACT",
        message: "The report source returned data that does not match the expected shape.",
      },
      { status: 502 }
    );
  }

  const status = (error as { statusCode?: number | null })?.statusCode;
  if (typeof status === "number" || status === null) {
    console.error("[CustomerOrderConsumption] upstream failure", {
      status: status ?? "network",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        code: "UPSTREAM_UNAVAILABLE",
        message: "The report source is unreachable right now. Please retry.",
      },
      { status: 502 }
    );
  }

  console.error("[CustomerOrderConsumption] unhandled error", error);
  return NextResponse.json(
    { ok: false, code: "REPORT_FAILED", message: "Unable to build the report." },
    { status: 500 }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const raw = readFilterParams(params);

  try {
    // The presence of customerDetail is the only difference between the two
    // reads, so it selects the branch instead of a second endpoint.
    if (raw.customerDetail) {
      const parsed = customerOrderConsumptionDetailSchema.safeParse(raw);
      if (!parsed.success) {
        return invalidFilters(parsed.error.issues[0]?.message ?? "Invalid drill-down filters.");
      }
      const { customerDetail, ...filterInput } = parsed.data;
      const filters: AppliedFilterContext = { ...filterInput, ...readLabels(params) };
      return NextResponse.json(
        await fetchCustomerOrderConsumptionDetail(filters, customerDetail, {
          signal: request.signal,
        })
      );
    }

    const parsed = customerOrderConsumptionFilterSchema.safeParse(raw);
    if (!parsed.success) {
      return invalidFilters(parsed.error.issues[0]?.message ?? "Invalid report filters.");
    }

    const filters: AppliedFilterContext = { ...parsed.data, ...readLabels(params) };
    return NextResponse.json(
      await fetchCustomerOrderConsumptionReport(filters, { signal: request.signal })
    );
  } catch (error) {
    return reportError(error);
  }
}
