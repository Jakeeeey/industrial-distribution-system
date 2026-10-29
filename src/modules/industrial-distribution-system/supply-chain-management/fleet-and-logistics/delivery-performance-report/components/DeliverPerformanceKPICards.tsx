// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/components/DeliverPerformanceKPICards.tsx
// ==============================================================================
// Delivery Performance Report - KPI Cards
// Ultra-compact layout: eliminated excess top and bottom padding.
// ==============================================================================

"use client";

import React from "react";
import { Truck, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useDeliverPerformance } from "../providers/DeliverPerformanceProvider";

export function DeliverPerformanceKPICards() {
  const { report, loading } = useDeliverPerformance();
  const kpis = report?.kpis;

  const cards = [
    {
      title: "Total Deliveries",
      value: kpis?.totalDeliveries.toLocaleString() ?? "0",
      subtext: `${kpis?.totalQuantity.toLocaleString() ?? "0"} cylinders dispatched`,
      icon: Truck,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-200/60 dark:border-blue-900/40",
    },
    {
      title: "Fulfillment Rate",
      value: `${kpis?.fulfillmentRate ?? 0}%`,
      subtext: `${kpis?.fulfilledCount.toLocaleString() ?? "0"} successfully fulfilled`,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200/60 dark:border-emerald-900/40",
    },
    {
      title: "On-Time Delivery",
      value: `${kpis?.onTimeRate ?? 0}%`,
      subtext: "Arrival within ETA schedule",
      icon: Clock,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-200/60 dark:border-indigo-900/40",
    },
    {
      title: "Concerns & Returns",
      value: ((kpis?.fulfilledWithConcernsCount ?? 0) + (kpis?.fulfilledWithReturnsCount ?? 0)).toLocaleString(),
      subtext: `${kpis?.fulfilledWithConcernsCount ?? 0} concerns, ${kpis?.fulfilledWithReturnsCount ?? 0} returns`,
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200/60 dark:border-amber-900/40",
    },
    {
      title: "Not Fulfilled",
      value: kpis?.notFulfilledCount.toLocaleString() ?? "0",
      subtext: "Failed or cancelled trips",
      icon: XCircle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      border: "border-rose-200/60 dark:border-rose-900/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card
            key={idx}
            className={`shadow-xs border ${card.border} transition-all duration-200 hover:shadow-sm`}
          >
            <CardContent className="py-2 px-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground leading-none">
                  {card.title}
                </span>
                <div className={`p-1 rounded-md ${card.bg}`}>
                  <Icon className={`h-3 w-3 ${card.color}`} />
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-base sm:text-lg font-bold tracking-tight text-foreground leading-tight ${loading ? "opacity-50" : ""}`}>
                  {loading ? "..." : card.value}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground truncate leading-none">
                {card.subtext}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
