// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/hooks/useStockMovementVarianceReport.ts
// ==============================================================================
// Consumer Hook for Stock Movement and Variance Report.
// Provides type-safe access to report state, filters, exports and drill-downs.
// ==============================================================================

"use client";

import * as React from "react";
import {
  StockMovementVarianceContext,
  type StockMovementVarianceContextValue,
} from "../providers/StockMovementVarianceReportProvider";

/**
 * Hook to access the Stock Movement and Variance Report context.
 * Throws an explicit error if called outside StockMovementVarianceReportProvider.
 */
export function useStockMovementVarianceReport(): StockMovementVarianceContextValue {
  const context = React.useContext(StockMovementVarianceContext);
  if (!context) {
    throw new Error(
      "useStockMovementVarianceReport must be used within a StockMovementVarianceReportProvider"
    );
  }
  return context;
}
