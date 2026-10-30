// components/CustomerCylinderTurnaroundCharts.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Recharts graphical analytics for Customer Cylinder Turnaround Ratio (CTR) Module.
// Enhanced with topside gradient accent lines, card hover elevation,
// and optimized dark mode tooltip styling.
// Includes Unmonitored Holding category for active base with 0 transactions.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { PieChart as PieIcon, BarChart3 } from "lucide-react";
import { useCustomerCylinderTurnaround } from "../providers/CustomerCylinderTurnaroundProvider";

const GRADE_COLORS: Record<string, string> = {
  "CTR 4 (Fastest)": "#10b981",    // Emerald 500
  "CTR 6 (Standard)": "#3b82f6",   // Blue 500
  "CTR 8 (Moderate)": "#f59e0b",   // Amber 500
  "Sub-standard": "#f43f5e",       // Rose 500
  "Unmonitored Holding": "#fbbf24", // Warm Amber 400
  "Unrated (Base=0)": "#64748b",   // Slate 500
};

export function CustomerCylinderTurnaroundCharts() {
  const { items, kpis, isLoading } = useCustomerCylinderTurnaround();

  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
        <div className="h-72 rounded-xl bg-muted/50" />
        <div className="h-72 rounded-xl bg-muted/50" />
      </div>
    );
  }

  // 1. Prepare Donut Chart Data
  const donutData = [
    { name: "CTR 4 (Fastest)", value: kpis.gradeDistribution.ctr4Count },
    { name: "CTR 6 (Standard)", value: kpis.gradeDistribution.ctr6Count },
    { name: "CTR 8 (Moderate)", value: kpis.gradeDistribution.ctr8Count },
    { name: "Sub-standard", value: kpis.gradeDistribution.subStandardCount },
    { name: "Unmonitored Holding", value: kpis.gradeDistribution.unmonitoredCount || 0 },
    { name: "Unrated (Base=0)", value: kpis.gradeDistribution.baseZeroCount },
  ].filter((d) => d.value > 0);

  // 2. Prepare Top 7 Customers Turnaround Bar Data
  const barData = items
    .filter((i) => !i.isBaseZero && i.annualTurns > 0)
    .sort((a, b) => b.annualTurns - a.annualTurns)
    .slice(0, 7)
    .map((i) => ({
      name: i.customerName.length > 18 ? `${i.customerName.slice(0, 16)}...` : i.customerName,
      annualTurns: i.annualTurns,
      cylinderBase: i.cylinderBase,
      grade: i.grade.replace("_", " "),
      incentive: i.totalIncentiveAmount,
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1: Grade Tier Distribution */}
      <Card className="group border border-border/80 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-emerald-500/40">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 transition-all duration-300 group-hover:h-1.5" />
        <CardHeader className="pb-2 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              <PieIcon className="h-4 w-4 text-emerald-500" />
              Customer Grade Distribution
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              {items.length} accounts analyzed
            </span>
          </div>
          <CardDescription className="text-xs">
            Share of customer accounts categorized into CTR 4, CTR 6, CTR 8, Unmonitored, and Sub-standard tiers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {donutData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={GRADE_COLORS[entry.name] || "#94a3b8"}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      const total = donutData.reduce((acc, c) => acc + c.value, 0);
                      const pct = ((Number(data.value) / total) * 100).toFixed(1);
                      return (
                        <div className="rounded-lg border border-border/80 bg-popover/95 dark:bg-zinc-900/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-1">
                          <p className="font-semibold text-foreground dark:text-zinc-100">
                            {data.name}
                          </p>
                          <p className="text-muted-foreground dark:text-zinc-400">
                            {data.value} accounts ({pct}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Chart 2: Annual Turns per Customer */}
      <Card className="group border border-border/80 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-blue-500/40">
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 group-hover:h-1.5" />
        <CardHeader className="pb-2 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Turnaround Velocity (Top Accounts)
            </CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              Target: &ge; 3.0 turns/yr
            </span>
          </div>
          <CardDescription className="text-xs">
            Annualized circulation speed (turns/yr) compared against CTR 4 target threshold.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="name"
                  angle={-15}
                  textAnchor="end"
                  interval={0}
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  stroke="currentColor"
                  opacity={0.6}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  stroke="currentColor"
                  opacity={0.6}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border/80 bg-popover/95 dark:bg-zinc-900/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-1.5">
                          <p className="font-semibold text-foreground dark:text-zinc-100 border-b border-border/40 pb-1">
                            {data.name}
                          </p>
                          <div className="space-y-0.5">
                            <p className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                              Annual Turns: {data.annualTurns} turns/yr
                            </p>
                            <p className="text-muted-foreground dark:text-zinc-400">
                              Cylinder Base: {data.cylinderBase} units
                            </p>
                            <p className="text-amber-600 dark:text-amber-400 font-medium">
                              Incentive: ₱{data.incentive.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Benchmark threshold for CTR 4 */}
                <ReferenceLine
                  y={3.0}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{
                    value: "CTR 4 (3.0)",
                    fill: "#10b981",
                    fontSize: 10,
                    position: "right",
                  }}
                />
                <Bar dataKey="annualTurns" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
