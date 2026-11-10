"use client";

// =============================================================================
// Price Monitoring — KpiBar Component
// Layer  : components (UI only — pure display)
// Spec   : §8.1 Year / Summary: Current Live Price | Highest | Lowest | Average
// =============================================================================

import * as React from "react";
import { TrendingUp, TrendingDown, BarChart3, Hash } from "lucide-react";
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
        "flex-1 min-w-0 border transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      <CardContent className="p-3 sm:p-4 flex flex-col gap-1.5 sm:gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">
            {title}
          </span>
          <div
            className={cn(
              "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg shrink-0",
              accent,
            )}
          >
            {icon}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-base sm:text-lg font-bold tabular-nums">{value}</span>
          {subtitle && (
            <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">
              {subtitle}
            </span>
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
 * Displays four summary KPI cards.
 * Mobile: 2-column grid. Desktop: single flex row.
 */
export function KpiBar({ overallSummary, loading }: KpiBarProps) {
  if (loading) {
    return (
      // 2-col on mobile, 4-col row on sm+
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-0">
            <Skeleton className="h-[88px] sm:h-[100px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const kpis: KpiCardProps[] = [
    {
      title: "Highest Price",
      value: formatCurrency(overallSummary.highestPrice),
      icon: <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />,
      accent: "bg-red-50 dark:bg-red-950",
      subtitle: overallSummary.highestPriceYear
        ? `in ${overallSummary.highestPriceYear}`
        : "—",
    },
    {
      title: "Lowest Price",
      value: formatCurrency(overallSummary.lowestPrice),
      icon: (
        <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
      ),
      accent: "bg-emerald-50 dark:bg-emerald-950",
      subtitle: overallSummary.lowestPriceYear
        ? `in ${overallSummary.lowestPriceYear}`
        : "—",
    },
    {
      title: "Average Price",
      value: formatCurrency(overallSummary.averagePrice),
      icon: (
        <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
      ),
      accent: "bg-amber-50 dark:bg-amber-950",
      subtitle: "Avg of current price per type",
    },
    {
      title: "Price Changes",
      value: overallSummary.totalChanges.toLocaleString(),
      icon: (
        <Hash className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 dark:text-indigo-400" />
      ),
      accent: "bg-indigo-50 dark:bg-indigo-950",
      subtitle: "Approved changes overall",
    },
  ];

  return (
    // 2-col on mobile, flex row on sm+
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}