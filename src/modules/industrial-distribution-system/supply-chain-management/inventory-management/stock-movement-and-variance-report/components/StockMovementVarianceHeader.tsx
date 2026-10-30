// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceHeader.tsx
// ==============================================================================
// Header & Action Bar for Stock Movement and Variance Report.
// States the reporting scope and the calculation rule in plain language, then
// exposes refresh and the two export channels (spec §11 export action).
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet, FileText, RefreshCw, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";

export function StockMovementVarianceHeader() {
  const { report, filters, isLoading, refresh, exportExcel, exportPdf } =
    useStockMovementVarianceReport();

  const hasData = Boolean(report && report.rows.length > 0);
  const scopeLabel = report?.branchName ?? (filters.branchId ? `Branch #${filters.branchId}` : "No branch selected");

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between"
    >
      {/* ── Identity & scope ───────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Scale className="h-4 w-4" />
          </span>
          <h1 className="truncate text-base font-semibold tracking-tight">
            Stock Movement and Variance Report
          </h1>
        </div>

        <p className="text-xs text-muted-foreground">
          Investigates the difference between recorded stock and counted stock for{" "}
          <span className="font-medium text-foreground">{scopeLabel}</span>, period{" "}
          <span className="font-medium text-foreground">
            {filters.startDate} → {filters.endDate}
          </span>
          .
        </p>

        <p className="text-[11px] text-muted-foreground/90">
          Expected = opening + in − out · Variance = counted − expected · Figures in base
          units. Read-only: nothing is posted, charged or released from this screen.
        </p>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => refresh()}
          disabled={isLoading || !filters.branchId}
        >
          <RefreshCw className={isLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          <span>{isLoading ? "Reconciling" : "Refresh"}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={exportExcel}
          disabled={!hasData}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>Excel</span>
        </Button>

        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={exportPdf}
          disabled={!hasData}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>PDF</span>
        </Button>

        {report ? (
          <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            <Download className="h-3 w-3" />
            <span>{report.rows.length} lines</span>
          </span>
        ) : null}
      </div>
    </motion.section>
  );
}
