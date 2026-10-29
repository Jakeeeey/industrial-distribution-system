// src/app/api/ids/crm/customer-reports/customer-incentive-and-rebate-report/route.ts
// ============================================================
// BFF route for the Customer Incentive & Rebate Report.
// Validates the query string, then delegates every data decision to the
// service layer. No SQL, no Directus token, no aggregation in here.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { UpstreamContractError } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-incentive-and-rebate-report/services/customer-incentive.errors";
import { resolveSizeKg } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-incentive-and-rebate-report/services/customer-incentive.helpers";
import {
  fetchCustomerIncentiveDetail,
  fetchCustomerIncentiveReport,
} from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-incentive-and-rebate-report/services/customer-incentive.service";
import {
  customerIncentiveDetailSchema,
  customerIncentiveFilterSchema,
} from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-incentive-and-rebate-report/types/customer-incentive.schema";
import type { AppliedFilterContext } from "@/modules/industrial-distribution-system/customer-relationship-management/customer-reports/customer-incentive-and-rebate-report/types/customer-incentive.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIST_FIELDS = [
  "customerCodes",
  "branchIds",
  "salesmanIds",
  "classificationIds",
  "categoryIds",
] as const;

const LABEL_FIELDS = [
  "customerLabels",
  "branchLabels",
  "salesmanLabels",
  "classificationLabels",
  "categoryLabels",
] as const;

/**
 * A repeated query key collapses to its last value in Object.fromEntries, which
 * would silently turn a ten-customer cut into a one-customer one. Every list
 * field is read with getAll instead.
 */
function readParams(params: URLSearchParams): Record<string, string | string[]> {
  const raw: Record<string, string | string[]> = Object.fromEntries(params);
  for (const field of [...LIST_FIELDS, ...LABEL_FIELDS]) {
    const values = params.getAll(field);
    if (values.length > 0) raw[field] = values;
  }
  return raw;
}

/**
 * Display labels come from the filter bar so the response can name what the
 * reader actually selected. They are never used in a query, but they are still
 * length-capped because they round-trip into exports and the PDF footer.
 */
function readLabels(params: URLSearchParams): Partial<AppliedFilterContext> {
  const labels: Record<string, string[]> = {};
  for (const field of LABEL_FIELDS) {
    const values = params
      .getAll(field)
      .map((value) => value.trim().slice(0, 200))
      .filter((value) => value.length > 0);
    if (values.length > 0) labels[field] = values;
  }
  return labels as Partial<AppliedFilterContext>;
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
    console.error("[CustomerIncentiveReport] contract break", error.message);
    return NextResponse.json(
      {
        ok: false,
        code: "UPSTREAM_CONTRACT",
        message:
          "The report source returned data that does not match the expected shape.",
      },
      { status: 502 }
    );
  }

  const status = (error as { statusCode?: number | null })?.statusCode;
  if (typeof status === "number" || status === null) {
    console.error("[CustomerIncentiveReport] upstream failure", {
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

  console.error("[CustomerIncentiveReport] unhandled error", error);
  return NextResponse.json(
    { ok: false, code: "REPORT_FAILED", message: "Unable to build the report." },
    { status: 500 }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const raw = readParams(params);

  try {
    // The presence of customerDetail is the only difference between the two
    // reads, so it selects the branch instead of a second endpoint.
    if (raw.customerDetail) {
      const parsed = customerIncentiveDetailSchema.safeParse(raw);
      if (!parsed.success) {
        return invalidFilters(
          parsed.error.issues[0]?.message ?? "Invalid drill-down filters."
        );
      }
      const { customerDetail, ...filterInput } = parsed.data;
      const filters: AppliedFilterContext = {
        ...filterInput,
        sizeKg: filterInput.sizeKg ? resolveSizeKg(filterInput.sizeKg) : undefined,
        ...readLabels(params),
      };
      return NextResponse.json(
        await fetchCustomerIncentiveDetail(filters, customerDetail, {
          signal: request.signal,
        })
      );
    }

    const parsed = customerIncentiveFilterSchema.safeParse(raw);
    if (!parsed.success) {
      return invalidFilters(
        parsed.error.issues[0]?.message ?? "Invalid report filters."
      );
    }

    const filters: AppliedFilterContext = {
      ...parsed.data,
      sizeKg: parsed.data.sizeKg ? resolveSizeKg(parsed.data.sizeKg) : undefined,
      ...readLabels(params),
    };
    return NextResponse.json(
      await fetchCustomerIncentiveReport(filters, { signal: request.signal })
    );
  } catch (error) {
    return reportError(error);
  }
}
