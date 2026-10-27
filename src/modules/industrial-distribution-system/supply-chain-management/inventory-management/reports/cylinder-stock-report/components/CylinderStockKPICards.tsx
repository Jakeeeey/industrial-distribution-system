// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/components/CylinderStockKPICards.tsx
// ==============================================================================
// Cylinder Stock KPI Cards
// Renders primary executive numbers: Available, Full, Empty, Quarantine, In-Transit.
// Explicitly overrides Card default py-6 to eliminate vertical empty space.
// ==============================================================================

"use client";

import React from "react";
import { useCylinderStockReport } from "../providers/CylinderStockReportProvider";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Flame, Layers, AlertTriangle, Truck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function CylinderStockKPICards() {
  const { kpis, isLoading } = useCylinderStockReport();

  if (isLoading && !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-muted/40 animate-pulse rounded-lg border border-border/50" />
        ))}
      </div>
    );
  }

  const items = [
    {
      title: "Usable Available",
      value: kpis?.usableAvailable ?? 0,
      description: "In warehouse & ready",
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50/60 dark:bg-emerald-950/30",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    {
      title: "Full Cylinders",
      value: kpis?.fullStock ?? 0,
      description: "Filled gas stock",
      icon: Flame,
      color: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-50/60 dark:bg-cyan-950/30",
      border: "border-cyan-200 dark:border-cyan-800",
    },
    {
      title: "Empty Cylinders",
      value: kpis?.emptyStock ?? 0,
      description: "Awaiting refilling",
      icon: Layers,
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-50/60 dark:bg-slate-950/30",
      border: "border-slate-200 dark:border-slate-800",
    },
    {
      title: "Quarantined / Defect",
      value: kpis?.quarantinedDefective ?? 0,
      description: "Repair, scrap, damage",
      icon: AlertTriangle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50/60 dark:bg-rose-950/30",
      border: "border-rose-200 dark:border-rose-800",
    },
    {
      title: "Loaded / Reserved",
      value: (kpis?.loadedStock ?? 0) + (kpis?.reservedStock ?? 0),
      description: "Staged or dispatched",
      icon: Truck,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50/60 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-800",
    },
    {
      title: "Customer Custody",
      value: kpis?.withCustomer ?? 0,
      description: "External customer assets",
      icon: Users,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50/60 dark:bg-indigo-950/30",
      border: "border-indigo-200 dark:border-indigo-800",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-3">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          // AG-COMMENT: py-2 px-0 gap-0 explicitly removes Card default py-6 padding
          <Card
            key={idx}
            className={cn(
              "shadow-none border rounded-lg py-2 px-0 gap-0",
              item.border,
              item.bg
            )}
          >
            <CardContent className="p-0 px-3.5 py-0.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                  {item.title}
                </span>
                <Icon className={`w-3.5 h-3.5 ${item.color} shrink-0`} />
              </div>

              <div className="mt-1">
                <div className={`text-xl font-bold tracking-tight leading-none ${item.color}`}>
                  {item.value.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">
                  {item.description}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
