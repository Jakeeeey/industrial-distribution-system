// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/CylinderUtilizationReportModule.tsx
// ==============================================================================
// Root Orchestrator for the Cylinder Utilization Report (IDS BIA Subsystem).
// Route: /ids/bia/cylinder-analytics/cylinder-utilization-report
//
// Assembles the spec §11 layout — filter bar, KPI summary, results table, details
// panel and export action — over a single state provider. The shell is deliberately
// thin: every figure and every drill-down is resolved in the provider and service
// layers, so this file only composes view order.
//
// Complies with VoSync Design System standards:
// - Error banner with an inline retry rather than a dead grid
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { CylinderUtilizationReportProvider } from "./providers/CylinderUtilizationReportProvider";
import { useCylinderUtilizationReport } from "./hooks/useCylinderUtilizationReport";
import { UtilizationHeader } from "./components/UtilizationHeader";
import { UtilizationFilters } from "./components/UtilizationFilters";
import { UtilizationRuleLegend } from "./components/UtilizationRuleLegend";
import { UtilizationKPIs } from "./components/UtilizationKPIs";
import { UtilizationTable } from "./components/UtilizationTable";
import { UtilizationDrawer } from "./components/UtilizationDrawer";

function CylinderUtilizationReportContent() {
  const { error, refresh, isLoading } = useCylinderUtilizationReport();

  return (
    <div className="w-full min-w-0 animate-in space-y-5 fade-in duration-300">
      {/* 1. Header, cutoff label and export actions */}
      <UtilizationHeader />

      {/* 2. Reporting period, branch and cylinder-size parameters */}
      <UtilizationFilters />

      {/* 3. Failure banner — the grid below stays empty and retryable, never stale */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isLoading}
            className="inline-flex shrink-0 items-center gap-1 font-semibold underline hover:opacity-80"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 4. KPI summary strip */}
      <UtilizationKPIs />

      {/* 5. Results grid with per-bucket drill-down */}
      <UtilizationTable />

      {/* 6. Applied rules and surfaced source limitations */}
      <UtilizationRuleLegend />

      {/* 7. Supporting-records details panel */}
      <UtilizationDrawer />
    </div>
  );
}

export default function CylinderUtilizationReportModule() {
  return (
    <CylinderUtilizationReportProvider>
      <CylinderUtilizationReportContent />
    </CylinderUtilizationReportProvider>
  );
}
