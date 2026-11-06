// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/components/SalesPerformanceHeader.tsx
// ==============================================================================
// Sales Performance Report - Header Component
// Shows title, period badge, live timestamp, refresh, Excel export, and print modal trigger.
// ==============================================================================

"use client";

import * as React from "react";
import {
  Download,
  Printer,
  RotateCw,
  TrendingUp,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSalesPerformance } from "../providers/SalesPerformanceProvider";

export function SalesPerformanceHeader({
  onOpenPrintPreview,
}: {
  onOpenPrintPreview: () => void;
}) {
  const { filters, report, isLoading, refreshData, exportExcel } = useSalesPerformance();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Sales Performance Report
            </h1>
            <Badge variant="secondary" className="gap-1 font-medium text-xs">
              <Sparkles className="h-3 w-3 text-emerald-500" />
              BIA Sales Analytics
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <span>Period: <strong>{filters.startDate}</strong> to <strong>{filters.endDate}</strong></span>
            {report?.metadata.cutoffTimestamp && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px]">
                • <Clock className="h-3 w-3" /> Cutoff: {report.metadata.cutoffTimestamp}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshData}
          disabled={isLoading}
          className="gap-1.5 text-xs h-9"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={exportExcel}
          disabled={isLoading || !report || report.records.length === 0}
          className="gap-1.5 text-xs h-9 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Excel</span>
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onOpenPrintPreview}
          disabled={isLoading || !report || report.records.length === 0}
          className="gap-1.5 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print / PDF</span>
        </Button>
      </div>
    </div>
  );
}
