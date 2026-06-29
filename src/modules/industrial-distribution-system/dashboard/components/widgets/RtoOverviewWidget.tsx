// src/modules/industrial-distribution-system/dashboard/components/widgets/RtoOverviewWidget.tsx

"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { formatCurrency, formatPercent } from "../../utils/kpiCalculations";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  PackageCheck,
  AlertOctagon,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";

export const RtoOverviewWidget: React.FC = () => {
  const { rtoData, loading, filters } = useDashboard();

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 h-full items-center">
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
    // 1-col on mobile → 2-col on sm → 5-col on lg
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 h-full content-center">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="flex items-center gap-3 border border-border/40 hover:border-border/80 transition-all rounded-xl p-3 bg-muted/5 relative overflow-hidden"
          >
            <div className={`p-2 rounded-lg ${item.bg} shrink-0`}>
              <Icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block truncate leading-tight">
                {item.label}
              </span>
              <span className="text-base font-black text-foreground block mt-0.5 leading-none">
                {item.value}
              </span>
              <span className="text-[8px] font-medium text-slate-400 block mt-0.5 truncate leading-none">
                {item.desc}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
