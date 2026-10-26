// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/components/SalesPerformanceCharts.tsx
// ==============================================================================
// Sales Performance Report - Rich Visual Analytics Charts
// Renders Sales Trend Area Chart, Gas Type Donut Chart, and Branch Bar Chart.
// ==============================================================================

"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesPerformance } from "../providers/SalesPerformanceProvider";

interface TooltipPayloadItem {
  name: string;
  value: number;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomAreaTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-sm text-xs">
        <p className="font-semibold text-foreground mb-1.5">{label}</p>
        {payload.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: item.color }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}:
            </span>
            <span className="font-bold text-foreground">
              {item.name.includes("Sales") ? `₱${item.value.toLocaleString()}` : `${item.value.toLocaleString()} kg`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// DEV-RULE: Dedicated high-contrast dark/light mode tooltip for Branch Performance Bar Chart
const CustomBarTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-sm text-xs min-w-[200px]">
        <p className="font-semibold text-foreground mb-2 pb-1 border-b border-border">{label}</p>
        {payload.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-3 py-1">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: item.color }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}:
            </span>
            <span className="font-bold text-foreground">
              {item.name.includes("Sales") ? `₱${Number(item.value || 0).toLocaleString()}` : `${Number(item.value || 0).toLocaleString()} kg`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// DEV-RULE: Dedicated high-contrast dark/light mode tooltip for Gas Volume Donut Chart
const CustomPieTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    const dataObj = (item as unknown as { payload?: { kgSold?: number; netSales?: number; percentage?: number } })?.payload;
    return (
      <div className="rounded-lg border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-sm text-xs">
        <p className="font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.name}
        </p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Gas Sold:</span>
            <span className="font-bold text-sky-500 dark:text-sky-400">
              {Number(dataObj?.kgSold || item.value || 0).toLocaleString()} kg
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Net Sales:</span>
            <span className="font-bold text-emerald-500 dark:text-emerald-400">
              ₱{Number(dataObj?.netSales || 0).toLocaleString()}
            </span>
          </div>
          {dataObj?.percentage != null && (
            <div className="flex justify-between gap-4 pt-1 border-t border-border">
              <span className="text-muted-foreground">Share:</span>
              <span className="font-bold text-foreground">{dataObj.percentage}%</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function SalesPerformanceCharts() {
  const { report, isLoading } = useSalesPerformance();

  if (isLoading || !report) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border shadow-xs">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </CardHeader>
          <CardContent className="h-[280px] flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </CardContent>
        </Card>
        <Card className="border shadow-xs">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </CardHeader>
          <CardContent className="h-[280px] flex items-center justify-center">
            <Skeleton className="h-44 w-44 rounded-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { charts } = report;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. Net Sales & Volume Trend Area Chart (2 Cols) */}
      <Card className="lg:col-span-2 border shadow-xs bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Sales & Gas Volume Trajectory
              </CardTitle>
              <CardDescription className="text-xs">
                Timeline tracking of Net Sales (PHP) and Cylinders Gas Sold (Kg)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[290px] w-full pt-2">
            {charts.salesTrend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No sales trend records match the active criteria.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.salesTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netSalesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="kgSoldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} dy={8} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomAreaTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={30}
                    iconType="circle"
                    formatter={(val) => <span className="text-xs text-muted-foreground font-medium">{val}</span>}
                  />
                  <Area
                    type="monotone"
                    dataKey="netSales"
                    name="Net Sales (PHP)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#netSalesGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="kgSold"
                    name="Gas Sold (Kg)"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#kgSoldGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Gas Category Volume Donut Chart (1 Col) */}
      <Card className="border shadow-xs bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-foreground">
            Gas Volume Distribution
          </CardTitle>
          <CardDescription className="text-xs">
            Industrial gas volume breakdown by product
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[290px] w-full flex flex-col items-center justify-center">
            {charts.gasDistribution.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center">
                No serialized gas volumes recorded.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={charts.gasDistribution}
                      dataKey={(entry: { kgSold: number; percentage: number }) =>
                        entry.kgSold > 0 ? entry.kgSold : entry.percentage
                      }
                      nameKey="gasType"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {charts.gasDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="w-full grid grid-cols-2 gap-1.5 mt-2 max-h-[80px] overflow-y-auto text-[11px]">
                  {charts.gasDistribution.slice(0, 6).map((g, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 truncate">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="truncate text-muted-foreground font-medium" title={g.gasType}>
                        {g.gasType}:
                      </span>
                      <span className="font-bold text-foreground shrink-0">{g.percentage}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Branch Performance Bar Chart (Full Width Row) */}
      <Card className="lg:col-span-3 border shadow-xs bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-foreground">
            Branch Performance & Comparative Sales
          </CardTitle>
          <CardDescription className="text-xs">
            Net revenue, gas kilograms, and invoice volume comparison across authorized branches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] w-full pt-2">
            {charts.branchComparison.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No branch data available for current criteria.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.branchComparison} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="branchName" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={30}
                    iconType="rect"
                    formatter={(val) => <span className="text-xs text-muted-foreground font-medium">{val}</span>}
                  />
                  <Bar
                    dataKey="netSales"
                    name="Net Sales (PHP)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="kgSold"
                    name="Gas Sold (Kg)"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
