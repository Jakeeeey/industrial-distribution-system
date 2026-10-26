// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/hooks/useCylinderDepositSwapReport.ts
// ==============================================================================
// Consumer Hook for Cylinder Deposit and Swap Report.
// Provides type-safe access to report state, filters, exports, and drill-downs.
// ==============================================================================

"use client";

import * as React from "react";
import {
  CylinderDepositSwapContext,
  type CylinderDepositSwapContextValue,
} from "../providers/CylinderDepositSwapReportProvider";

/**
 * Hook to access Cylinder Deposit and Swap Report context.
 * Throws an explicit error if called outside of CylinderDepositSwapReportProvider.
 */
export function useCylinderDepositSwapReport(): CylinderDepositSwapContextValue {
  const context = React.useContext(CylinderDepositSwapContext);
  if (!context) {
    throw new Error(
      "useCylinderDepositSwapReport must be used within a CylinderDepositSwapReportProvider"
    );
  }
  return context;
}
