// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/components/CustomerProfitabilityCharts.tsx
// ==============================================================================
// Visual Analytics Component (Recharts)
// - Chart 1: Profitability Tier Distribution (Net Sales vs Contribution)
// - Chart 2: Cost Component Breakdown (Donut)
// Features full Light & Dark mode contrast-compliant custom tooltips.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import { useCustomerProfitability } from "../providers/CustomerProfitabilityProvider";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  type TooltipProps,
} from "recharts";
import { BarChart3, PieChart as PieIcon } from "lucide-react";

/**
 * Custom high-contrast theme-aware tooltip for Recharts (works across light/dark themes)
 */
function CustomChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-md text-popover-foreground text-xs space-y-1.5 min-w-[140px] z-50">
      {label && (
        <div className="font-semibold text-foreground pb-1 border-b border-border/50 text-[11px]">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color || item.fill }}
              />
              <span>{item.name}:</span>
            </span>
            <span className="font-semibold text-foreground text-[11px]">
              ₱{Number(item.value ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerProfitabilityCharts() {
  const { data, isLoading } = useCustomerProfitability();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 h-72 rounded-xl border border-border bg-card/40 animate-pulse" />
        <div className="lg:col-span-5 h-72 rounded-xl border border-border bg-card/40 animate-pulse" />
      </div>
    );
  }

  const { charts } = data;
  const pieColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 1. Bar Chart: Tier Distribution */}
      <div className="lg:col-span-7 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Profitability Tier Distribution (Net Sales vs Contribution)
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">Values in PHP</span>
        </div>

        <div className="h-60 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={charts.tierDistribution}
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            >
              <XAxis
                dataKey="tier"
                tick={{ fontSize: 10, fill: "currentColor" }}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "currentColor" }}
                stroke="currentColor"
                className="text-muted-foreground"
                tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={<CustomChartTooltip />}
                cursor={{ fill: "hsl(var(--muted)/0.25)", radius: 6 }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              />
              <Bar
                dataKey="totalNetSales"
                name="Net Sales"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="totalContribution"
                name="Contribution"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Donut Chart: Cost Breakdown */}
      <div className="lg:col-span-5 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Fully Absorbed Cost Breakdown
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">Direct vs Assigned</span>
        </div>

        <div className="h-60 w-full pt-2 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts.costBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
              >
                {charts.costBreakdown.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={pieColors[index % pieColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomChartTooltip />} />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
