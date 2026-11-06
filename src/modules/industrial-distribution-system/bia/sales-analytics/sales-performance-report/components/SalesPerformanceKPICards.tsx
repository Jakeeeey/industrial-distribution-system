// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/components/SalesPerformanceKPICards.tsx
// ==============================================================================
// Sales Performance Report - Colorful KPI Metric Cards
// Displays Net Sales, Gas Volume (Kg), Invoices vs Returns, and Average Order Value.
// ==============================================================================

"use client";

import * as React from "react";
import {
  Banknote,
  Scale,
  FileCheck2,
  Receipt,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesPerformance } from "../providers/SalesPerformanceProvider";

export function SalesPerformanceKPICards() {
  const { report, isLoading } = useSalesPerformance();

  const formatCurrency = (val: number) =>
    `₱${val.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (isLoading || !report) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border shadow-xs">
            <CardContent className="p-5">
              <Skeleton className="h-4 w-28 mb-3" />
              <Skeleton className="h-8 w-36 mb-2" />
              <Skeleton className="h-3 w-44" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { kpis } = report;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Net Sales Card (Emerald/Green Gradient) */}
      <Card className="relative overflow-hidden border shadow-xs transition-all hover:shadow-md bg-card">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Net Sales
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(kpis.totalNetSales)}
            </h3>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
            <span>Gross: {formatCurrency(kpis.totalGrossSales)}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Gas Sold Volume (Sky/Cyan Gradient) */}
      <Card className="relative overflow-hidden border shadow-xs transition-all hover:shadow-md bg-card">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-cyan-400" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gas Volume Sold
            </span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
              <Scale className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {kpis.totalKgSold.toLocaleString()}
            </h3>
            <span className="text-sm font-semibold text-muted-foreground">kg</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
            <span>Cylinders (serialized &gt; 0)</span>
            <span className="text-sky-600 dark:text-sky-400 font-medium">
              ₱{kpis.overallKgRate.toFixed(2)}/kg
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Invoices & Deducted Returns (Violet/Indigo Gradient) */}
      <Card className="relative overflow-hidden border shadow-xs transition-all hover:shadow-md bg-card">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Invoices & Returns
            </span>
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
              <FileCheck2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {kpis.totalInvoices}
            </h3>
            <span className="text-xs font-medium text-muted-foreground">invoices</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs border-t pt-2">
            <span className="text-muted-foreground">Deducted Credits:</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-0.5">
              <ArrowDownRight className="h-3 w-3" />
              -{formatCurrency(kpis.totalCredits)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Average Order Value & Tax Breakdown (Amber/Orange Gradient) */}
      <Card className="relative overflow-hidden border shadow-xs transition-all hover:shadow-md bg-card">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Avg Order Value
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(kpis.averageOrderValue)}
            </h3>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
            <span>VAT: {formatCurrency(kpis.vatSalesTotal)}</span>
            <span>Non-VAT: {formatCurrency(kpis.nonVatSalesTotal)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
