"use client";

// ============================================================
// IncentiveHeader.tsx
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

import { useCustomerIncentiveReport } from "../hooks/useCustomerIncentiveReport";
import {
  exportCustomerIncentivePdf,
  printCustomerIncentivePdf,
} from "../services/customer-incentive.pdf";
import { exportCustomerIncentiveWorkbook } from "../services/customer-incentive.xlsx";
import {
  eligibleSizeLabel,
  formatGeneratedAt,
  formatQty,
} from "../services/customer-incentive.helpers";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Export failed.";
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate text-xs font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function IncentiveHeader(): React.ReactElement {
  const { report, appliedFilters, refresh, isInitialLoading, isRefreshing } =
    useCustomerIncentiveReport();
  const isLoading = isInitialLoading || isRefreshing;
  // Four dead buttons read as a broken page; say what is missing instead.
  const exportTitle = report ? undefined : "Load a report first";

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
          <div className="min-w-0 space-y-2">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold leading-tight">
                Customer Incentive &amp; Rebate Report
              </h1>
            </div>

            {report && appliedFilters ? (
              <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-2.5">
               
                <MetaItem
                  label="Period"
                  value={`${appliedFilters.startDate} → ${appliedFilters.endDate}`}
                />
               
                <MetaItem
                  label="Eligible cylinder"
                  value={eligibleSizeLabel(appliedFilters)}
                />

                <MetaItem
                  label="Source rows"
                  value={formatQty(report.sourceRowCount)}
                />
                
                <MetaItem
                  label="Generated"
                  value={formatGeneratedAt(report.generatedAt)}
                />
              
              </dl>
            ):null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={isLoading || !appliedFilters}
              title={appliedFilters ? undefined : "Load a report first"}
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
                  () => exportCustomerIncentiveWorkbook(report!),
                  "Excel export downloaded."
                )
              }
              disabled={!report}
              title={exportTitle}
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
                  () => exportCustomerIncentivePdf(report!),
                  "PDF downloaded."
                )
              }
              disabled={!report}
              title={exportTitle}
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
                  () => printCustomerIncentivePdf(report!),
                  "Print view opened."
                )
              }
              disabled={!report}
              title={exportTitle}
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
