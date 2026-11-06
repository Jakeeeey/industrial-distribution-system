// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationHeader.tsx
// ==============================================================================
// Header & Action Bar for the Cylinder Utilization Report.
// Left side is title + description only; every parameter the figures were built
// from belongs to the filter card below, not here.
//
// Complies with VoSync Design System standards:
// - Card surface matching the filter card directly beneath it
// - Single primary action (PDF); secondary exports stay colour-coded by format
// - Exports disabled until a dataset is actually loaded
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCylinderUtilizationReport } from "../hooks/useCylinderUtilizationReport";

export function UtilizationHeader() {
  const { refresh, exportExcel, exportPdf, isLoading, reportData } = useCylinderUtilizationReport();

  return (
    <section className="relative overflow-hidden rounded-xl border bg-card shadow-2xs">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary/40 to-transparent"
      />

      <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground sm:text-xl">
            Cylinder Utilization Report
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
            Fleet usage by branch and product, with dormant assets identified as of the reporting cutoff.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => refresh()}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-semibold shadow-2xs"
            title="Re-read the fleet as at the reporting cutoff"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={exportExcel}
            disabled={isLoading || !reportData?.rows?.length}
            className="h-9 gap-1.5 border-emerald-500/25 bg-emerald-500/10 text-xs font-semibold text-emerald-700 shadow-2xs hover:bg-emerald-500/20 hover:text-emerald-700 dark:text-emerald-400"
            title="Download the utilization workbook"
          >
            <FileSpreadsheet className="size-3.5" />
            <span>Export Excel</span>
          </Button>

          <Button
            type="button"
            onClick={exportPdf}
            disabled={isLoading || !reportData?.rows?.length}
            className="h-9 gap-1.5 text-xs font-semibold shadow-2xs"
            title="Download a print-ready utilization report"
          >
            <FileText className="size-3.5" />
            <span>Export PDF</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
