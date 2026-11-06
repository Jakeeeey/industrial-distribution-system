// components/CustomerCylinderAgingHeader.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Header component for Customer Cylinder Aging Report.
// 1. Redundant cutoff date badge removed.
// 2. CSV export removed.
// 3. Official Corporate PDF Export with company header, logo, and 100% data fidelity.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, FileText, ShieldCheck, Loader2 } from "lucide-react";
import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";
import { exportCustomerCylinderAgingPDF } from "../services/customer-cylinder-aging.pdf";

export function CustomerCylinderAgingHeader() {
  const { reportData, isLoading, refresh } = useCustomerCylinderAging();
  const [isExportingPdf, setIsExportingPdf] = React.useState<boolean>(false);

  const handleExportPdf = async () => {
    if (!reportData || !reportData.items.length) return;
    try {
      setIsExportingPdf(true);
      await exportCustomerCylinderAgingPDF(reportData);
    } catch (err) {
      console.error("Error generating Corporate PDF:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Customer Cylinder Aging Report
          </h1>
          <Badge
            variant="outline"
            className="hidden sm:inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs"
          >
            <ShieldCheck className="h-3 w-3" />
            Verified Source Records
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Track dwell time of outstanding customer cylinders, flag dwell thresholds, and prioritize logistics collection.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={isLoading || isExportingPdf}
          className="gap-1.5 h-8.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={handleExportPdf}
          disabled={!reportData || !reportData.items.length || isLoading || isExportingPdf}
          className="gap-1.5 h-8.5 shadow-2xs"
        >
          {isExportingPdf ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Generating PDF...</span>
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5" />
              <span>Export PDF</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
