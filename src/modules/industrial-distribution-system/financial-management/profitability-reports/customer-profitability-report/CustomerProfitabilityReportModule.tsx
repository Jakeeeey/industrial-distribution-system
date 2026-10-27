// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/CustomerProfitabilityReportModule.tsx
// ==============================================================================
// Customer Profitability Report - Root Layout Module
// Assembles Header, Filters, KPI Cards, Recharts Visuals, Table, and Drilldown Sheet.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import { CustomerProfitabilityProvider } from "./providers/CustomerProfitabilityProvider";
import { CustomerProfitabilityHeader } from "./components/CustomerProfitabilityHeader";
import { CustomerProfitabilityFilters } from "./components/CustomerProfitabilityFilters";
import { CustomerProfitabilityKPICards } from "./components/CustomerProfitabilityKPICards";
import { CustomerProfitabilityCharts } from "./components/CustomerProfitabilityCharts";
import { CustomerProfitabilityTable } from "./components/CustomerProfitabilityTable";
import { CustomerProfitabilityDrawer } from "./components/CustomerProfitabilityDrawer";

function CustomerProfitabilityContent() {
  return (
    <div className="w-full min-w-0 space-y-5 animate-in fade-in duration-300">
      <CustomerProfitabilityHeader />
      <CustomerProfitabilityFilters />
      <CustomerProfitabilityKPICards />
      <CustomerProfitabilityCharts />
      <CustomerProfitabilityTable />
      <CustomerProfitabilityDrawer />
    </div>
  );
}

export function CustomerProfitabilityReportModule() {
  return (
    <CustomerProfitabilityProvider>
      <CustomerProfitabilityContent />
    </CustomerProfitabilityProvider>
  );
}

export default CustomerProfitabilityReportModule;
