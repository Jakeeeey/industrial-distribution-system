// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceHeader.tsx
// ==============================================================================
// Header & Action Bar for Stock Movement and Variance Report.
// Left side is title + description only; the branch and period the figures were
// produced from belong to the filter card below, never restated here.
// Exports stay disabled until a dataset is actually loaded (spec §11).
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";

export function StockMovementVarianceHeader() {
  const { report, isLoading, refresh, exportExcel, exportPdf } =
    useStockMovementVarianceReport();

  const hasData = Boolean(report && report.rows.length > 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl border bg-card shadow-2xs"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary/40 to-transparent"
      />

      <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground sm:text-xl">
            Stock Movement and Variance Report
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
            Reconciles ledger movement against counted stock — expected = opening + in − out,
            variance = counted − expected, in base units.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => refresh()}
            disabled={isLoading || !report}
            className="h-9 gap-1.5 text-xs font-semibold shadow-2xs"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            <span>{isLoading ? "Reconciling" : "Refresh"}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={exportExcel}
            disabled={!hasData}
            className="h-9 gap-1.5 border-emerald-500/25 bg-emerald-500/10 text-xs font-semibold text-emerald-700 shadow-2xs hover:bg-emerald-500/20 hover:text-emerald-700 dark:text-emerald-400"
          >
            <FileSpreadsheet className="size-3.5" />
            <span>Excel</span>
          </Button>

          <Button
            type="button"
            onClick={exportPdf}
            disabled={!hasData}
            className="h-9 gap-1.5 text-xs font-semibold shadow-2xs"
          >
            <FileText className="size-3.5" />
            <span>PDF</span>
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
