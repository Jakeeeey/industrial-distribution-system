// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/CylinderInspectionHydrotestDueReportModule.tsx
// ==============================================================================
// Root Component for Cylinder Inspection and Hydrotest Due Report
// Integrates Header, Filters, Executive KPI Cards, Analytics Charts, Results Table,
// Slide-over Inspection Sheet, and physical printable modal.
// ==============================================================================

"use client";

import * as React from "react";
import {
  CylinderInspectionHydrotestProvider,
  useCylinderInspection,
} from "./providers/CylinderInspectionHydrotestProvider";
import { CylinderInspectionHydrotestHeader } from "./components/CylinderInspectionHydrotestHeader";
import { CylinderInspectionHydrotestFilters } from "./components/CylinderInspectionHydrotestFilters";
import { CylinderInspectionHydrotestKPICards } from "./components/CylinderInspectionHydrotestKPICards";
import { CylinderInspectionHydrotestCharts } from "./components/CylinderInspectionHydrotestCharts";
import { CylinderInspectionHydrotestTable } from "./components/CylinderInspectionHydrotestTable";
import { CylinderInspectionHydrotestDrawer } from "./components/CylinderInspectionHydrotestDrawer";
import { TracingReportPreviewModal } from "@/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/components/TracingReportPreviewModal";
import { generateInspectionHydrotestPrintHtml } from "./utils/generateInspectionHydrotestPrintHtml";

function CylinderInspectionHydrotestContent() {
  const { report, filters, lookups } = useCylinderInspection();
  const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false);

  const selectedBranchName = React.useMemo(() => {
    if (!filters.branchId || filters.branchId === "ALL") return "All Authorized Branches";
    const found = lookups?.branches.find((b) => String(b.id) === String(filters.branchId));
    return found ? found.branch_name : "Selected Branch";
  }, [filters.branchId, lookups]);

  const printHtml = React.useMemo(() => {
    if (!report) return "";
    return generateInspectionHydrotestPrintHtml(report, filters, selectedBranchName);
  }, [report, filters, selectedBranchName]);

  return (
    <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-300">
      <CylinderInspectionHydrotestHeader onOpenPrintPreview={() => setIsPrintModalOpen(true)} />
      <CylinderInspectionHydrotestFilters />
      <CylinderInspectionHydrotestKPICards />
      <CylinderInspectionHydrotestCharts />
      <CylinderInspectionHydrotestTable />
      <CylinderInspectionHydrotestDrawer />

      {/* ARF Standard PDF / Print Preview Modal */}
      <TracingReportPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        html={printHtml}
        title="Cylinder Inspection & Hydrotest Due Report"
        subtitle={selectedBranchName}
      />
    </div>
  );
}

export function CylinderInspectionHydrotestDueReportModule() {
  return (
    <CylinderInspectionHydrotestProvider>
      <CylinderInspectionHydrotestContent />
    </CylinderInspectionHydrotestProvider>
  );
}

export default CylinderInspectionHydrotestDueReportModule;
