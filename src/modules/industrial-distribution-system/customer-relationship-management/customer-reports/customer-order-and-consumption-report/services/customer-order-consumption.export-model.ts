// ============================================================
// customer-order-consumption.export-model.ts
// Turns the report envelope into neutral title/columns/rows sections that
// both the xlsx and the pdf writers consume, so the two files can never
// disagree about a number.
// ============================================================

import type {
  AppliedFilterContext,
  ChannelTotals,
  CustomerOrderConsumptionOverview,
  CustomerOrderConsumptionReportResponse,
  CustomerOrderConsumptionRow,
  MonthlyTrendPoint,
  ReportException,
} from "../types/customer-order-consumption.types";
import {
  computeReturnRate,
  formatKgExact,
  formatPercent,
  formatReportDate,
  formatYearMonth,
} from "./customer-order-consumption.helpers";

export type ReportExportCell = string | number;

export interface ReportExportSection {
  title: string;
  columns: string[];
  rows: ReportExportCell[][];
}

export interface ReportExportFilterContextItem {
  label: string;
  value: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  CYLINDER: "Cylinder / bulk purchase",
  LPG: "Metered & weighed LPG",
};

/**
 * A multi-select reads as a list in an export. Nothing picked is reported as
 * the whole population, because that is what the run actually covered.
 */
function selectionText(
  labels: string[] | undefined,
  values: readonly (string | number)[] | undefined,
  allLabel: string
): string {
  if (!values || values.length === 0) return allLabel;
  const readable = labels && labels.length === values.length ? labels : values.map(String);
  if (readable.length === 1) return readable[0];
  return `${readable.length} selected: ${readable.join(", ")}`;
}

/**
 * The applied filters are echoed into every export so a printed page stays
 * interpretable months later, when nobody remembers the window used.
 */
export function buildReportFilterContext(
  filters: AppliedFilterContext
): ReportExportFilterContextItem[] {
  return [
    { label: "Period", value: `${filters.startDate} to ${filters.endDate}` },
    {
      label: "Branch",
      value: selectionText(filters.branchLabels, filters.branchIds, "All branches"),
    },
    {
      label: "Customer",
      value: selectionText(filters.customerLabels, filters.customerCodes, "All customers"),
    },
    {
      label: "Salesman",
      value: selectionText(filters.salesmanLabels, filters.salesmanIds, "All salesmen"),
    },
    {
      label: "Classification",
      value: selectionText(
        filters.classificationLabels,
        filters.classificationIds,
        "All classifications"
      ),
    },
    {
      label: "Channel",
      value: filters.channel ? CHANNEL_LABEL[filters.channel] : "Cylinder and LPG, kept separate",
    },
  ];
}

function overviewSection(
  overview: CustomerOrderConsumptionOverview
): ReportExportSection {
  const metric = (
    label: string,
    read: (totals: ChannelTotals) => ReportExportCell
  ): ReportExportCell[] => [label, read(overview.cylinder), read(overview.lpg)];

  return {
    title: "Overview",
    // Two columns, never a combined one: cylinder kg is a purchase proxy and
    // LPG kg is measured usage.
    columns: [
      "Metric",
      "Cylinder / bulk purchase",
      "Metered & weighed LPG",
    ],
    rows: [
      metric("Customers", (totals) => totals.customers),
      metric("Purchase / billing events", (totals) => totals.orders),
      metric("Gross quantity", (totals) => totals.grossQty),
      metric("Returned quantity", (totals) => totals.returnedQty),
      metric("Gross kg", (totals) => totals.grossKg),
      metric("Returned kg", (totals) => totals.returnedKg),
      metric("Net kg", (totals) => totals.netKg),
      metric("Net amount (PHP)", (totals) => Number(totals.netAmount.toFixed(2))),
      metric("Avg net kg per event", (totals) => Number(totals.avgOrderSizeKg.toFixed(3))),
      metric("Return rate", (totals) => formatPercent(totals.returnRatePct)),
      ["Data exceptions", overview.exceptionCount, overview.exceptionCount],
    ],
  };
}

function demandRowColumns(): string[] {
  return [
    "Customer Code",
    "Customer",
    "Store",
    "Classification",
    "Branch",
    "Channel",
    "Billing Mode",
    "kg Basis",
    "Product Code",
    "Product",
    "Gas Type (from category)",
    "Size kg",
    "Unit",
    "Events",
    "Gross Qty",
    "Returned Qty",
    "Net Qty",
    "Gross kg",
    "Returned kg",
    "Net kg",
    "Return Rate",
    "Net Amount",
    "Avg Net kg / Event",
    "Metered kg",
    "Weighed kg",
    "Variance kg",
    "Flags",
  ];
}

function demandRow(row: CustomerOrderConsumptionRow): ReportExportCell[] {
  return [
    row.customerCode,
    row.customerName,
    row.storeName,
    row.classificationName,
    row.branchName,
    CHANNEL_LABEL[row.channel] ?? row.channel,
    row.billingMode ?? "",
    // States, on every line, whether the kg was measured or inferred.
    row.kgIsProxy ? "Proxy (qty x cylinder size)" : "Measured",
    row.productCode,
    row.productName,
    row.gasType ?? "",
    row.sizeKg == null ? "" : row.sizeKg,
    row.quantityUnit,
    row.orderCount,
    row.grossQty,
    row.returnedQty,
    row.netQty,
    Number(row.grossKg.toFixed(3)),
    Number(row.returnedKg.toFixed(3)),
    Number(row.netKg.toFixed(3)),
    formatPercent(computeReturnRate(row.returnedKg, row.grossKg)),
    Number(row.netAmount.toFixed(2)),
    Number(row.avgOrderSizeKg.toFixed(3)),
    Number(row.meteredKg.toFixed(3)),
    Number(row.wiwoKg.toFixed(3)),
    Number(row.varianceKg.toFixed(3)),
    row.exceptionCodes.join(", "),
  ];
}

function demandSection(rows: CustomerOrderConsumptionRow[]): ReportExportSection {
  return {
    title: "Demand by Customer",
    columns: demandRowColumns(),
    rows: rows.map(demandRow),
  };
}

/**
 * The report-level trend would blend the two kg bases, so the export re-splits
 * it per month per channel straight from the rows.
 */
function trendSection(rows: CustomerOrderConsumptionRow[]): ReportExportSection {
  const buckets = new Map<string, MonthlyTrendPoint & { channel: string }>();
  const events = new Map<string, Set<string>>();

  for (const row of rows) {
    for (const point of row.monthlyTrend) {
      const key = `${point.yearMonth}|${row.channel}`;
      const current =
        buckets.get(key) ??
        {
          yearMonth: point.yearMonth,
          channel: row.channel,
          orderCount: 0,
          orderKeys: [],
          grossQty: 0,
          returnedQty: 0,
          grossKg: 0,
          returnedKg: 0,
          netKg: 0,
        };
      // Deduped so an order covering three products is one billing event.
      const bucket = events.get(key) ?? new Set<string>();
      for (const orderKey of point.orderKeys) bucket.add(orderKey);
      events.set(key, bucket);

      current.orderCount = bucket.size;
      current.grossQty += point.grossQty;
      current.returnedQty += point.returnedQty;
      current.grossKg += point.grossKg;
      current.returnedKg += point.returnedKg;
      current.netKg = current.grossKg - current.returnedKg;
      buckets.set(key, current);
    }
  }

  return {
    title: "Monthly Trend",
    columns: [
      "Month",
      "Channel",
      "Events",
      "Gross Qty",
      "Returned Qty",
      "Gross kg",
      "Returned kg",
      "Net kg",
    ],
    rows: [...buckets.values()]
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
      .map((point) => [
        formatYearMonth(point.yearMonth),
        CHANNEL_LABEL[point.channel] ?? point.channel,
        point.orderCount,
        point.grossQty,
        point.returnedQty,
        Number(point.grossKg.toFixed(3)),
        Number(point.returnedKg.toFixed(3)),
        Number(point.netKg.toFixed(3)),
      ]),
  };
}

function exceptionSection(exceptions: ReportException[]): ReportExportSection {
  return {
    title: "Data Exceptions",
    columns: [
      "Code",
      "Channel",
      "Customer Code",
      "Customer",
      "Reference Type",
      "Reference",
      "Quantity",
      "kg",
      "Detail",
    ],
    rows: exceptions.map((item) => [
      item.code,
      CHANNEL_LABEL[item.channel] ?? item.channel,
      item.customerCode,
      item.customerName,
      item.referenceType,
      item.referenceNo,
      item.quantity,
      Number(item.kg.toFixed(3)),
      item.detail,
    ]),
  };
}

/**
 * Every sheet the report can produce, in the order they are written.
 */
export function buildReportExportSections(
  report: CustomerOrderConsumptionReportResponse
): ReportExportSection[] {
  return [
    overviewSection(report.overview),
    demandSection(report.rows),
    trendSection(report.rows),
    exceptionSection(report.exceptions),
  ];
}

/**
 * Flat table only — the sheet a user pivots in Excel themselves.
 */
export function buildDemandExportSections(
  rows: CustomerOrderConsumptionRow[]
): ReportExportSection[] {
  return [{ title: "Demand by Customer", columns: demandRowColumns(), rows: rows.map(demandRow) }];
}

/** Compact kg text used by the table cells and the PDF footer. */
export function exportKg(value: number): string {
  return formatKgExact(value);
}

/** Date text reused by the documents sheet and the drawer. */
export function exportDate(value: string | null | undefined): string {
  return formatReportDate(value);
}
