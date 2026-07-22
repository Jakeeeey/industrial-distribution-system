import { buildCylinderPurchaseAggregates } from "./cylinder-purchase-report.aggregation.ts";
import type {
  CylinderPurchaseDashboardResponse,
  CylinderPurchaseReportFilters,
  CylinderPurchaseRow,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

interface RollingThirtyDayRange {
  startDate: string;
  endDate: string;
}

const REPORT_TIME_ZONE = "Asia/Manila";

const reportDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function reportCalendarDate(now: Date): Date {
  const parts = reportDateFormatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

function calendarDateOnly(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export function getRollingThirtyDayRange(
  now: Date = new Date(),
): RollingThirtyDayRange {
  const end = reportCalendarDate(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return {
    startDate: calendarDateOnly(start),
    endDate: calendarDateOnly(end),
  };
}

export function aggregateCylinderPurchases(
  rows: CylinderPurchaseRow[],
  filters: CylinderPurchaseReportFilters,
  generatedAt: string = new Date().toISOString(),
): CylinderPurchaseDashboardResponse {
  const aggregates = buildCylinderPurchaseAggregates(rows);

  return {
    filters,
    generatedAt,
    sourceRowCount: rows.length,
    overview: {
      ...aggregates.overview,
      uniqueCustomers: aggregates.customerRanking.length,
      serializedProducts: aggregates.productPerformance.length,
    },
    customerRanking: aggregates.customerRanking,
    productPerformance: aggregates.productPerformance,
    returnAnalysis: aggregates.returnAnalysis,
    branchPerformance: aggregates.branchPerformance,
    salespersonPerformance: aggregates.salespersonPerformance,
  };
}
