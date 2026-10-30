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
import {
  formatGeneratedAt,
  formatQty,
} from "../services/customer-order-consumption.helpers";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Export failed."
}

export function CustomerOrderConsumptionHeader(): React.ReactElement {
  const { report, appliedFilters, refresh, isInitialLoading, isRefreshing } =
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
    <Card className="gap-3 border-border/80 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-lg font-semibold leading-tight">
              Customer Order &amp; Consumption Report
            </h1>
            <p className="text-xs text-muted-foreground">
              Buying frequency and gas demand per customer. Cylinder figures
              cover serialized products in industrial categories, priced as a
              purchase proxy; LPG figures are metered or weighed usage. The two
              are never combined.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Period:{" "}
                <span className="font-medium text-foreground">
                  {appliedFilters.startDate} → {appliedFilters.endDate}
                </span>
              </span>
              <span>
                Cutoff:{" "}
                <span className="font-medium text-foreground">
                  {report?.reportingCutoff ?? appliedFilters.endDate}
                </span>
              </span>
              {report ? (
                <span>
                  Source rows:{" "}
                  <span className="font-medium text-foreground">
                    {formatQty(report.sourceRowCount)}
                  </span>
                </span>
              ) : null}
              {report ? (
                <span>Generated: {formatGeneratedAt(report.generatedAt)}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" className="size-4" />
              )}
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                runExport(
                  () => exportCustomerOrderConsumptionWorkbook(report!),
                  "Excel export downloaded."
                )
              }
              disabled={!report}
              className="gap-2"
            >
              <FileDown aria-hidden="true" className="size-4" />
              Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                runExport(
                  () => exportCustomerOrderConsumptionPdf(report!),
                  "PDF downloaded."
                )
              }
              disabled={!report}
              className="gap-2"
            >
              <FileText aria-hidden="true" className="size-4" />
              PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                runExport(
                  () => printCustomerOrderConsumptionPdf(report!),
                  "Print view opened."
                )
              }
              disabled={!report}
              className="gap-2"
            >
              <Printer aria-hidden="true" className="size-4" />
              Print
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
