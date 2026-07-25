import type {
  ReturnAnalysisDataset,
  ReturnAnalysisItem,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

export type ReturnGrouping =
  | "customer"
  | "product"
  | "branch"
  | "salesperson";

export interface RankedReportRow<T> {
  rank: number;
  data: T;
}

const quantityFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 3,
});
const percentFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 2,
});

export function rankReportRows<T>(rows: readonly T[]): RankedReportRow<T>[] {
  return rows.map((data, index) => ({ rank: index + 1, data }));
}

export function formatQuantity(value: number): string {
  return quantityFormatter.format(value);
}

export function formatReturnRate(
  returnRate: number,
  grossPurchasedQty: number,
): string {
  const safeRate =
    grossPurchasedQty > 0 && Number.isFinite(returnRate) ? returnRate : 0;
  return percentFormatter.format(safeRate);
}

export function getReturnAnalysisRows(
  dataset: ReturnAnalysisDataset,
  grouping: ReturnGrouping,
): ReturnAnalysisItem[] {
  const rowsByGrouping: Record<ReturnGrouping, ReturnAnalysisItem[]> = {
    customer: dataset.byCustomer,
    product: dataset.byProduct,
    branch: dataset.byBranch,
    salesperson: dataset.bySalesperson,
  };

  return rowsByGrouping[grouping];
}
