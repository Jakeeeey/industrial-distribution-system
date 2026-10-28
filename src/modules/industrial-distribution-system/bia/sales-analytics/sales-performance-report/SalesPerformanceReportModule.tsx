// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/SalesPerformanceReportModule.tsx
// ==============================================================================
// Root Component for Sales Performance Report Module
// Connects Header, Filters, KPI Cards, Visual Charts, Results Table, Slide-out Drawer,
// and ARF TracingReportPreviewModal for printable report review.
// ==============================================================================

"use client";

import * as React from "react";
import { SalesPerformanceProvider, useSalesPerformance } from "./providers/SalesPerformanceProvider";
import { SalesPerformanceHeader } from "./components/SalesPerformanceHeader";
import { SalesPerformanceFilters } from "./components/SalesPerformanceFilters";
import { SalesPerformanceKPICards } from "./components/SalesPerformanceKPICards";
import { SalesPerformanceCharts } from "./components/SalesPerformanceCharts";
import { SalesPerformanceTable } from "./components/SalesPerformanceTable";
import { SalesPerformanceDrawer } from "./components/SalesPerformanceDrawer";
import { TracingReportPreviewModal } from "@/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/components/TracingReportPreviewModal";
import { generateSalesPerformancePrintHtml } from "./utils/generateSalesPerformancePrintHtml";

function SalesPerformanceContent() {
  const { report, filters, lookups, isPrintModalOpen, setIsPrintModalOpen } = useSalesPerformance();

  const selectedBranchName = React.useMemo(() => {
    if (!filters.branchId || filters.branchId === "ALL") return "All Authorized Branches";
    const found = lookups?.branches.find((b) => String(b.value) === String(filters.branchId));
    return found ? found.label : "Selected Branch";
  }, [filters.branchId, lookups]);

  const printHtml = React.useMemo(() => {
    if (!report) return "";
    return generateSalesPerformancePrintHtml(report, filters, selectedBranchName);
  }, [report, filters, selectedBranchName]);

  return (
    <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-300">
      {/* 1. Header with Export and Print Triggers */}
      <SalesPerformanceHeader onOpenPrintPreview={() => setIsPrintModalOpen(true)} />

      {/* 2. Interactive Filter Bar with SearchableSelect */}
      <SalesPerformanceFilters />

      {/* 3. High-Contrast KPI Cards */}
      <SalesPerformanceKPICards />

      {/* 4. Colorful Visual Analytics Charts (Recharts) */}
      <SalesPerformanceCharts />

      {/* 5. Paginated Results Table */}
      <SalesPerformanceTable />

      {/* 6. Drill-down Slide-out Drawer */}
      <SalesPerformanceDrawer />

      {/* 7. Print / PDF Preview Modal */}
      <TracingReportPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        html={printHtml}
        title="Sales Performance Report"
        subtitle={selectedBranchName}
      />
    </div>
  );
}

export function SalesPerformanceReportModule() {
  return (
    <SalesPerformanceProvider>
      <SalesPerformanceContent />
    </SalesPerformanceProvider>
  );
}

export default SalesPerformanceReportModule;
