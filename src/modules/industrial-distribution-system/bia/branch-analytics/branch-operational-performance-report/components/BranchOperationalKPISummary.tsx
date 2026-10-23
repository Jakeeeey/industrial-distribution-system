// components/BranchOperationalKPISummary.tsx
// ──────────────────────────────────────────────────────────────────────────────
// KPI Summary Cards with accurate inventory counts (Available + With Customer),
// compact padding, domain color accents, and interactive hover effects.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { AlertTriangle, Banknote, Cylinder, RotateCw, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranchOperationalPerformanceReport } from "../hooks/useBranchOperationalPerformanceReport";

export function BranchOperationalKPISummary() {
  const { report, isLoading } = useBranchOperationalPerformanceReport();

  if (isLoading && !report) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Card key={idx} className="p-3.5 shadow-xs">
            <Skeleton className="h-3.5 w-24 mb-1.5" />
            <Skeleton className="h-6 w-32 mb-1" />
            <Skeleton className="h-3 w-40" />
          </Card>
        ))}
      </div>
    );
  }

  const kpis = report?.kpis ?? {
    totalSalesAmount: 0,
    activeHoldingCylinders: 0,
    warehouseOnhandCylinders: 0,
    deliveredFulls: 0,
    returnedEmpties: 0,
    cylinderRecoveryRate: 0,
    totalTripExpenses: 0,
    activeIncidentsCount: 0,
  };

  const totalCylinders = kpis.warehouseOnhandCylinders + kpis.activeHoldingCylinders;

  const cards = [
    {
      title: "Branch Net Sales",
      value: `PHP ${kpis.totalSalesAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      description: "Approved posted invoices",
      icon: Banknote,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      borderAccent: "border-t-2 border-t-emerald-500",
      hoverStyle: "hover:border-emerald-500/50 hover:shadow-md hover:shadow-emerald-500/5",
    },
    {
      title: "Branch Cylinder Inventory",
      value: totalCylinders.toLocaleString(),
      description: `${kpis.warehouseOnhandCylinders.toLocaleString()} in Warehouse | ${kpis.activeHoldingCylinders.toLocaleString()} with Customers`,
      icon: Cylinder,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 dark:bg-blue-500/20",
      borderAccent: "border-t-2 border-t-blue-500",
      hoverStyle: "hover:border-blue-500/50 hover:shadow-md hover:shadow-blue-500/5",
    },
    {
      title: "Recovery Rate",
      value: `${kpis.cylinderRecoveryRate}%`,
      description: `${kpis.returnedEmpties.toLocaleString()} ret / ${kpis.deliveredFulls.toLocaleString()} del`,
      icon: RotateCw,
      color: kpis.cylinderRecoveryRate >= 80 ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400",
      bg: kpis.cylinderRecoveryRate >= 80 ? "bg-teal-500/10 dark:bg-teal-500/20" : "bg-amber-500/10 dark:bg-amber-500/20",
      borderAccent: kpis.cylinderRecoveryRate >= 80 ? "border-t-2 border-t-teal-500" : "border-t-2 border-t-amber-500",
      hoverStyle: "hover:border-teal-500/50 hover:shadow-md hover:shadow-teal-500/5",
    },
    {
      title: "Trip Operating Costs",
      value: `PHP ${kpis.totalTripExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      description: "Budgeted trip fuel & toll",
      icon: Truck,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      borderAccent: "border-t-2 border-t-indigo-500",
      hoverStyle: "hover:border-indigo-500/50 hover:shadow-md hover:shadow-indigo-500/5",
    },
    {
      title: "Active Exceptions",
      value: kpis.activeIncidentsCount.toLocaleString(),
      description: "Lost, damaged & variance items",
      icon: AlertTriangle,
      color: kpis.activeIncidentsCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
      bg: kpis.activeIncidentsCount > 0 ? "bg-rose-500/10 dark:bg-rose-500/20" : "bg-muted/40",
      borderAccent: "border-t-2 border-t-rose-500",
      hoverStyle: "hover:border-rose-500/50 hover:shadow-md hover:shadow-rose-500/5",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <Card
            key={i}
            className={`border shadow-xs bg-card transition-all duration-200 hover:-translate-y-0.5 cursor-default ${card.borderAccent} ${card.hoverStyle}`}
          >
            <CardContent className="px-3.5 py-3 flex items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground truncate">{card.title}</p>
                <h3 className="text-lg font-bold tracking-tight text-foreground truncate">{card.value}</h3>
                <p className="text-[11px] text-muted-foreground truncate" title={card.description}>{card.description}</p>
              </div>
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${card.bg}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
