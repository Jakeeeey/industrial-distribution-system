// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/components/DeliverPerformanceHeader.tsx
// ==============================================================================
// Delivery Performance Report - Header Component
// Displays title, subtitle, refresh button, export to CSV, and printable PDF actions.
// ==============================================================================

"use client";

import React from "react";
import { Download, Printer, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeliverPerformance } from "../providers/DeliverPerformanceProvider";

export function DeliverPerformanceHeader() {
  const { loading, refresh, handleExportCSV, handleExportPDF, handlePrintBrowser } =
    useDeliverPerformance();

  return (
    <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between border-b border-border">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Delivery Performance Report
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Measure delivery reliability, fulfillment ratios, and investigate transit exceptions.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="h-8 gap-1.5 text-xs shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={loading}
          className="h-8 gap-1.5 text-xs shadow-sm"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handlePrintBrowser}
          disabled={loading}
          className="h-8 gap-1.5 text-xs shadow-sm"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleExportPDF}
          disabled={loading}
          className="h-8 gap-1.5 text-xs shadow-sm"
        >
          <Download className="h-3.5 w-3.5" />
          Export PDF
        </Button>
      </div>
    </div>
  );
}

