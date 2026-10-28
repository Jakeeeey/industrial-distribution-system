// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/CylinderStockReportModule.tsx
// ==============================================================================
// Cylinder Stock Report - Root Module Orchestrator
// Renders the complete view: Header, KPIs, Filter Toolbar, Table, Pagination & Drawer.
// ==============================================================================

"use client";

import React from "react";
import { CylinderStockReportProvider, useCylinderStockReport } from "./providers/CylinderStockReportProvider";
import { CylinderStockHeader } from "./components/CylinderStockHeader";
import { CylinderStockKPICards } from "./components/CylinderStockKPICards";
import { CylinderStockFilters } from "./components/CylinderStockFilters";
import { CylinderStockTable } from "./components/CylinderStockTable";
import { CylinderStockPagination } from "./components/CylinderStockPagination";
import { CylinderStockDrawer } from "./components/CylinderStockDrawer";
import ErrorPage from "@/components/shared/ErrorPage";

function CylinderStockReportContent() {
  const { error, refreshData } = useCylinderStockReport();

  if (error) {
    return (
      <ErrorPage
        code="Error 500"
        title="Failed to Load Cylinder Stock Report"
        message={error}
        reset={refreshData}
      />
    );
  }

  return (
    <div className="flex flex-col h-full w-full space-y-2">
      <CylinderStockHeader />
      <CylinderStockKPICards />
      <CylinderStockFilters />
      <CylinderStockTable />
      <CylinderStockPagination />
      <CylinderStockDrawer />
    </div>
  );
}

export default function CylinderStockReportModule() {
  return (
    <CylinderStockReportProvider>
      <CylinderStockReportContent />
    </CylinderStockReportProvider>
  );
}
