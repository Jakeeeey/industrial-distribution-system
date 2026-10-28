// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/components/CylinderStockHeader.tsx
// ==============================================================================
// Cylinder Stock Header
// Standard IDS Header with Title, Cutoff timestamp indicator, and Export PDF action.
// Uses official system company header via PdfEngine.
// ==============================================================================

"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, Clock } from "lucide-react";
import { useCylinderStockReport } from "../providers/CylinderStockReportProvider";
import { generateCylinderStockPdf } from "../utils/generateCylinderStockPdf";

export function CylinderStockHeader() {
  const { reportingCutoff, refreshData, isLoading, rows, kpis, lookups, filters } =
    useCylinderStockReport();
  const [isExporting, setIsExporting] = useState(false);

  const activeBranchName = filters.branchId
    ? lookups.branches.find((b) => b.id === filters.branchId)?.branch_name || "Filtered Branch"
    : "All Branches";

  const handleExportPDF = async () => {
    if (rows.length === 0) return;
    setIsExporting(true);

    try {
      await generateCylinderStockPdf({
        rows,
        kpis,
        reportingCutoff,
        branchName: activeBranchName,
      });
    } catch (err) {
      console.error("Export PDF failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Cylinder Stock Report
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Live Inventory
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          Reporting Cutoff Snapshot:{" "}
          <span className="font-semibold text-foreground">{reportingCutoff || "Loading..."}</span>{" "}
          (Asia/Manila)
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshData}
          disabled={isLoading}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={isExporting || rows.length === 0}
          className="gap-1.5 text-xs bg-background hover:bg-muted"
        >
          <FileText className={`w-3.5 h-3.5 ${isExporting ? "animate-spin" : "text-rose-600"}`} />
          {isExporting ? "Generating PDF..." : "Export PDF"}
        </Button>
      </div>
    </div>
  );
}
