// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/CylinderDepositSwapReportModule.tsx
// ==============================================================================
// Root Orchestrator Module for Cylinder Deposit and Swap Report.
// Assembles providers, filters, KPI cards, visual charts, master table, and audit drawer.
// ==============================================================================

"use client";

import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { CylinderDepositSwapReportProvider } from "./providers/CylinderDepositSwapReportProvider";
import { CylinderDepositSwapHeader } from "./components/CylinderDepositSwapHeader";
import { CylinderDepositSwapFilters } from "./components/CylinderDepositSwapFilters";
import { CylinderDepositSwapKPIs } from "./components/CylinderDepositSwapKPIs";
import { CylinderDepositSwapCharts } from "./components/CylinderDepositSwapCharts";
import { CylinderDepositSwapTable } from "./components/CylinderDepositSwapTable";
import { CylinderTransactionDrawer } from "./components/CylinderTransactionDrawer";
import { useCylinderDepositSwapReport } from "./hooks/useCylinderDepositSwapReport";

function CylinderDepositSwapReportContent() {
  const { error, refresh, isLoading } = useCylinderDepositSwapReport();

  return (
    <div className="w-full min-w-0 space-y-5 animate-in fade-in duration-300">
      {/* 1. Header & Actions */}
      <CylinderDepositSwapHeader />

      {/* 2. Filter Parameters Bar */}
      <CylinderDepositSwapFilters />

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isLoading}
            className="inline-flex items-center gap-1 font-semibold underline hover:opacity-80"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 3. KPI Summary Bar */}
      <CylinderDepositSwapKPIs />

      {/* 4. Graphical Analytics (Recharts) */}
      <CylinderDepositSwapCharts />

      {/* 5. Primary Table with Customer/Product Grouping */}
      <CylinderDepositSwapTable />

      {/* 6. Drill-down Audit Drawer */}
      <CylinderTransactionDrawer />
    </div>
  );
}

export default function CylinderDepositSwapReportModule() {
  return (
    <CylinderDepositSwapReportProvider>
      <CylinderDepositSwapReportContent />
    </CylinderDepositSwapReportProvider>
  );
}
