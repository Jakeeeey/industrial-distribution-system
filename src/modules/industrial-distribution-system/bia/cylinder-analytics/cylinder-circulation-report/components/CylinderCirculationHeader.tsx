// components/CylinderCirculationHeader.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Header component for Cylinder Circulation Report module.
// Displays title, breadcrumb tags, refresh button, live status, and CSV export.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileSpreadsheet, RotateCcw } from "lucide-react";
import { useCylinderCirculationReport } from "../providers/CylinderCirculationReportProvider";

export function CylinderCirculationHeader() {
  const { reportData, loading, refresh, resetFilters, filters } =
    useCylinderCirculationReport();

  const handleExportCSV = () => {
    if (!reportData || reportData.cylinders.length === 0) return;

    const headers = [
      "Serial Number",
      "Gas Type",
      "Current Status",
      "Condition",
      "Current Branch",
      "Custodian Type",
      "Custodian Name",
      "Last Event Date",
      "Last Doc No",
      "Last Doc Type",
      "Circulation Status",
      "Break Description",
      "Days in Status",
      "Avg Cycle (Days)",
    ];

    const rows = reportData.cylinders.map((c) => [
      `"${c.serialNumber}"`,
      `"${c.productName}"`,
      `"${c.cylinderStatus}"`,
      `"${c.cylinderCondition}"`,
      `"${c.currentBranchName}"`,
      `"${c.currentCustodianType}"`,
      `"${c.currentCustodianName}"`,
      `"${c.lastEventTimestamp.split("T")[0]}"`,
      `"${c.lastEventDocNo}"`,
      `"${c.lastEventDocType}"`,
      `"${c.circulationStatus}"`,
      `"${c.breakDescription.replace(/"/g, '""')}"`,
      c.daysInCurrentStatus,
      c.averageCycleDays,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Cylinder_Circulation_Report_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters =
    Boolean(filters.branchId) ||
    Boolean(filters.productId) ||
    Boolean(filters.serialNumber) ||
    filters.circulationStatus !== "ALL";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Cylinder Circulation Report
          </h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
            Live Audit View
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Trace serialized cylinder movement lifecycles, detect circulation breaks, and inspect
          physical event chronologies.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset Filters
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={loading}
          className="h-9 gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleExportCSV}
          disabled={loading || !reportData || reportData.cylinders.length === 0}
          className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Export CSV</span>
        </Button>
      </div>
    </div>
  );
}
