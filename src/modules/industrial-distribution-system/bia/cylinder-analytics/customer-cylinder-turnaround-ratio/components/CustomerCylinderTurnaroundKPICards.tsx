// components/CustomerCylinderTurnaroundKPICards.tsx
// ──────────────────────────────────────────────────────────────────────────────
// KPI Metric summary cards for Customer Cylinder Turnaround Ratio (CTR) Module.
// Enhanced with interactive hover colors, elevation, border transitions, and icon animations.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  RotateCcw,
  Award,
  CircleDollarSign,
  Boxes,
} from "lucide-react";
import { useCustomerCylinderTurnaround } from "../providers/CustomerCylinderTurnaroundProvider";

export function CustomerCylinderTurnaroundKPICards() {
  const { kpis, isLoading } = useCustomerCylinderTurnaround();

  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/60" />
        ))}
      </div>
    );
  }

  const {
    averageAnnualTurns,
    averageMonthsPerTurn,
    activeTurnaroundCustomers,
    gradeDistribution,
    totalEligibleRefills11kg,
    totalEligibleKilograms,
    totalApprovedIncentive,
  } = kpis;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Turnaround Speed */}
      <Card className="group border border-border/80 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-500/50 hover:bg-emerald-500/5">
        <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500 transition-all duration-300 group-hover:h-1.5" />
        <CardContent className="p-4 pt-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              Avg. Turnaround Speed
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {averageAnnualTurns}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                turns / year
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {averageMonthsPerTurn} mos
              </span>
              <span>cycle time across {activeTurnaroundCustomers} active accts</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Customer Grade Breakdown */}
      <Card className="group border border-border/80 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-blue-500/50 hover:bg-blue-500/5">
        <div className="absolute top-0 left-0 h-1 w-full bg-blue-500 transition-all duration-300 group-hover:h-1.5" />
        <CardContent className="p-4 pt-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
              Grade Distribution
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {gradeDistribution.ctr4Count + gradeDistribution.ctr6Count}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                high performers
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5 text-[11px]">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
                CTR 4: {gradeDistribution.ctr4Count}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold">
                CTR 6: {gradeDistribution.ctr6Count}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                CTR 8: {gradeDistribution.ctr8Count}
              </span>
              {gradeDistribution.baseZeroCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-700 dark:text-slate-300">
                  Unrated: {gradeDistribution.baseZeroCount}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Eligible 11kg Volume */}
      <Card className="group border border-border/80 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-purple-500/50 hover:bg-purple-500/5">
        <div className="absolute top-0 left-0 h-1 w-full bg-purple-500 transition-all duration-300 group-hover:h-1.5" />
        <CardContent className="p-4 pt-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
              Eligible Refills (11kg)
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500/20 group-hover:scale-110 transition-all">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {totalEligibleRefills11kg.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                cylinders
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalEligibleKilograms.toLocaleString()} kg total verified volume
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. Total Payout Accrual */}
      <Card className="group border border-border/80 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-amber-500/50 hover:bg-amber-500/5">
        <div className="absolute top-0 left-0 h-1 w-full bg-amber-500 transition-all duration-300 group-hover:h-1.5" />
        <CardContent className="p-4 pt-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
              Total Approved Incentive
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-110 transition-all">
              <CircleDollarSign className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
              <span>₱</span>
              <span>
                {totalApprovedIncentive.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Calculated for Finance incentive release
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
