// CustomerCylinderTurnaroundRatioModule.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Root layout module for Customer Cylinder Turnaround Ratio under BIA Cylinder Analytics.
// Assembles Header, Searchable Filters, KPI Cards, Recharts Analytics, Table, Drawer, and Modal.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { CustomerCylinderTurnaroundProvider } from "./providers/CustomerCylinderTurnaroundProvider";
import { CustomerCylinderTurnaroundHeader } from "./components/CustomerCylinderTurnaroundHeader";
import { CustomerCylinderTurnaroundFilters } from "./components/CustomerCylinderTurnaroundFilters";
import { CustomerCylinderTurnaroundKPICards } from "./components/CustomerCylinderTurnaroundKPICards";
import { CustomerCylinderTurnaroundCharts } from "./components/CustomerCylinderTurnaroundCharts";
import { CustomerCylinderTurnaroundTable } from "./components/CustomerCylinderTurnaroundTable";
import { CustomerCylinderTurnaroundDrawer } from "./components/CustomerCylinderTurnaroundDrawer";
import { CustomerCylinderTurnaroundWorkflowModal } from "./components/CustomerCylinderTurnaroundWorkflowModal";

function CustomerCylinderTurnaroundContent() {
  return (
    <div className="w-full min-w-0 space-y-5 animate-in fade-in duration-300">
      <CustomerCylinderTurnaroundHeader />
      <CustomerCylinderTurnaroundFilters />
      <CustomerCylinderTurnaroundKPICards />
      <CustomerCylinderTurnaroundCharts />
      <CustomerCylinderTurnaroundTable />
      <CustomerCylinderTurnaroundDrawer />
      <CustomerCylinderTurnaroundWorkflowModal />
    </div>
  );
}

export function CustomerCylinderTurnaroundRatioModule() {
  return (
    <CustomerCylinderTurnaroundProvider>
      <CustomerCylinderTurnaroundContent />
    </CustomerCylinderTurnaroundProvider>
  );
}

export default CustomerCylinderTurnaroundRatioModule;
