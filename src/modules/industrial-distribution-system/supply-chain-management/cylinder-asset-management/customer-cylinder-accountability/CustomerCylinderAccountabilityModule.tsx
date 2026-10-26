// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/CustomerCylinderAccountabilityModule.tsx
// ==============================================================================
// Root Orchestrator Module for Customer Cylinder Accountability Report
// Assembles Provider, Header, Filters, KPI Cards, Primary Table, and Drawer.
//
// Complies with VoSync Design System standards:
// - Full comments left behind for long-term maintainability
// - Hardware-accelerated entrance transitions
// ==============================================================================

"use client";

import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { CustomerCylinderAccountabilityProvider } from "./providers/CustomerCylinderAccountabilityProvider";
import { AccountabilityHeader } from "./components/AccountabilityHeader";
import { AccountabilityFilters } from "./components/AccountabilityFilters";
import { AccountabilityKPIs } from "./components/AccountabilityKPIs";
import { AccountabilityTable } from "./components/AccountabilityTable";
import { AccountabilityDrawer } from "./components/AccountabilityDrawer";
import { useCustomerCylinderAccountability } from "./hooks/useCustomerCylinderAccountability";

function CustomerCylinderAccountabilityContent() {
  const { error, refresh, isLoading } = useCustomerCylinderAccountability();

  return (
    <div className="w-full min-w-0 space-y-5 animate-in fade-in duration-300">
      {/* 1. Header & Actions */}
      <AccountabilityHeader />

      {/* 2. Filter Parameters Bar */}
      <AccountabilityFilters />

      {/* Error Banner with Retry Action */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isLoading}
            className="inline-flex items-center gap-1 font-semibold underline hover:opacity-80"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 3. KPI Metrics Summary Strip */}
      <AccountabilityKPIs />

      {/* 4. Tabular Balance Reconciliation Grid */}
      <AccountabilityTable />

      {/* 5. Supporting Records Drill-Down Drawer */}
      <AccountabilityDrawer />
    </div>
  );
}

export default function CustomerCylinderAccountabilityModule() {
  return (
    <CustomerCylinderAccountabilityProvider>
      <CustomerCylinderAccountabilityContent />
    </CustomerCylinderAccountabilityProvider>
  );
}
