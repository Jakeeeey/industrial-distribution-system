// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/components/DeliverPerformanceCharts.tsx
// ==============================================================================
// Delivery Performance Report - Graphics & Charts
// Visualizes:
// 1. Fulfillment Trends (Clean spaced bars with custom tooltip, cursor={false} to remove gray hover shine)
// 2. Fulfillment Ratio (Modern Donut with centered success metric)
// 3. Driver Performance & Reliability (Bar Chart / Graph with cursor={false})
// ==============================================================================

"use client";

import React from "react";
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
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Truck, CheckCircle2, UserCheck, Calendar } from "lucide-react";
import { useDeliverPerformance } from "../providers/DeliverPerformanceProvider";

/**
 * Custom Tooltip Component for Trends Chart
 */
function TrendsCustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const total = payload.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

  let formattedDate = label;
  try {
    if (label && label.includes("-")) {
      const d = new Date(label);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
    }
  } catch {
    // Fallback
  }

  return (
    <div className="rounded-lg border border-border/80 bg-background/95 p-2.5 shadow-xl backdrop-blur-md min-w-[190px] text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-foreground border-b border-border/60 pb-1.5 mb-1.5">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        <span>{formattedDate}</span>
      </div>
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const val = Number(entry.value) || 0;
          const pct = total > 0 ? ((val / total) * 100).toFixed(0) : "0";
          return (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-[11px]">{entry.name}:</span>
              </div>
              <span className="font-semibold text-foreground text-[11px]">
                {val} <span className="text-[10px] text-muted-foreground">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between font-bold text-foreground text-[11px]">
        <span>Total Dispatched:</span>
        <span className="text-primary">{total} trips</span>
      </div>
    </div>
  );
}

/**
 * Custom Tooltip for Donut Pie Chart
 */
function DonutCustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string; percentage: number } }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0];

  return (
    <div className="rounded-lg border border-border/80 bg-background/95 p-2 shadow-xl backdrop-blur-md text-xs min-w-[140px]">
      <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: data.payload.color }} />
        <span>{data.name}</span>
      </div>
      <div className="flex justify-between text-muted-foreground text-[11px]">
        <span>Count:</span>
        <span className="font-bold text-foreground">{data.value} deliveries</span>
      </div>
      <div className="flex justify-between text-muted-foreground text-[11px] mt-0.5">
        <span>Share:</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{data.payload.percentage}%</span>
      </div>
    </div>
  );
}

/**
 * Custom Tooltip for Driver Performance Chart
 */
function DriverChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload: { fulfillmentRate: number; totalTrips: number } }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const driverData = payload[0]?.payload;

  return (
    <div className="rounded-lg border border-border/80 bg-background/95 p-2.5 shadow-xl backdrop-blur-md text-xs min-w-[180px]">
      <div className="font-bold text-foreground border-b border-border/60 pb-1 mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
          {driverData?.fulfillmentRate}% Success
        </span>
      </div>
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={`d-${idx}`} className="flex justify-between text-muted-foreground text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
            </div>
            <span className="font-bold text-foreground">{entry.value} trips</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-1 border-t border-border/60 flex justify-between font-semibold text-foreground text-[11px]">
        <span>Total Dispatched:</span>
        <span>{driverData?.totalTrips} trips</span>
      </div>
    </div>
  );
}

export function DeliverPerformanceCharts() {
  const { report, loading } = useDeliverPerformance();
  const charts = report?.charts;

  if (loading && !charts) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="col-span-2 h-64 animate-pulse bg-muted/30" />
        <Card className="h-64 animate-pulse bg-muted/30" />
      </div>
    );
  }

  const trends = (charts?.trends || []).map((t) => {
    let shortTick = t.date;
    try {
      if (t.date.includes("-")) {
        const parts = t.date.split("-");
        if (parts.length === 3) {
          const monthNum = parseInt(parts[1], 10) - 1;
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          shortTick = `${months[monthNum]} ${parseInt(parts[2], 10)}`;
        }
      }
    } catch {
      // Fallback
    }
    return {
      ...t,
      displayDate: shortTick,
    };
  });

  const statusDist = (charts?.statusDistribution || []).filter((s) => s.count > 0);
  const topDrivers = charts?.topDrivers || [];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* 1. Fulfillment Trends (cursor={false} removes gray shine on hover) */}
      <Card className="lg:col-span-2 shadow-xs border-border">
        <CardHeader className="py-2.5 px-3 border-b border-border/50">
          <CardTitle className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-primary" />
            Fulfillment Volume & Status Trends
          </CardTitle>
          <CardDescription className="text-[11px] text-muted-foreground">
            Daily breakdown of completed deliveries and exception orders
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3">
          <div className="h-56 w-full">
            {trends.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No trend data available for selected period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 8, right: 10, left: -24, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    tickLine={false}
                    allowDecimals={false}
                  />
                  {/* cursor={false} eliminates gray shine overlay on hover */}
                  <Tooltip content={<TrendsCustomTooltip />} cursor={false} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="fulfilled" name="Fulfilled" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="withConcerns" name="With Concerns" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="withReturns" name="With Returns" fill="#6366f1" stackId="a" />
                  <Bar dataKey="notFulfilled" name="Not Fulfilled" fill="#f43f5e" stackId="a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Status Distribution Donut with Center Metric */}
      <Card className="shadow-xs border-border">
        <CardHeader className="py-2.5 px-3 border-b border-border/50">
          <CardTitle className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Fulfillment Ratio
          </CardTitle>
          <CardDescription className="text-[11px] text-muted-foreground">
            Delivery breakdown by completion outcome
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3">
          <div className="h-56 w-full relative flex items-center justify-center">
            {statusDist.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No delivery records found.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDist}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      innerRadius={46}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {statusDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutCustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", paddingTop: "2px" }}
                      iconType="circle"
                      iconSize={7}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center KPI badge */}
                <div className="absolute top-[37%] flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-bold text-foreground">
                    {report?.kpis.fulfillmentRate ?? 0}%
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
                    Success
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Driver Performance & Reliability (cursor={false} removes gray shine on hover) */}
      {topDrivers.length > 0 && (
        <Card className="lg:col-span-3 shadow-xs border-border">
          <CardHeader className="py-2.5 px-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Driver Performance & Reliability
                </CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground">
                  Fulfilled vs. exception deliveries per active custodian
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDrivers}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis
                    dataKey="driverName"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    tickLine={false}
                    allowDecimals={false}
                  />
                  {/* cursor={false} eliminates gray shine overlay on hover */}
                  <Tooltip content={<DriverChartTooltip />} cursor={false} />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar
                    dataKey="fulfilledCount"
                    name="Fulfilled Trips"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="failedCount"
                    name="Exceptions / Failed"
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
