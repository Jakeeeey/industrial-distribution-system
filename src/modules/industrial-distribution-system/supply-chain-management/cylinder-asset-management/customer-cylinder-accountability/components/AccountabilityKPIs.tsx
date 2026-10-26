// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/components/AccountabilityKPIs.tsx
// ==============================================================================
// KPI Summary Cards for Customer Cylinder Accountability Report
// Visualizes opening base, deposits (+), swaps, pull-outs (-), closing balance, and exception counts.
//
// Complies with VoSync Design System standards:
// - Hardware-accelerated hover elevation
// - Loading shimmers for smooth initial render
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import {
  Cylinder,
  ArrowUpRight,
  Repeat,
  ArrowDownLeft,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { useCustomerCylinderAccountability } from "../hooks/useCustomerCylinderAccountability";

export function AccountabilityKPIs() {
  const { reportData, isLoading } = useCustomerCylinderAccountability();
  const kpis = reportData?.kpis;

  const cards = [
    {
      title: "Opening Deployed Base",
      value: kpis ? kpis.totalOpeningBase.toLocaleString() : "0",
      description: "Physical cylinders in customer custody at period start",
      icon: Cylinder,
      badge: "Baseline",
      color: "text-slate-600 dark:text-slate-400",
      border: "border-slate-500/20",
      bg: "bg-slate-500/10",
    },
    {
      title: "Period Deposits (+)",
      value: kpis ? `+${kpis.totalPeriodDeposits.toLocaleString()}` : "+0",
      description: "New cylinder issuances expanding custody base",
      icon: ArrowUpRight,
      badge: "Inbound Base",
      color: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Period Swaps Circulated",
      value: kpis ? kpis.totalPeriodSwaps.toLocaleString() : "0",
      description: "1-to-1 cylinder refill exchanges completed",
      icon: Repeat,
      badge: "Circulation",
      color: "text-primary",
      border: "border-primary/20",
      bg: "bg-primary/10",
    },
    {
      title: "Period Pull-Outs (-)",
      value: kpis ? `-${kpis.totalPeriodPullOuts.toLocaleString()}` : "-0",
      description: "Cylinders retrieved or returned from customer",
      icon: ArrowDownLeft,
      badge: "De-tagging",
      color: "text-rose-600 dark:text-rose-400",
      border: "border-rose-500/20",
      bg: "bg-rose-500/10",
    },
    {
      title: "Closing / Running Base (=)",
      value: kpis ? kpis.totalClosingBase.toLocaleString() : "0",
      description: "Accumulated physical custody balance as of cutoff",
      icon: Scale,
      badge: "Reconciled",
      color: "text-indigo-600 dark:text-indigo-400",
      border: "border-indigo-500/20",
      bg: "bg-indigo-500/10",
    },
    {
      title: "Data Exceptions",
      value: kpis ? kpis.totalExceptions.toLocaleString() : "0",
      description: "Unverified records or negative custody anomalies",
      icon: AlertTriangle,
      badge: kpis && kpis.totalExceptions > 0 ? "Requires Review" : "All Clear",
      color: kpis && kpis.totalExceptions > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
      border: kpis && kpis.totalExceptions > 0 ? "border-amber-500/20" : "border-emerald-500/20",
      bg: kpis && kpis.totalExceptions > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-28 rounded-xl border bg-card p-4 animate-pulse">
            <div className="h-3 w-20 rounded-sm bg-muted mb-3" />
            <div className="h-6 w-16 rounded-sm bg-muted mb-2" />
            <div className="h-2.5 w-full rounded-sm bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition hover:shadow-xs"
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="my-2">
              <div className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {card.value}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate pr-1" title={card.description}>
                {card.description}
              </span>
              <span className={`shrink-0 rounded-md border px-1.5 py-0.2 font-semibold text-[10px] ${card.border} ${card.bg} ${card.color}`}>
                {card.badge}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
