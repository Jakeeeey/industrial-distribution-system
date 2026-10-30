// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/StockMovementVarianceReportModule.tsx
// ==============================================================================
// Root Orchestrator Module for Stock Movement and Variance Report.
// Assembles the provider, filter bar, KPI band, results table and the
// supporting-record panel, plus any source-data warnings the BFF raised.
//
// Self-contained: every child, service and type lives inside this module folder.
// ==============================================================================

"use client";

import * as React from "react";
import { AlertCircle, Info, RefreshCw, TriangleAlert } from "lucide-react";
import { StockMovementVarianceReportProvider } from "./providers/StockMovementVarianceReportProvider";
import { StockMovementVarianceHeader } from "./components/StockMovementVarianceHeader";
import { StockMovementVarianceFilters } from "./components/StockMovementVarianceFilters";
import { StockMovementVarianceKPIs } from "./components/StockMovementVarianceKPIs";
import { StockMovementVarianceTable } from "./components/StockMovementVarianceTable";
import { StockMovementVarianceDrawer } from "./components/StockMovementVarianceDrawer";
import { useStockMovementVarianceReport } from "./hooks/useStockMovementVarianceReport";

/** Renders the source-data limitations the BFF could not resolve silently. */
function SourceWarnings() {
  const { report } = useStockMovementVarianceReport();

  if (!report || report.warnings.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
        <TriangleAlert className="h-3.5 w-3.5" />
        <span>Source data notes for this period</span>
      </p>
      <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
        {report.warnings.map((warning, index) => (
          <li key={index} className="flex items-start gap-1.5">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{warning}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StockMovementVarianceReportContent() {
  const { error, isLoading, refresh, filters } = useStockMovementVarianceReport();

  return (
    <div className="w-full min-w-0 space-y-5 animate-in fade-in duration-300">
      {/* 1. Header & export actions */}
      <StockMovementVarianceHeader />

      {/* 2. Filter parameters bar */}
      <StockMovementVarianceFilters />

      {/* Blocking failure, with a retry that keeps the chosen scope */}
      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <div className="flex min-w-0 items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isLoading || !filters.branchId}
            className="inline-flex shrink-0 items-center gap-1 font-semibold underline hover:opacity-80 disabled:no-underline disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : null}

      {/* 3. Source data limitations, surfaced not hidden */}
      <SourceWarnings />

      {/* 4. KPI summary band */}
      <StockMovementVarianceKPIs />

      {/* 5. Results table */}
      <StockMovementVarianceTable />

      {/* 6. Supporting-record drill-down panel */}
      <StockMovementVarianceDrawer />
    </div>
  );
}

export default function StockMovementVarianceReportModule() {
  return (
    <StockMovementVarianceReportProvider>
      <StockMovementVarianceReportContent />
    </StockMovementVarianceReportProvider>
  );
}
