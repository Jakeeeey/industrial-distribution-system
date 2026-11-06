// BranchOperationalPerformanceReportModule.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Main layout container for the Branch Operational Performance Report module.
// Integrates Header, Filters, KPI Cards, Recharts, Results Table, and Drilldown.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { BranchOperationalPerformanceReportProvider } from "./providers/BranchOperationalPerformanceReportProvider";
import { BranchOperationalReportHeader } from "./components/BranchOperationalReportHeader";
import { BranchOperationalFilters } from "./components/BranchOperationalFilters";
import { BranchOperationalKPISummary } from "./components/BranchOperationalKPISummary";
import { BranchOperationalCharts } from "./components/BranchOperationalCharts";
import { BranchOperationalResultsTable } from "./components/BranchOperationalResultsTable";
import { IncidentDrillDownDialog } from "./components/IncidentDrillDownDialog";

function BranchOperationalContent() {
  return (
    <div className="w-full min-w-0 space-y-5 animate-in fade-in duration-300">
      <BranchOperationalReportHeader />
      <BranchOperationalFilters />
      <BranchOperationalKPISummary />
      <BranchOperationalCharts />
      <BranchOperationalResultsTable />
      <IncidentDrillDownDialog />
    </div>
  );
}

export default function BranchOperationalPerformanceReportModule() {
  return (
    <BranchOperationalPerformanceReportProvider>
      <BranchOperationalContent />
    </BranchOperationalPerformanceReportProvider>
  );
}
