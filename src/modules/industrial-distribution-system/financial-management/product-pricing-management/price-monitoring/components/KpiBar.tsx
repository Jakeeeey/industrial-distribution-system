"use client";

// =============================================================================
// Price Monitoring — KpiBar Component
// Layer  : components (UI only — pure display)
// Spec   : §8.1 Year / Summary: Current Live Price | Highest | Lowest | Average
// =============================================================================

import * as React from "react";
import { TrendingUp, TrendingDown, BarChart3, Activity, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { OverallSummary } from "../types";
import { formatCurrency } from "../utils/matrixUtils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------


export interface KpiBarProps {
  overallSummary: OverallSummary;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Individual KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  subtitle?: string;
}

function KpiCard({ title, value, icon, accent, subtitle }: KpiCardProps) {
  return (
    <Card
      className={cn(
        "flex-1 min-w-[140px] border transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              accent,
            )}
          >
            {icon}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-bold tabular-nums">{value}</span>
          {subtitle && (
            <span className="text-xs text-muted-foreground mt-0.5">{subtitle}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KpiBar component
// ---------------------------------------------------------------------------

/**
 * Displays five summary KPI cards for the overall price monitoring:
 * - Current Price (live price overall, last updated date)
 * - Highest Price (overall, with year of occurrence)
 * - Lowest Price (overall, with year of occurrence)
 * - Average Price (overall)
 * - Price Changes (overall count of approved events)
 */
export function KpiBar({ overallSummary, loading }: KpiBarProps) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[140px]">
            <Skeleton className="h-[100px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const formatDate = (dt: string | null) => {
    if (!dt) return "Never";
    try {
      return new Date(dt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dt;
    }
  };

  const kpis: KpiCardProps[] = [
    {
      title: "Current Price",
      value: formatCurrency(overallSummary.currentPrice),
      icon: <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      accent: "bg-blue-50 dark:bg-blue-950",
      subtitle: `Last Updated: ${formatDate(overallSummary.lastUpdated)}`,
    },
    {
      title: "Highest Price",
      value: formatCurrency(overallSummary.highestPrice),
      icon: <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />,
      accent: "bg-red-50 dark:bg-red-950",
      subtitle: overallSummary.highestPriceYear ? `in ${overallSummary.highestPriceYear}` : "—",
    },
    {
      title: "Lowest Price",
      value: formatCurrency(overallSummary.lowestPrice),
      icon: <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      accent: "bg-emerald-50 dark:bg-emerald-950",
      subtitle: overallSummary.lowestPriceYear ? `in ${overallSummary.lowestPriceYear}` : "—",
    },
    {
      title: "Average Price",
      value: formatCurrency(overallSummary.averagePrice),
      icon: <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      accent: "bg-amber-50 dark:bg-amber-950",
      subtitle: "Across all pricing changes",
    },
    {
      title: "Price Changes",
      value: overallSummary.totalChanges.toLocaleString(),
      icon: <Hash className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
      accent: "bg-indigo-50 dark:bg-indigo-950",
      subtitle: "Approved changes overall",
    },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}
