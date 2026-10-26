// components/CustomerCylinderTurnaroundHeader.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Header component for Customer Cylinder Turnaround Ratio (CTR) Module.
// Displays clean title without clutter, refresh button, export button, and workflow action.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  RotateCw,
  FileCheck2,
  Lock,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useCustomerCylinderTurnaround } from "../providers/CustomerCylinderTurnaroundProvider";
import { cn } from "@/lib/utils";

export function CustomerCylinderTurnaroundHeader() {
  const {
    status,
    isLoading,
    refreshReport,
    exportToCsv,
    setIsWorkflowModalOpen,
    setPendingTargetStatus,
  } = useCustomerCylinderTurnaround();

  const handleTriggerAction = (target: "FOR_REVIEW" | "APPROVED" | "LOCKED") => {
    setPendingTargetStatus(target);
    setIsWorkflowModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/80 bg-card px-5 py-4 shadow-sm">
      <div className="space-y-0.5">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Customer Cylinder Turnaround Ratio
        </h1>
        <p className="text-xs text-muted-foreground">
          Track customer cylinder circulation velocity, assign CTR performance grades, and compute 11 kg refill incentives with full auditability.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshReport()}
          disabled={isLoading}
          className="h-8.5 gap-1.5 text-xs font-medium"
        >
          <RotateCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          <span>Refresh</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={exportToCsv}
          className="h-8.5 gap-1.5 text-xs font-medium"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export CSV</span>
        </Button>

        {status === "DRAFT" && (
          <Button
            size="sm"
            onClick={() => handleTriggerAction("FOR_REVIEW")}
            className="h-8.5 gap-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white"
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>Submit for Review</span>
          </Button>
        )}

        {status === "FOR_REVIEW" && (
          <Button
            size="sm"
            onClick={() => handleTriggerAction("APPROVED")}
            className="h-8.5 gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Approve Assessment</span>
          </Button>
        )}

        {status === "APPROVED" && (
          <Button
            size="sm"
            variant="default"
            onClick={() => handleTriggerAction("LOCKED")}
            className="h-8.5 gap-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Lock Assessment</span>
          </Button>
        )}
      </div>
    </div>
  );
}
