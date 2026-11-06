// components/CustomerCylinderTurnaroundHeader.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Header component for Customer Cylinder Turnaround Ratio (CTR) Module.
// Displays clean title, refresh button, and export CSV button.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Download, RotateCw, Sparkles } from "lucide-react";
import { useCustomerCylinderTurnaround } from "../providers/CustomerCylinderTurnaroundProvider";
import { cn } from "@/lib/utils";

export function CustomerCylinderTurnaroundHeader() {
  const { isLoading, refreshReport, exportToCsv } = useCustomerCylinderTurnaround();

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
      </div>
    </div>
  );
}
