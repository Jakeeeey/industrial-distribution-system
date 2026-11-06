// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/components/CustomerProfitabilityHeader.tsx
// ==============================================================================
// Header Component with Module Title, Refresh, CSV Export, and Print Trigger
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import { useCustomerProfitability } from "../providers/CustomerProfitabilityProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  Printer,
  RotateCw,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";

export function CustomerProfitabilityHeader() {
  const {
    data,
    isLoading,
    refreshReport,
    handleExportCsv,
    handlePrintReport,
    branchId,
    branches,
  } = useCustomerProfitability();

  const selectedBranchName =
    branchId === "all"
      ? "Consolidated (All Branches)"
      : branches.find((b) => b.id === branchId)?.branch_name || "Authorized Branch";

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
      {/* Title & Metadata */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Customer Profitability Report
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Identify accounts whose sales cover their fully absorbed operating costs.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-muted-foreground">
          <Badge variant="outline" className="flex items-center gap-1 font-normal">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>Verified Post Statuses Only</span>
          </Badge>
          <span className="text-border">•</span>
          <span>Scope: <strong className="text-foreground">{selectedBranchName}</strong></span>
          <span className="text-border">•</span>
          <span>
            Cutoff:{" "}
            <strong className="text-foreground">
              {data?.reportingPeriod?.startDate} to {data?.reportingPeriod?.endDate}
            </strong>
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 self-start md:self-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshReport}
          disabled={isLoading}
          className="h-8 gap-1.5 text-xs"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={isLoading || !data?.rows?.length}
          className="h-8 gap-1.5 text-xs"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Export CSV</span>
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handlePrintReport}
          disabled={isLoading || !data?.rows?.length}
          className="h-8 gap-1.5 text-xs"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print Report</span>
        </Button>
      </div>
    </div>
  );
}
