// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/components/CylinderDepositSwapHeader.tsx
// ==============================================================================
// Header Component for Cylinder Deposit and Swap Report.
// Displays title, subtitle, live status badge, and primary export/refresh actions.
// ==============================================================================

"use client";

import * as React from "react";
import { RefreshCw, FileSpreadsheet, FileText, Cylinder } from "lucide-react";
import { useCylinderDepositSwapReport } from "../hooks/useCylinderDepositSwapReport";

export function CylinderDepositSwapHeader() {
  const { report, isLoading, refresh, exportExcel, exportPdf } =
    useCylinderDepositSwapReport();

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cylinder className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Cylinder Deposit and Swap Report
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor customer cylinder balances, new deposit issuance, refill exchange turnover, and asset custody.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {report?.generatedAt && (
          <span className="hidden lg:inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            As of: {report.generatedAt}
          </span>
        )}

        <button
          type="button"
          onClick={() => refresh()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-xs hover:bg-muted focus:outline-hidden disabled:opacity-50 transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
          <span>Refresh</span>
        </button>

        <button
          type="button"
          onClick={exportExcel}
          disabled={isLoading || !report || report.rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 focus:outline-hidden disabled:opacity-50 transition-colors shadow-xs"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Export Excel</span>
        </button>

        <button
          type="button"
          onClick={exportPdf}
          disabled={isLoading || !report || report.rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-600/30 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 focus:outline-hidden disabled:opacity-50 transition-colors shadow-xs"
        >
          <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span>Export PDF</span>
        </button>
      </div>
    </div>
  );
}
