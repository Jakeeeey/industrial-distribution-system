// components/CustomerCylinderAgingKPICards.tsx
// ──────────────────────────────────────────────────────────────────────────────
// KPI Summary Cards for Customer Cylinder Aging Report.
// Enhanced with semantic border colors, gradient accents, and interactive color hover effects.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Cylinder,
  AlertTriangle,
  Clock,
  Users,
  TrendingUp,
} from "lucide-react";
import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";

export function CustomerCylinderAgingKPICards() {
  const { reportData, isLoading } = useCustomerCylinderAging();

  const kpis = reportData?.kpis;

  const cardList = [
    {
      title: "Total Cylinders Held",
      value: isLoading ? "—" : (kpis?.totalUnitsHeld ?? 0).toLocaleString(),
      subtext: isLoading
        ? "Loading..."
        : `Across ${(kpis?.totalCustomersWithCylinders ?? 0).toLocaleString()} customer accounts`,
      icon: Cylinder,
      iconColor: "text-blue-500 dark:text-blue-400",
      iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
      cardBorder: "border-blue-500/20 dark:border-blue-900/50",
      hoverEffect: "hover:border-blue-500/60 hover:bg-blue-500/5 hover:shadow-md hover:shadow-blue-500/10",
      bgGradient: "from-blue-500/10 to-transparent",
    },
    {
      title: "Overdue Cylinders",
      value: isLoading ? "—" : (kpis?.overdueUnits ?? 0).toLocaleString(),
      subtext: isLoading
        ? "Loading..."
        : `Exceeding threshold (${reportData?.filters.agingThreshold ?? 30} days)`,
      icon: AlertTriangle,
      iconColor: "text-rose-500 dark:text-rose-400",
      iconBg: "bg-rose-500/10 dark:bg-rose-500/20",
      cardBorder: "border-rose-500/20 dark:border-rose-900/50",
      hoverEffect: "hover:border-rose-500/60 hover:bg-rose-500/5 hover:shadow-md hover:shadow-rose-500/10",
      bgGradient: "from-rose-500/10 to-transparent",
    },
    {
      title: "Overdue Rate",
      value: isLoading ? "—" : `${kpis?.overduePercentage ?? 0}%`,
      subtext: isLoading ? "Loading..." : "Proportion of total holding portfolio",
      icon: TrendingUp,
      iconColor: "text-amber-500 dark:text-amber-400",
      iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
      cardBorder: "border-amber-500/20 dark:border-amber-900/50",
      hoverEffect: "hover:border-amber-500/60 hover:bg-amber-500/5 hover:shadow-md hover:shadow-amber-500/10",
      bgGradient: "from-amber-500/10 to-transparent",
    },
    {
      title: "Average Customer Dwell",
      value: isLoading ? "—" : `${kpis?.averageDwellDays ?? 0} Days`,
      subtext: isLoading ? "Loading..." : "Mean elapsed time with customers",
      icon: Clock,
      iconColor: "text-emerald-500 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      cardBorder: "border-emerald-500/20 dark:border-emerald-900/50",
      hoverEffect: "hover:border-emerald-500/60 hover:bg-emerald-500/5 hover:shadow-md hover:shadow-emerald-500/10",
      bgGradient: "from-emerald-500/10 to-transparent",
    },
    {
      title: "Priority Collection Accounts",
      value: isLoading
        ? "—"
        : (kpis?.priorityCollectionAccountsCount ?? 0).toLocaleString(),
      subtext: isLoading
        ? "Loading..."
        : "Accounts with critical dwell > 60 days",
      icon: Users,
      iconColor: "text-purple-500 dark:text-purple-400",
      iconBg: "bg-purple-500/10 dark:bg-purple-500/20",
      cardBorder: "border-purple-500/20 dark:border-purple-900/50",
      hoverEffect: "hover:border-purple-500/60 hover:bg-purple-500/5 hover:shadow-md hover:shadow-purple-500/10",
      bgGradient: "from-purple-500/10 to-transparent",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {cardList.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card
            key={idx}
            className={`group relative overflow-hidden border shadow-2xs transition-all duration-200 cursor-default ${card.cardBorder} ${card.hoverEffect}`}
          >
            <div
              className={`absolute top-0 right-0 w-24 h-24 bg-linear-to-bl ${card.bgGradient} rounded-bl-full pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity`}
            />
            <CardContent className="p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground line-clamp-1">
                  {card.title}
                </span>
                <div
                  className={`p-1.5 rounded-md ${card.iconBg} transition-transform duration-200 group-hover:scale-110`}
                >
                  <Icon className={`h-3.5 w-3.5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground transition-colors">
                {card.value}
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {card.subtext}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
