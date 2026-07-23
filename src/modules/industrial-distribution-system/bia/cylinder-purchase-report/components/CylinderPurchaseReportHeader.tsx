"use client";

import {
  ChartNoAxesCombined,
  ChevronDown,
  Download,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCylinderPurchaseReport } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport";
import {
  exportConsolidatedPdf,
  exportDashboardPdf,
  printDashboardPdf,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.pdf";
import {
  exportConsolidatedWorkbook,
  exportDashboardWorkbook,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.xlsx";
import type { CylinderPurchaseDashboardResponse } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

export function CylinderPurchaseReportHeader(): React.ReactElement {
  const {
    report,
    refresh,
    isInitialLoading,
    isRefreshing,
    activeView,
    selectedCustomer,
  } = useCylinderPurchaseReport();
  const isRequestPending = isInitialLoading || isRefreshing;
  const exportsDisabled = report === null;

  function runExport(
    label: string,
    action: (loadedReport: CylinderPurchaseDashboardResponse) => void,
  ): void {
    if (!report) {
      toast.error("Generate the cylinder purchase report before exporting.");
      return;
    }

    try {
      action(report);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Unable to ${label}. ${detail}`);
    }
  }
  let generatedAt = "Not generated yet";
  if (report?.generatedAt) {
    const generatedDate = new Date(report.generatedAt);
    generatedAt = Number.isNaN(generatedDate.getTime())
      ? "Generation time unavailable"
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(generatedDate);
  }

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ChartNoAxesCombined aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black leading-tight">
            Cylinder Purchase Report
          </h1>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Business Intelligence &amp; Analytics · Cylinder Procurement
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generated {generatedAt}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={isRequestPending}
        >
          {isRequestPending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          {isInitialLoading
            ? "Loading report"
            : isRefreshing
              ? "Refreshing"
              : "Refresh"}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportsDisabled}
            >
              <Download aria-hidden="true" />
              Export
              <ChevronDown aria-hidden="true" className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {selectedCustomer ? "Selected customer detail" : "Active dashboard"}
            </DropdownMenuLabel>
            <DropdownMenuItem
              disabled={exportsDisabled}
              onSelect={() =>
                runExport("export the active dashboard as PDF", (loadedReport) =>
                  exportDashboardPdf(loadedReport, activeView, selectedCustomer),
                )
              }
            >
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={exportsDisabled}
              onSelect={() =>
                runExport("export the active dashboard as XLSX", (loadedReport) =>
                  exportDashboardWorkbook(
                    loadedReport,
                    activeView,
                    selectedCustomer,
                  ),
                )
              }
            >
              Export XLSX
            </DropdownMenuItem>
            <DropdownMenuLabel>Consolidated report</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={exportsDisabled}
              onSelect={() =>
                runExport("export the consolidated report as PDF", (loadedReport) =>
                  exportConsolidatedPdf(loadedReport),
                )
              }
            >
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={exportsDisabled}
              onSelect={() =>
                runExport("export the consolidated report as XLSX", (loadedReport) =>
                  exportConsolidatedWorkbook(loadedReport),
                )
              }
            >
              Export XLSX
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportsDisabled}
            >
              <Printer aria-hidden="true" />
              Print
              <ChevronDown aria-hidden="true" className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Print report</DropdownMenuLabel>
            <DropdownMenuItem
              disabled={exportsDisabled}
              onSelect={() =>
                runExport("open the active dashboard print view", (loadedReport) =>
                  printDashboardPdf(loadedReport, activeView, selectedCustomer),
                )
              }
            >
              {selectedCustomer ? "Selected customer detail" : "Active dashboard"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
