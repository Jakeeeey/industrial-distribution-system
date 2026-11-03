// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/DeliverPerformanceReportModule.tsx
// ==============================================================================
// Delivery Performance Report - Module Entry Point
// Assembles Provider, Header, Filters, KPI Cards, Graphics & Charts, Table, Drawer.
// Optimized for full-width layout without excess outer padding.
// ==============================================================================

"use client";

import React from "react";
import { DeliverPerformanceProvider } from "./providers/DeliverPerformanceProvider";
import { DeliverPerformanceHeader } from "./components/DeliverPerformanceHeader";
import { DeliverPerformanceKPICards } from "./components/DeliverPerformanceKPICards";
import { DeliverPerformanceFilters } from "./components/DeliverPerformanceFilters";
import { DeliverPerformanceCharts } from "./components/DeliverPerformanceCharts";
import { DeliverPerformanceTable } from "./components/DeliverPerformanceTable";
import { DeliverPerformanceDrawer } from "./components/DeliverPerformanceDrawer";
import { DeliverPerformancePagination } from "./components/DeliverPerformancePagination";

function DeliverPerformanceContent() {
  return (
    <div className="flex flex-col gap-3.5 p-2 sm:p-3 w-full">
      <DeliverPerformanceHeader />
      <DeliverPerformanceKPICards />
      <DeliverPerformanceFilters />
      <DeliverPerformanceCharts />
      <div className="flex flex-col gap-2">
        <DeliverPerformanceTable />
        <DeliverPerformancePagination />
      </div>
      <DeliverPerformanceDrawer />
    </div>
  );
}

export default function DeliverPerformanceReportModule() {
  return (
    <DeliverPerformanceProvider>
      <DeliverPerformanceContent />
    </DeliverPerformanceProvider>
  );
}
