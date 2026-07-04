// src/modules/industrial-distribution-system/dashboard/components/widgets/RtoOverviewWidget.tsx

"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { formatCurrency, formatPercent } from "../../utils/kpiCalculations";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetLayout } from "../../types";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  PackageCheck,
  AlertOctagon,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";

export const RtoOverviewWidget: React.FC<{ layout?: WidgetLayout }> = ({ layout }) => {
  const { rtoData, loading, filters } = useDashboard();
  
  const w = layout?.w ?? 12;
  const h = layout?.h ?? 4;
  const cols = w >= 10 ? 5 : (w >= 6 ? 3 : (w >= 3 ? 2 : 1));
  const isWidgetShort = h <= 3;
  const rows = Math.ceil(5 / cols);

  const metrics = useMemo(() => {
    const branchIdStr = String(filters.branchId);
    const records = branchIdStr === "all" 
      ? rtoData 
      : rtoData.filter((r) => String(r.branchId) === branchIdStr);

    let delivered = 0;
    let returned = 0;
    let missing = 0;
    let exposure = 0;
    let balance = 0;

    records.forEach((r) => {
      delivered += Number(r.fullsDelivered || 0);
      returned += Number(r.emptiesReturned || 0);
      missing += Number(r.missingTanks || 0);
      exposure += Number(r.financialExposure || 0);
      balance += Number(r.unpaidBalance || 0);
    });

    const recoveryRate = delivered > 0 ? (returned / delivered) * 100 : 0;

    return {
      delivered,
      returned,
      missing,
      exposure,
      balance,
      recoveryRate,
      activeCount: records.length,
    };
  }, [rtoData, filters.branchId]);

  if (loading) {
    return (
      <div 
        className="grid gap-2 flex-1 items-center min-h-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2 border border-border/40 rounded-xl p-3 bg-muted/5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  const items = [
    {
      label: "Delivered Fulls",
      value: metrics.delivered.toLocaleString(),
      icon: PackageCheck,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      desc: "All cylinder shipments",
    },
    {
      label: "Returned Empties",
      value: metrics.returned.toLocaleString(),
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      desc: "Cylinders returned empty",
    },
    {
      label: "Dealer Outstanding",
      value: metrics.missing.toLocaleString(),
      icon: AlertOctagon,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      desc: "Currently held by dealers",
    },
    {
      label: "Cylinder Recovery Rate",
      value: formatPercent(metrics.recoveryRate),
      icon: ArrowUpRight,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
      desc: "Returned / Delivered ratio",
    },
    {
      label: "Financial Exposure",
      value: formatCurrency(metrics.exposure),
      icon: ShieldAlert,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      desc: "Unpaid invoices + outstanding cost",
    },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full justify-between">
      {/* Dynamic Columns Grid */}
      <div 
        className="grid gap-1.5 flex-1 min-h-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item, idx) => {
          const Icon = item.icon;
          const isWidgetNarrow = w < 6;
          return (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-2 border border-border/40 hover:border-border/80 transition-all rounded-lg bg-muted/5 relative overflow-hidden h-full",
                isWidgetShort ? "p-1.5" : "p-2"
              )}
            >
              <div className={`p-1.5 rounded-md ${item.bg} shrink-0`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground block truncate leading-tight">
                  {item.label}
                </span>
                <span className={cn("font-black text-foreground block mt-0.5 leading-none", isWidgetNarrow ? "text-xs" : "text-sm")}>
                  {item.value}
                </span>
                {!isWidgetShort && (
                  <span className="text-[8px] font-medium text-slate-400 block mt-0.5 truncate leading-none">
                    {item.desc}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
