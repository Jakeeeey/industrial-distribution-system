// ============================================================
// customer-order-consumption.service.ts
// Orchestration layer — fetches the raw rows, folds both channels into the
// shared accumulator index, then freezes the result envelope.
// No UI logic, no SQL, no direct fetch() here.
// ============================================================

import type {
  AppliedFilterContext,
  ConsumptionSourceData,
  CustomerOrderConsumptionDetail,
  CustomerOrderConsumptionReportResponse,
  CustomerOrderConsumptionRow,
  ReportException,
  SupportingDocument,
} from "../types/customer-order-consumption.types";
import {
  buildContext,
  buildOverview,
  buildOverallTrend,
  finalizeRow,
  type RowAccumulator,
} from "./customer-order-consumption.calc";
import { accumulateCylinder } from "./customer-order-consumption.cylinder-calc";
import { accumulateLpg } from "./customer-order-consumption.lpg-calc";
import { dateOnly } from "./customer-order-consumption.helpers";
import {
  fetchCustomerOrderConsumptionSources,
  type CustomerOrderConsumptionRepoOptions,
} from "./customer-order-consumption.repo";

interface AggregateOptions {
  /** The drill-down needs the document trail; the table does not. */
  withDocuments?: boolean;
}

interface AggregateResult {
  rows: CustomerOrderConsumptionRow[];
  exceptions: ReportException[];
  documents: SupportingDocument[];
  sourceRowCount: number;
}

/**
 * Customers surviving the classification selection. Null means "nothing was
 * picked", which keeps the channel loops free of a null-check per row.
 */
function allowedCustomerCodes(
  source: ConsumptionSourceData,
  classificationIds?: number[]
): Set<string> | null {
  if (!classificationIds || classificationIds.length === 0) return null;
  const picked = new Set(classificationIds);
  return new Set(
    source.customers
      .filter((customer) => customer.classification != null && picked.has(customer.classification))
      .map((customer) => customer.customer_code)
  );
}

/**
 * Rows that carry no movement and no anomaly would only add noise to a
 * demand report, so they are dropped before the envelope is built.
 */
function isMeaningful(row: CustomerOrderConsumptionRow): boolean {
  return (
    row.grossQty !== 0 ||
    row.grossKg !== 0 ||
    row.returnedQty !== 0 ||
    row.returnedKg !== 0 ||
    row.netAmount !== 0 ||
    row.exceptionCodes.length > 0
  );
}

/** Customer first, then the heaviest channel/product inside that customer. */
function compareRows(a: CustomerOrderConsumptionRow, b: CustomerOrderConsumptionRow): number {
  const byCustomer = a.customerName.localeCompare(b.customerName);
  if (byCustomer !== 0) return byCustomer;
  const byBranch = a.branchName.localeCompare(b.branchName);
  if (byBranch !== 0) return byBranch;
  const byChannel = a.channel.localeCompare(b.channel);
  if (byChannel !== 0) return byChannel;
  return b.grossKg - a.grossKg;
}

/**
 * The single aggregation pass, shared by the report and the drill-down so
 * the two can never disagree about a number.
 */
function aggregate(
  filters: AppliedFilterContext,
  source: ConsumptionSourceData,
  options: AggregateOptions = {}
): AggregateResult {
  const context = buildContext(source);
  const accumulators = new Map<string, RowAccumulator>();
  const exceptions: ReportException[] = [];
  const documents: SupportingDocument[] = [];
  const allowed = allowedCustomerCodes(source, filters.classificationIds);

  // Each channel owns its own kg semantics, so a channel filter simply
  // skips the other pass rather than zeroing it after the fact.
  if (filters.channel !== "LPG") {
    accumulateCylinder({
      filters,
      context,
      invoices: source.invoices,
      invoiceDetails: source.invoiceDetails,
      returns: source.returns,
      returnDetails: source.returnDetails,
      returnLinks: source.returnLinks,
      postDispatch: source.postDispatch,
      allowedCustomerCodes: allowed,
      accumulators,
      exceptions,
      documents: options.withDocuments ? documents : undefined,
    });
  }

  if (filters.channel !== "CYLINDER") {
    accumulateLpg({
      filters,
      context,
      lpgSites: source.lpgSites,
      unifiedLpg: source.unifiedLpg,
      wiwoHeaders: source.wiwoHeaders,
      wiwoDetails: source.wiwoDetails,
      meterReadings: source.meterReadings,
      invoices: source.invoices,
      allowedCustomerCodes: allowed,
      accumulators,
      exceptions,
      documents: options.withDocuments ? documents : undefined,
    });
  }

  const rows = [...accumulators.values()]
    .map((acc) => finalizeRow(acc, context))
    .filter(isMeaningful)
    .sort(compareRows);

  const sourceRowCount =
    source.invoices.length +
    source.invoiceDetails.length +
    source.returns.length +
    source.returnDetails.length +
    source.unifiedLpg.length +
    source.wiwoHeaders.length +
    source.wiwoDetails.length +
    source.meterReadings.length;

  return { rows, exceptions, documents, sourceRowCount };
}

/**
 * Pure report builder — no I/O, so the aggregation is unit-testable with
 * fixture rows.
 */
export function buildCustomerOrderConsumptionReport(
  filters: AppliedFilterContext,
  source: ConsumptionSourceData,
  generatedAt: Date = new Date()
): CustomerOrderConsumptionReportResponse {
  const result = aggregate(filters, source);

  return {
    filters,
    generatedAt: generatedAt.toISOString(),
    reportingCutoff: filters.endDate,
    sourceRowCount: result.sourceRowCount,
    overview: buildOverview(result.rows, result.exceptions),
    rows: result.rows,
    exceptions: result.exceptions,
    monthlyTrend: buildOverallTrend(result.rows),
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
export async function fetchCustomerOrderConsumptionReport(
  filters: AppliedFilterContext,
  options: CustomerOrderConsumptionRepoOptions = {}
): Promise<CustomerOrderConsumptionReportResponse> {
  const source = await fetchCustomerOrderConsumptionSources(filters, options);
  return buildCustomerOrderConsumptionReport(
    filters,
    source,
    options.now ?? new Date()
  );
}

/**
 * Supporting documents behind one customer, using the same aggregation pass
 * as the table so drill-down totals reconcile with what was displayed.
 */
export async function fetchCustomerOrderConsumptionDetail(
  filters: AppliedFilterContext,
  customerCode: string,
  options: CustomerOrderConsumptionRepoOptions = {}
): Promise<CustomerOrderConsumptionDetail> {
  // The drawer is one customer deep, so the report's customer multi-select is
  // replaced rather than intersected with it.
  const scoped: AppliedFilterContext = { ...filters, customerCodes: [customerCode] };
  const source = await fetchCustomerOrderConsumptionSources(scoped, options);
  const result = aggregate(scoped, source, { withDocuments: true });

  const rows = result.rows.filter((row) => row.customerCode === customerCode);
  const first = rows[0];
  const customer = source.customers.find(
    (row) => row.customer_code === customerCode
  );

  return {
    customerCode,
    customerName: first?.customerName ?? customer?.customer_name ?? customerCode,
    storeName: first?.storeName ?? customer?.store_name ?? "",
    classificationName: first?.classificationName ?? "",
    branchName: [...new Set(rows.map((row) => row.branchName))].join(", ") ||
      "Unassigned",
    window: {
      startDate: dateOnly(scoped.startDate),
      endDate: dateOnly(scoped.endDate),
    },
    documents: result.documents,
    exceptions: result.exceptions.filter(
      (item) => item.customerCode === customerCode
    ),
  };
}
