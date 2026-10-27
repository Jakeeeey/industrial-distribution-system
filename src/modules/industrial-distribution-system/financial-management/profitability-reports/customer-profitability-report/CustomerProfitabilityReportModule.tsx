// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/CustomerProfitabilityReportModule.tsx
// ==============================================================================
// Customer Profitability Report - Root Layout Module
// Assembles Header, Filters, KPI Cards, Recharts Visuals, Table, and Drilldown Sheet,
// with an integrated initial full-module skeleton pulse loader.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import {
  CustomerProfitabilityProvider,
  useCustomerProfitability,
} from "./providers/CustomerProfitabilityProvider";
import { CustomerProfitabilityHeader } from "./components/CustomerProfitabilityHeader";
import { CustomerProfitabilityFilters } from "./components/CustomerProfitabilityFilters";
import { CustomerProfitabilityKPICards } from "./components/CustomerProfitabilityKPICards";
import { CustomerProfitabilityCharts } from "./components/CustomerProfitabilityCharts";
import { CustomerProfitabilityTable } from "./components/CustomerProfitabilityTable";
import { CustomerProfitabilityDrawer } from "./components/CustomerProfitabilityDrawer";

function CustomerProfitabilitySkeleton() {
  return (
    <div className="w-full min-w-0 space-y-5 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-6 w-64 bg-muted rounded-md" />
          <div className="h-4 w-96 bg-muted/60 rounded-md" />
          <div className="h-4 w-72 bg-muted/40 rounded-md mt-1" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-muted rounded-md" />
          <div className="h-8 w-28 bg-muted rounded-md" />
          <div className="h-8 w-28 bg-muted rounded-md" />
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="p-4 rounded-xl border border-border bg-card/40 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 h-9 bg-muted rounded-md" />
          <div className="md:col-span-4 h-9 bg-muted rounded-md" />
          <div className="md:col-span-3 h-9 bg-muted rounded-md" />
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <div className="h-7 w-20 bg-muted rounded-md" />
          <div className="h-7 w-20 bg-muted rounded-md" />
          <div className="h-7 w-16 bg-muted rounded-md" />
          <div className="h-7 w-16 bg-muted rounded-md" />
          <div className="h-7 w-28 bg-muted rounded-md" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between"
          >
            <div className="flex justify-between items-center">
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-5 w-5 bg-muted rounded-full" />
            </div>
            <div className="h-6 w-36 bg-muted rounded" />
            <div className="h-2.5 w-20 bg-muted/60 rounded" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 h-72 rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
          <div className="h-4 w-60 bg-muted rounded" />
          <div className="h-48 bg-muted/30 rounded-lg" />
        </div>
        <div className="lg:col-span-5 h-72 rounded-xl border border-border bg-card/40 p-4 flex flex-col justify-between">
          <div className="h-4 w-44 bg-muted rounded" />
          <div className="h-48 bg-muted/30 rounded-lg" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="border border-border rounded-xl bg-card/40 overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
        <div className="divide-y divide-border/60">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-3.5 flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="h-3.5 w-48 bg-muted rounded" />
                <div className="h-2.5 w-32 bg-muted/60 rounded" />
              </div>
              <div className="h-3.5 w-24 bg-muted rounded" />
              <div className="h-3.5 w-20 bg-muted rounded" />
              <div className="h-3.5 w-20 bg-muted rounded" />
              <div className="h-5 w-20 bg-muted/60 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomerProfitabilityContent() {
  const { data, isLoading } = useCustomerProfitability();

  if (isLoading && !data) {
    return <CustomerProfitabilitySkeleton />;
  }

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
