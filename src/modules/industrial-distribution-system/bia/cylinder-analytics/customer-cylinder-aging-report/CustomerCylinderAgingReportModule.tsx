// CustomerCylinderAgingReportModule.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Root layout module for Customer Cylinder Aging Report under BIA Cylinder Analytics.
// Assembles Header, Searchable Filter Bar, KPI Metrics, Recharts Graphics, Table, and Drawer.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { CustomerCylinderAgingProvider } from "./providers/CustomerCylinderAgingProvider";
import { CustomerCylinderAgingHeader } from "./components/CustomerCylinderAgingHeader";
import { CustomerCylinderAgingFilters } from "./components/CustomerCylinderAgingFilters";
import { CustomerCylinderAgingKPICards } from "./components/CustomerCylinderAgingKPICards";
import { CustomerCylinderAgingCharts } from "./components/CustomerCylinderAgingCharts";
import { CustomerCylinderAgingTable } from "./components/CustomerCylinderAgingTable";
import { CustomerCylinderAgingDrawer } from "./components/CustomerCylinderAgingDrawer";

function CustomerCylinderAgingContent() {
  return (
    <div className="w-full min-w-0 space-y-5 animate-in fade-in duration-300">
      <CustomerCylinderAgingHeader />
      <CustomerCylinderAgingFilters />
      <CustomerCylinderAgingKPICards />
      <CustomerCylinderAgingCharts />
      <CustomerCylinderAgingTable />
      <CustomerCylinderAgingDrawer />
    </div>
  );
}

export function CustomerCylinderAgingReportModule() {
  return (
    <CustomerCylinderAgingProvider>
      <CustomerCylinderAgingContent />
    </CustomerCylinderAgingProvider>
  );
}

export default CustomerCylinderAgingReportModule;
