import type {
  QuantityMetrics,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

export function emptyMetrics(): QuantityMetrics {
  return { grossPurchasedQty: 0, returnedQty: 0, netPurchasedQty: 0 };
}

export function addMetrics(target: QuantityMetrics, row: QuantityMetrics): void {
  target.grossPurchasedQty += row.grossPurchasedQty;
  target.returnedQty += row.returnedQty;
  target.netPurchasedQty += row.netPurchasedQty;
}

export function returnRate(metrics: QuantityMetrics): number {
  return metrics.grossPurchasedQty > 0
    ? metrics.returnedQty / metrics.grossPurchasedQty
    : 0;
}

export function byRank<T extends QuantityMetrics>(
  displayName: (item: T) => string,
  identity: (item: T) => string | number,
): (left: T, right: T) => number {
  return (left, right) =>
    right.netPurchasedQty - left.netPurchasedQty ||
    displayName(left).localeCompare(displayName(right)) ||
    compareIdentity(identity(left), identity(right));
}

function compareIdentity(left: string | number, right: string | number): number {
  return typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right));
}
