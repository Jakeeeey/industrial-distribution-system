// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/services/cylinder-deposit-swap.calc.ts
// ==============================================================================
// Pure calculation, filtering, and aggregation utilities for Cylinder Deposit
// and Swap Report. Contains zero network logic for maximum testability.
// ==============================================================================

import type {
  CustomerCylinderReportRow,
  CustomerProductCylinderRow,
  CylinderDepositSwapKPISummary,
  CylinderProductDistributionPoint,
} from "../types/cylinder-deposit-swap.types";

/**
 * Calculates closing cylinder base using the standard CTR business formula:
 * Closing Base = Opening Base + Deposits Delivered - Deposits Pulled Out + Net Swap Variance
 */
export function calculateClosingBase(
  openingBase: number,
  depositsDelivered: number,
  depositsPulledOut: number,
  netSwapVariance: number
): number {
  return openingBase + depositsDelivered - depositsPulledOut + netSwapVariance;
}

/**
 * Re-aggregates customer product rows to update parent customer totals.
 */
export function recalculateCustomerTotals(
  products: CustomerProductCylinderRow[]
): Omit<CustomerCylinderReportRow, "customerCode" | "customerName" | "storeName" | "branchId" | "branchName" | "contactNumber" | "customerAddress" | "products" | "lastTransactionDate"> {
  return products.reduce(
    (acc, p) => ({
      totalOpeningBase: acc.totalOpeningBase + p.openingBase,
      totalDepositsDelivered: acc.totalDepositsDelivered + p.depositsDelivered,
      totalSwapsInbound: acc.totalSwapsInbound + p.swapsInbound,
      totalSwapsOutbound: acc.totalSwapsOutbound + p.swapsOutbound,
      totalDepositsPulledOut: acc.totalDepositsPulledOut + p.depositsPulledOut,
      totalNetVariance: acc.totalNetVariance + p.netSwapVariance,
      totalClosingBase: acc.totalClosingBase + p.closingBase,
    }),
    {
      totalOpeningBase: 0,
      totalDepositsDelivered: 0,
      totalSwapsInbound: 0,
      totalSwapsOutbound: 0,
      totalDepositsPulledOut: 0,
      totalNetVariance: 0,
      totalClosingBase: 0,
    }
  );
}

/**
 * Filters report rows by text query (matches customer code, customer name, store name, or product name).
 */
export function filterReportRows(
  rows: CustomerCylinderReportRow[],
  searchQuery: string
): CustomerCylinderReportRow[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return rows;

  return rows.filter((row) => {
    const matchesCustomer =
      row.customerCode.toLowerCase().includes(query) ||
      row.customerName.toLowerCase().includes(query) ||
      (row.storeName && row.storeName.toLowerCase().includes(query)) ||
      (row.branchName && row.branchName.toLowerCase().includes(query));

    if (matchesCustomer) return true;

    // Check if any child product row matches
    return row.products.some(
      (p) =>
        p.productCode.toLowerCase().includes(query) ||
        p.productName.toLowerCase().includes(query)
    );
  });
}

/**
 * Formats standard numeric quantity with sign badge indicator if non-zero delta.
 */
export function formatQuantityWithSign(val: number): string {
  if (val > 0) return `+${val.toLocaleString()}`;
  return val.toLocaleString();
}

/**
 * Computes product distribution breakdown for Recharts donut charts.
 */
export function computeProductDistribution(
  rows: CustomerCylinderReportRow[]
): CylinderProductDistributionPoint[] {
  const productTotals = new Map<string, number>();
  let grandTotal = 0;

  for (const row of rows) {
    for (const prod of row.products) {
      const current = productTotals.get(prod.productName) || 0;
      productTotals.set(prod.productName, current + prod.closingBase);
      grandTotal += prod.closingBase;
    }
  }

  const results: CylinderProductDistributionPoint[] = [];
  productTotals.forEach((quantity, productName) => {
    results.push({
      productName,
      quantity,
      percentage: grandTotal > 0 ? Math.round((quantity / grandTotal) * 100) : 0,
    });
  });

  return results.sort((a, b) => b.quantity - a.quantity);
}
