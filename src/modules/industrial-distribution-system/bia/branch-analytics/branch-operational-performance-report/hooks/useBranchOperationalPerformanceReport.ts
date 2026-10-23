// hooks/useBranchOperationalPerformanceReport.ts
// ──────────────────────────────────────────────────────────────────────────────
// Hook helper to consume BranchOperationalReportContext.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  BranchOperationalReportContext,
  type BranchOperationalReportContextValue,
} from "../providers/BranchOperationalPerformanceReportProvider";

export function useBranchOperationalPerformanceReport(): BranchOperationalReportContextValue {
  const context = React.useContext(BranchOperationalReportContext);
  if (!context) {
    throw new Error(
      "useBranchOperationalPerformanceReport must be used within BranchOperationalPerformanceReportProvider"
    );
  }
  return context;
}
