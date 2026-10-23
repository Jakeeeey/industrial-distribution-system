// components/BranchOperationalReportHeader.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Module header displaying title, subtitle, data freshness, and export triggers.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Download, FileSpreadsheet, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBranchOperationalPerformanceReport } from "../hooks/useBranchOperationalPerformanceReport";
import { exportToExcel, exportToPdf } from "../services/branch-operational-performance.export";

export function BranchOperationalReportHeader() {
  const { report, isLoading, refresh } = useBranchOperationalPerformanceReport();
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportExcel = async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      await exportToExcel(report);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      await exportToPdf(report);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Branch Operational Performance Report
          </h1>
          <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30">
            <ShieldCheck className="h-3.5 w-3.5" /> Verified Cutoff
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Consolidated operational audit of branch sales, cylinder recovery, trip costs, and exception tracking.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="h-9 gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              disabled={!report || isExporting}
              className="h-9 gap-1.5 bg-primary text-primary-foreground shadow-xs"
            >
              <Download className="h-4 w-4" />
              <span>Export Report</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => void handleExportExcel()} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export as Excel (.xlsx)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleExportPdf()} className="gap-2 cursor-pointer">
              <Download className="h-4 w-4 text-rose-600" />
              <span>Export as PDF (.pdf)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
