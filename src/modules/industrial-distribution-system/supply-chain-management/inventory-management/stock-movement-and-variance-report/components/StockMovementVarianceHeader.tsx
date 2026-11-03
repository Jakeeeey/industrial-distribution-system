// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceHeader.tsx
// ==============================================================================
// Header & Action Bar for Stock Movement and Variance Report.
// Restates the scope and period the figures ON SCREEN were produced from — which
// is the applied parameter set, never the draft being edited — then exposes
// refresh and the two export channels (spec §11 export action).
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { FileSpreadsheet, FileText, RefreshCw, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";

/** Renders a YYYY-MM-DD value as a shorter, scannable date. */
function shortDate(value: string | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][
    Number(month) - 1
  ]} ${year}`;
}

export function StockMovementVarianceHeader() {
  const { report, appliedFilters, isLoading, refresh, exportExcel, exportPdf } =
    useStockMovementVarianceReport();

  const hasData = Boolean(report && report.rows.length > 0);

  const scopeLabel = report
    ? report.branchName ??
      `All branches (${report.branchesReconciled} reconciled)`
    : appliedFilters
      ? appliedFilters.branchId
        ? `Branch #${appliedFilters.branchId}`
        : "All branches"
      : "No report loaded";

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between"
    >
      {/* ── Identity & scope ───────────────────────────────────────────────── */}
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Scale className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight">
            Stock Movement and Variance Report
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{scopeLabel}</span>
            {" · "}
            {appliedFilters
              ? `${shortDate(appliedFilters.startDate)} → ${shortDate(appliedFilters.endDate)}`
              : "Press Apply to choose a period"}
            {" · "}
            Expected = opening + in − out · Variance = counted − expected · base units
          </p>
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => refresh()}
          disabled={isLoading || !report}
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
      </div>
    </motion.section>
  );
}
