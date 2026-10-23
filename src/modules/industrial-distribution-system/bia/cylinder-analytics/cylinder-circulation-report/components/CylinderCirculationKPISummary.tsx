// components/CylinderCirculationKPISummary.tsx
// ──────────────────────────────────────────────────────────────────────────────
// KPI Summary Cards for Cylinder Circulation Report.
// Enhanced with rich semantic colors, gradient accents, and interactive hover effects.
// Optimized for compact vertical height without dead space.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCylinderCirculationReport } from "../providers/CylinderCirculationReportProvider";
import {
  ShieldCheck,
  AlertOctagon,
  Timer,
  Truck,
  Users,
  Layers,
} from "lucide-react";

export function CylinderCirculationKPISummary() {
  const { reportData, loading } = useCylinderCirculationReport();
  const kpis = reportData?.kpis;

  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border shadow-2xs py-0 gap-0">
            <CardContent className="p-3 sm:py-2.5 sm:px-3 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-14" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Total Tracked",
      value: kpis.totalTrackedCylinders.toLocaleString(),
      subtext: "In scope / active serials",
      icon: Layers,
      iconColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
      cardBorder: "border-blue-200/80 dark:border-blue-900/60",
      cardBg: "bg-blue-50/20 dark:bg-blue-950/15",
      hoverEffect: "hover:border-blue-500/60 hover:shadow-blue-500/10 hover:shadow-md",
    },
    {
      title: "Healthy Cycle",
      value: kpis.healthyCylinders.toLocaleString(),
      subtext: `${
        kpis.totalTrackedCylinders > 0
          ? Math.round(
              (kpis.healthyCylinders / kpis.totalTrackedCylinders) * 100
            )
          : 0
      }% normal flow`,
      icon: ShieldCheck,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
      cardBorder: "border-emerald-200/80 dark:border-emerald-900/60",
      cardBg: "bg-emerald-50/20 dark:bg-emerald-950/15",
      hoverEffect: "hover:border-emerald-500/60 hover:shadow-emerald-500/10 hover:shadow-md",
    },
    {
      title: "Flagged Breaks",
      value: kpis.circulationBreaksCount.toLocaleString(),
      subtext: `${kpis.breakPercentage}% requires review`,
      icon: AlertOctagon,
      iconColor: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-500/15 dark:bg-rose-500/25",
      cardBorder: "border-rose-300 dark:border-rose-800/80",
      cardBg: "bg-rose-50/40 dark:bg-rose-950/25",
      hoverEffect: "hover:border-rose-500 hover:shadow-rose-500/15 hover:shadow-md",
      alert: kpis.circulationBreaksCount > 0,
    },
    {
      title: "Avg Turnaround",
      value: `${kpis.avgTurnaroundDays} d`,
      subtext: "Outbound to Return cycle",
      icon: Timer,
      iconColor: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10 dark:bg-purple-500/20",
      cardBorder: "border-purple-200/80 dark:border-purple-900/60",
      cardBg: "bg-purple-50/20 dark:bg-purple-950/15",
      hoverEffect: "hover:border-purple-500/60 hover:shadow-purple-500/10 hover:shadow-md",
    },
    {
      title: "With Customers",
      value: kpis.withCustomerCount.toLocaleString(),
      subtext: "Active custody",
      icon: Users,
      iconColor: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
      cardBorder: "border-amber-200/80 dark:border-amber-900/60",
      cardBg: "bg-amber-50/20 dark:bg-amber-950/15",
      hoverEffect: "hover:border-amber-500/60 hover:shadow-amber-500/10 hover:shadow-md",
    },
    {
      title: "In Transit",
      value: kpis.inTransitCount.toLocaleString(),
      subtext: "On vehicles / transfer",
      icon: Truck,
      iconColor: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-500/10 dark:bg-cyan-500/20",
      cardBorder: "border-cyan-200/80 dark:border-cyan-900/60",
      cardBg: "bg-cyan-50/20 dark:bg-cyan-950/15",
      hoverEffect: "hover:border-cyan-500/60 hover:shadow-cyan-500/10 hover:shadow-md",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpiCards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card
            key={idx}
            className={`border shadow-2xs transition-all duration-200 hover:-translate-y-0.5 cursor-pointer py-0 gap-0 ${card.cardBorder} ${card.cardBg} ${card.hoverEffect}`}
          >
            <CardContent className="p-3 sm:py-2.5 sm:px-3.5 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground truncate">
                  {card.title}
                </span>
                <div className={`p-1.5 rounded-lg ${card.bgColor} transition-transform duration-200 group-hover:scale-110`}>
                  <Icon className={`h-3.5 w-3.5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-0.5">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {card.value}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate font-medium">
                {card.subtext}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
