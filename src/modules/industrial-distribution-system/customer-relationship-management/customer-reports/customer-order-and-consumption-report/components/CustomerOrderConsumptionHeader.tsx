"use client";

// ============================================================
// CustomerOrderConsumptionHeader.tsx
// Report identity plus the export actions. Exports run off the already
// loaded envelope, so no extra server round-trip can disagree with the
// numbers on screen.
// ============================================================

import * as React from "react";
import {
  FileDown,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import {
  exportCustomerOrderConsumptionPdf,
  printCustomerOrderConsumptionPdf,
} from "../services/customer-order-consumption.pdf";
import { exportCustomerOrderConsumptionWorkbook } from "../services/customer-order-consumption.xlsx";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Export failed."
}

export function CustomerOrderConsumptionHeader(): React.ReactElement {
  const { report, refresh, isInitialLoading, isRefreshing } =
    useCustomerOrderConsumptionReport();
  const isLoading = isInitialLoading || isRefreshing;

  const runExport = React.useCallback(
    (action: () => void, success: string): void => {
      if (!report) {
        toast.error("Nothing to export yet — load the report first.");
        return;
      }
      try {
        action();
        toast.success(success);
      } catch (error) {
        // A silent failed download is worse than a slow one.
        toast.error(describeError(error));
      }
    },
    [report]
  );

  return (
    <Card className="relative gap-3 overflow-hidden border-border/80 py-4">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-primary/40 to-transparent"
      />
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Title and description only — the filter card's applied chips own the period,
              branch, product and channel the figures were built from. */}
          <div className="min-w-0 space-y-1">
            <h1 className="text-lg font-bold leading-tight tracking-tight">
              Customer Order &amp; Consumption Report
            </h1>
            <p className="text-xs text-muted-foreground">
              Buying frequency and gas demand per customer. Cylinder figures
              cover serialized products in industrial categories, priced as a
              purchase proxy; LPG figures are metered or weighed usage. The two
              are never combined.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void refresh()}
              disabled={isLoading}
              className="h-9 gap-1.5 text-xs font-semibold shadow-2xs"
            >
              {isLoading ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" className="size-3.5" />
              )}
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                runExport(
                  () => exportCustomerOrderConsumptionWorkbook(report!),
                  "Excel export downloaded."
                )
              }
              disabled={!report}
              className="h-9 gap-1.5 border-emerald-500/25 bg-emerald-500/10 text-xs font-semibold text-emerald-700 shadow-2xs hover:bg-emerald-500/20 hover:text-emerald-700 dark:text-emerald-400"
            >
              <FileDown aria-hidden="true" className="size-3.5" />
              Excel
            </Button>
            <Button
              type="button"
              onClick={() =>
                runExport(
                  () => exportCustomerOrderConsumptionPdf(report!),
                  "PDF downloaded."
                )
              }
              disabled={!report}
              className="h-9 gap-1.5 text-xs font-semibold shadow-2xs"
            >
              <FileText aria-hidden="true" className="size-3.5" />
              PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                runExport(
                  () => printCustomerOrderConsumptionPdf(report!),
                  "Print view opened."
                )
              }
              disabled={!report}
              className="h-9 gap-1.5 text-xs font-semibold shadow-2xs"
            >
              <Printer aria-hidden="true" className="size-3.5" />
              Print
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
