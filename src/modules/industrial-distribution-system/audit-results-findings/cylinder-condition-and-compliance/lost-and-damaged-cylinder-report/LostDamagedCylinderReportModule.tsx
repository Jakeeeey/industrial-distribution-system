// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/LostDamagedCylinderReportModule.tsx
// ==============================================================================
// Root Component for Lost and Damaged Cylinder Report
// Connects header, filters, KPI cards, visual charts, paginated table, drawer,
// and ARF TracingReportPreviewModal for physical document printing.
// ==============================================================================

"use client";

import * as React from "react";
import { LostDamagedCylinderProvider, useLostDamagedCylinder } from "./providers/LostDamagedCylinderProvider";
import { LostDamagedCylinderHeader } from "./components/LostDamagedCylinderHeader";
import { LostDamagedCylinderFilters } from "./components/LostDamagedCylinderFilters";
import { LostDamagedCylinderKPICards } from "./components/LostDamagedCylinderKPICards";
import { LostDamagedCylinderCharts } from "./components/LostDamagedCylinderCharts";
import { LostDamagedCylinderTable } from "./components/LostDamagedCylinderTable";
import { LostDamagedCylinderDrawer } from "./components/LostDamagedCylinderDrawer";
import { TracingReportPreviewModal } from "@/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/components/TracingReportPreviewModal";
import { generateLostDamagedPrintHtml } from "./utils/generateLostDamagedPrintHtml";

function LostDamagedCylinderContent() {
  const { report, filters, lookups } = useLostDamagedCylinder();
  const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false);

  const selectedBranchName = React.useMemo(() => {
    if (!filters.branchId || filters.branchId === "ALL") return "All Branches";
    const found = lookups?.branches.find((b) => String(b.id) === String(filters.branchId));
    return found ? found.branch_name : "Selected Branch";
  }, [filters.branchId, lookups]);

  const printHtml = React.useMemo(() => {
    if (!report) return "";
    return generateLostDamagedPrintHtml(report, filters, selectedBranchName);
  }, [report, filters, selectedBranchName]);

  return (
    <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-300">
      <LostDamagedCylinderHeader onOpenPrintPreview={() => setIsPrintModalOpen(true)} />
      <LostDamagedCylinderFilters />
      <LostDamagedCylinderKPICards />
      <LostDamagedCylinderCharts />
      <LostDamagedCylinderTable />
      <LostDamagedCylinderDrawer />

      {/* ARF Standard PDF / Print Preview Modal */}
      <TracingReportPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        html={printHtml}
        title="Lost and Damaged Cylinder Report"
        subtitle={selectedBranchName}
      />
    </div>
  );
}

export function LostDamagedCylinderReportModule() {
  return (
    <LostDamagedCylinderProvider>
      <LostDamagedCylinderContent />
    </LostDamagedCylinderProvider>
  );
}

export default LostDamagedCylinderReportModule;
