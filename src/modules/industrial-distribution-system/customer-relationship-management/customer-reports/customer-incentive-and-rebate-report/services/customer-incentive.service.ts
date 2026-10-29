// ============================================================
// customer-incentive.service.ts
// Orchestration layer — fetches the raw rows, folds eligible volume and
// claims into the customer index, then freezes the result envelope.
// No UI logic, no SQL, no direct fetch() here.
// ============================================================

import type {
  AppliedFilterContext,
  CustomerIncentiveDetail,
  CustomerIncentiveReportResponse,
  CustomerIncentiveRow,
  IncentiveClaimSummary,
  IncentiveSourceData,
  ReportException,
  SupportingDocument,
} from "../types/customer-incentive.types";
import {
  accumulateClaims,
  accumulateInvoices,
  accumulateReturns,
  buildContext,
  buildOverview,
  finalizeRows,
  type CustomerClaimMoney,
  type EvidenceAccumulator,
} from "./customer-incentive.calc";
import { dateOnly, resolveSizeKg } from "./customer-incentive.helpers";
import {
  fetchCustomerIncentiveSources,
  type CustomerIncentiveRepoOptions,
} from "./customer-incentive.repo";

interface AggregateResult {
  filters: AppliedFilterContext;
  rows: CustomerIncentiveRow[];
  exceptions: ReportException[];
  claims: IncentiveClaimSummary[];
  documents: SupportingDocument[];
  sourceRowCount: number;
}

/**
 * The chosen industrial categories are what decide eligibility, and each states
 * its own size in its name, so no single kilogram figure is derived from them —
 * the kg are counted per product against its own category. `sizeKg` stays the
 * rule only for a report scoped by size alone. Category names are filled in
 * from the master when the query arrived without them, so an export always
 * names the catalogue it measured.
 */
function applyCategoryScope(
  filters: AppliedFilterContext,
  source: IncentiveSourceData
): AppliedFilterContext {
  const ids = filters.categoryIds ?? [];
  const sizeKg = filters.sizeKg;
  if (ids.length === 0) return { ...filters, sizeKg };

  const provided = (filters.categoryLabels ?? []).filter(Boolean);
  if (provided.length > 0) return { ...filters, sizeKg, categoryLabels: provided };

  const fromMaster = ids
    .map(
      (id) =>
        source.categories.find((row) => row.category_id === id)?.category_name
    )
    .filter((name): name is string => Boolean(name));

  return { ...filters, sizeKg, categoryLabels: fromMaster };
}

/**
 * The single aggregation pass, shared by the report and the drill-down so the
 * two can never disagree about a number.
 */
function aggregate(
  input: AppliedFilterContext,
  source: IncentiveSourceData,
  options: { withDocuments?: boolean } = {}
): AggregateResult {
  const filters = applyCategoryScope(input, source);
  const context = buildContext(source);
  const accumulators = new Map<string, EvidenceAccumulator>();
  const money = new Map<string, CustomerClaimMoney>();
  const exceptions: ReportException[] = [];
  const claims: IncentiveClaimSummary[] = [];
  const documents: SupportingDocument[] = [];
  const shared = {
    context,
    accumulators,
    exceptions,
    documents: options.withDocuments ? documents : undefined,
  };

  accumulateInvoices({
    ...shared,
    filters,
    invoices: source.invoices,
    details: source.invoiceDetails,
  });

  accumulateReturns({
    ...shared,
    filters,
    returns: source.returns,
    returnDetails: source.returnDetails,
  });

  accumulateClaims({
    context,
    money,
    claims,
    exceptions,
    documents: options.withDocuments ? documents : undefined,
    source,
  });

  const rows = finalizeRows(filters, context, accumulators, money, exceptions);

  // The status cut removes whole customers from the answer, so their memos
  // leave the register with them — otherwise the claims tab would count
  // approvals for customers the grid no longer shows.
  let visibleClaims = claims;
  if (filters.claimStatus) {
    const keptMemos = new Set(rows.flatMap((row) => row.memoNumbers));
    visibleClaims = claims.filter((claim) => keptMemos.has(claim.memoNumber));
  }

  const sourceRowCount =
    source.invoices.length +
    source.invoiceDetails.length +
    source.returns.length +
    source.returnDetails.length +
    source.memos.length;

  return { filters, rows, exceptions, claims: visibleClaims, documents, sourceRowCount };
}

/**
 * Pure report builder — no I/O, so the aggregation is unit-testable with
 * fixture rows.
 */
export function buildCustomerIncentiveReport(
  filters: AppliedFilterContext,
  source: IncentiveSourceData,
  generatedAt: Date = new Date()
): CustomerIncentiveReportResponse {
  const result = aggregate(filters, source);

  return {
    filters: result.filters,
    generatedAt: generatedAt.toISOString(),
    reportingCutoff: filters.endDate,
    sourceRowCount: result.sourceRowCount,
    overview: buildOverview(result.rows, result.exceptions),
    rows: result.rows,
    exceptions: result.exceptions,
    claims: result.claims,
  };
}

/**
 * Fetches every collection the report needs and returns the typed envelope.
 *
 * Throws:
 *  - UpstreamHttpError      — network failure or non-2xx HTTP response
 *  - UpstreamContractError  — a Directus payload is missing a required field
 *  - AbortError             — the request was cancelled via the signal
 */
export async function fetchCustomerIncentiveReport(
  filters: AppliedFilterContext,
  options: CustomerIncentiveRepoOptions = {}
): Promise<CustomerIncentiveReportResponse> {
  const source = await fetchCustomerIncentiveSources(filters, options);
  return buildCustomerIncentiveReport(filters, source, options.now ?? new Date());
}

/**
 * Eligible volume, claims and document trail behind one customer, using the
 * same aggregation pass as the table so the drill-down reconciles with what
 * was displayed.
 */
export async function fetchCustomerIncentiveDetail(
  filters: AppliedFilterContext,
  customerCode: string,
  options: CustomerIncentiveRepoOptions = {}
): Promise<CustomerIncentiveDetail> {
  // The drill-down replaces the customer cut rather than adding to it: the
  // drawer answers for one customer, whatever the grid was filtered to.
  const scoped: AppliedFilterContext = { ...filters, customerCodes: [customerCode] };
  const source = await fetchCustomerIncentiveSources(scoped, options);
  const result = aggregate(scoped, source, { withDocuments: true });

  const row = result.rows.find(
    (candidate) =>
      candidate.customerCode.toUpperCase() === customerCode.trim().toUpperCase()
  );
  const customer = source.customers.find(
    (candidate) => candidate.customer_code?.trim().toUpperCase() === customerCode.trim().toUpperCase()
  );

  return {
    customerCode,
    customerName: row?.customerName ?? customer?.customer_name ?? customerCode,
    storeName: row?.storeName ?? customer?.store_name ?? "",
    classificationName: row?.classificationName ?? "Unclassified",
    branchName: row?.branchNames.join(", ") || "Unassigned",
    window: {
      startDate: dateOnly(scoped.startDate),
      endDate: dateOnly(scoped.endDate),
    },
    rows: row ? [row] : [],
    claims: row
      ? result.claims.filter(
          (claim) => row.memoNumbers.includes(claim.memoNumber)
        )
      : [],
    documents: result.documents,
    exceptions: result.exceptions.filter(
      (item) =>
        item.customerCode?.trim().toUpperCase() === customerCode.trim().toUpperCase()
    ),
  };
}
