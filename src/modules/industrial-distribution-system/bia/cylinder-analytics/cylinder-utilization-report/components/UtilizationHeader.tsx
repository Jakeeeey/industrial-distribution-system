// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationHeader.tsx
// ==============================================================================
// Header & Action Bar for the Cylinder Utilization Report.
// Shows the module identity, the reporting cutoff the fleet was measured against,
// and dispatches Refresh / Excel / PDF.
//
// Spec §1 intent — "identify idle assets and measure cylinder fleet usage" — is
// restated in the subtitle so a reviewer sees the measurement basis without
// opening the legend.
//
// Complies with VoSync Design System standards:
// - Responsive action strip with hover elevation
// - Exports disabled until a dataset is actually loaded
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { FileSpreadsheet, FileText, Gauge, RefreshCw } from "lucide-react";
import { useCylinderUtilizationReport } from "../hooks/useCylinderUtilizationReport";
import { formatCutoffLabel } from "../services";

export function UtilizationHeader() {
  const { refresh, exportExcel, exportPdf, isLoading, reportData } = useCylinderUtilizationReport();

  return (
    <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
      {/* ── Title & Cutoff ──────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Cylinder Utilization Report
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Fleet usage by branch and cylinder size, with dormant assets identified as of the reporting cutoff.
            </p>
          </div>
        </div>

        {/* Cutoff is labelled explicitly: the reading is point-in-time, not a historical snapshot. */}
        {reportData && (
          <p className="text-[11px] font-medium text-muted-foreground">
            Measured as at{" "}
            <span className="font-mono font-bold text-foreground">
              {formatCutoffLabel(reportData.reportingCutoff)}
            </span>
          </p>
        )}
      </div>

      {/* ── Action Buttons Strip ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => refresh()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted disabled:opacity-50"
          title="Re-read the fleet as at the reporting cutoff"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>

        <button
          type="button"
          onClick={exportExcel}
          disabled={isLoading || !reportData?.rows?.length}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
          title="Download the utilization workbook"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>Export Excel</span>
        </button>

        <button
          type="button"
          onClick={exportPdf}
          disabled={isLoading || !reportData?.rows?.length}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50"
          title="Download a print-ready utilization report"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Export PDF</span>
        </button>
      </div>
    </div>
  );
}
