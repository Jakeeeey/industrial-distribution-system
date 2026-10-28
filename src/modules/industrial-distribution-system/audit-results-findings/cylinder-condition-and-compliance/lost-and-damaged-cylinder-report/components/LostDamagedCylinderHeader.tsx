// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/components/LostDamagedCylinderHeader.tsx
// ==============================================================================
// Header Component for Lost and Damaged Cylinder Report
// Displays clean module title and action buttons (Refresh, Print, Export Excel).
// ==============================================================================

"use client";

import * as React from "react";
import { useLostDamagedCylinder } from "../providers/LostDamagedCylinderProvider";
import { Button } from "@/components/ui/button";
import { RefreshCw, Printer, Download, AlertTriangle } from "lucide-react";

interface LostDamagedCylinderHeaderProps {
  onOpenPrintPreview?: () => void;
}

export function LostDamagedCylinderHeader({ onOpenPrintPreview }: LostDamagedCylinderHeaderProps) {
  const { report, isLoading, refetch, exportExcel, triggerPrint } = useLostDamagedCylinder();

  const handlePrint = () => {
    if (onOpenPrintPreview) {
      onOpenPrintPreview();
    } else {
      triggerPrint();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Lost and Damaged Cylinder Report
        </h1>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="h-9 gap-1.5 text-xs shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          disabled={isLoading || !report?.rows.length}
          className="h-9 gap-1.5 text-xs shadow-sm"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print</span>
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={exportExcel}
          disabled={isLoading || !report?.rows.length}
          className="h-9 gap-1.5 text-xs shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Excel</span>
        </Button>
      </div>
    </div>
  );
}
