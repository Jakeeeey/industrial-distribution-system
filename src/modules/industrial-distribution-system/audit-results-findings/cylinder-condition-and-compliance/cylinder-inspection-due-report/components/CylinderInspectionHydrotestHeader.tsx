// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/components/CylinderInspectionHydrotestHeader.tsx
// ==============================================================================
// Header Component for Cylinder Inspection and Hydrotest Due Report
// Provides breadcrumb context, live cutoff timestamp, refresh, and printable preview trigger.
// ==============================================================================

"use client";

import * as React from "react";
import { useCylinderInspection } from "../providers/CylinderInspectionHydrotestProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Printer, ShieldAlert } from "lucide-react";

interface HeaderProps {
  onOpenPrintPreview: () => void;
}

export function CylinderInspectionHydrotestHeader({ onOpenPrintPreview }: HeaderProps) {
  const { report, isLoading, refresh } = useCylinderInspection();

  const reportingCutoff = report?.reportingCutoff;
  const formattedCutoff = React.useMemo(() => {
    if (!reportingCutoff) return "—";
    try {
      const d = new Date(reportingCutoff);
      return new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch {
      return reportingCutoff;
    }
  }, [reportingCutoff]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
      <div>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Cylinder Inspection & Hydrotest Due Report
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Audit cylinders due for hydrostatic re-test, inspection warnings, failed conditions, and certification lapses.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="px-2.5 py-1 text-xs font-medium border-border/80">
          <span className="text-muted-foreground mr-1">Cutoff:</span>
          <span className="font-semibold text-foreground">{formattedCutoff}</span>
        </Badge>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={isLoading}
          className="h-9 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onOpenPrintPreview}
          disabled={isLoading || !report || report.rows.length === 0}
          className="h-9 gap-1.5 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print / Export PDF</span>
        </Button>
      </div>
    </div>
  );
}
