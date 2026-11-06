// CylinderCirculationReportModule.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Main layout container for Cylinder Circulation Report.
// Integrates Header, Searchable Filters, KPI Cards, Recharts, Results Table, and Trace Drawer.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { CylinderCirculationReportProvider } from "./providers/CylinderCirculationReportProvider";
import { CylinderCirculationHeader } from "./components/CylinderCirculationHeader";
import { CylinderCirculationFilters } from "./components/CylinderCirculationFilters";
import { CylinderCirculationKPISummary } from "./components/CylinderCirculationKPISummary";
import { CylinderCirculationCharts } from "./components/CylinderCirculationCharts";
import { CylinderCirculationTable } from "./components/CylinderCirculationTable";
import { CylinderCirculationDetailDrawer } from "./components/CylinderCirculationDetailDrawer";

function CylinderCirculationContent() {
  return (
    <div className="w-full min-w-0 space-y-5 animate-in fade-in duration-300">
      <CylinderCirculationHeader />
      <CylinderCirculationFilters />
      <CylinderCirculationKPISummary />
      <CylinderCirculationCharts />
      <CylinderCirculationTable />
      <CylinderCirculationDetailDrawer />
    </div>
  );
}

export default function CylinderCirculationReportModule() {
  return (
    <CylinderCirculationReportProvider>
      <CylinderCirculationContent />
    </CylinderCirculationReportProvider>
  );
}
