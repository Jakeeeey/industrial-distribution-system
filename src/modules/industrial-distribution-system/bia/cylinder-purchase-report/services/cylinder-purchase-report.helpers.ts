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

function localDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getRollingThirtyDayRange(
  now: Date = new Date(),
): RollingThirtyDayRange {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { startDate: localDateOnly(start), endDate: localDateOnly(end) };
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
