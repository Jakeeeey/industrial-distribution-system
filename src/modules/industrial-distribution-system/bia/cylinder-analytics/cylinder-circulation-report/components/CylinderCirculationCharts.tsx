// components/CylinderCirculationCharts.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Recharts visualization component for Cylinder Circulation:
// 1. Circulation Health Distribution (Donut chart with card-matching border)
// 2. Lifecycle Stage Dwell & Volume (Bar chart with translucent dark-mode cursor)
// Custom floating tooltips for both light and dark theme modes with correct labels.
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
} from "recharts";
import { useCylinderCirculationReport } from "../providers/CylinderCirculationReportProvider";

interface StageTooltipPayload {
  name: string;
  value: number;
  dataKey: string;
  payload: {
    stage: string;
    volume: number;
    avgDwellDays: number;
  };
}

function CustomStageTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: StageTooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-card/95 backdrop-blur-md p-3 shadow-xl text-foreground text-xs min-w-[200px] space-y-2 border-border/80">
      <div className="font-semibold text-foreground border-b pb-1.5 flex items-center justify-between">
        <span>{data.stage}</span>
        <span className="text-[10px] text-muted-foreground font-normal uppercase">Stage Metrics</span>
      </div>
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            <span>Total Scans:</span>
          </div>
          <span className="font-semibold text-foreground">{data.volume.toLocaleString()} scans</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
            <span>Avg Holding Time:</span>
          </div>
          <span className="font-semibold text-foreground">{data.avgDwellDays} days</span>
        </div>
      </div>
    </div>
  );
}

interface DonutTooltipPayload {
  name: string;
  value: number;
  payload: {
    name: string;
    value: number;
    fill?: string;
  };
}

function CustomDonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: DonutTooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];

  return (
    <div className="rounded-lg border bg-card/95 backdrop-blur-md px-3 py-2 shadow-xl text-foreground text-xs border-border/80 flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: item.payload.fill || "hsl(var(--primary))" }}
      />
      <span className="font-medium">{item.name}:</span>
      <span className="font-bold">{item.value.toLocaleString()} Cylinders</span>
    </div>
  );
}

export function CylinderCirculationCharts() {
  const { reportData, loading } = useCylinderCirculationReport();
  const charts = reportData?.charts;

  if (loading || !charts) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="h-72 animate-pulse bg-muted/40 py-0" />
        <Card className="h-72 animate-pulse bg-muted/40 py-0" />
      </div>
    );
  }

  const hasStatusData = charts.statusDistribution.length > 0;
  const hasStageData = charts.stageTurnaround.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Chart 1: Circulation Health Distribution (Donut Chart) ── */}
      <Card className="border shadow-2xs hover:shadow-xs transition-all duration-200 bg-card hover:border-primary/30 py-0 gap-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Circulation Health Distribution</span>
            <span className="text-[11px] font-normal text-muted-foreground px-2 py-0.5 rounded bg-muted">
              Diagnostic Split
            </span>
          </CardTitle>
          <CardDescription className="text-xs">
            Breakdown of active cylinder assets by sequential flow diagnostic
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-64 w-full">
            {hasStatusData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={82}
                    paddingAngle={3}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {charts.statusDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill || "hsl(var(--primary))"}
                        className="transition-all duration-200 hover:opacity-85 cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomDonutTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No circulation data matching active filters
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Chart 2: Movement Stage Activity & Dwell Times (Bar Chart) ── */}
      <Card className="border shadow-2xs hover:shadow-xs transition-all duration-200 bg-card hover:border-primary/30 py-0 gap-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Lifecycle Stage Activity & Dwell</span>
            <span className="text-[11px] font-normal text-muted-foreground px-2 py-0.5 rounded bg-muted">
              Volume vs Dwell
            </span>
          </CardTitle>
          <CardDescription className="text-xs">
            Scan event volume and average days spent per circulation stage
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-64 w-full">
            {hasStageData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.stageTurnaround}
                  margin={{ top: 12, right: 10, left: -15, bottom: 0 }}
                >
                  <defs>
                    {/* Vibrant Blue/Cyan Gradient for Scan Volume */}
                    <linearGradient id="scanVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.75} />
                    </linearGradient>
                    {/* Vibrant Purple/Violet Gradient for Avg Dwell */}
                    <linearGradient id="avgDwellGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.75} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--muted-foreground) / 0.15)"
                  />
                  <XAxis
                    dataKey="stage"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={{ stroke: "hsl(var(--border) / 0.4)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={{ stroke: "hsl(var(--border) / 0.4)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomStageTooltip />}
                    cursor={{ fill: "hsl(var(--muted-foreground) / 0.1)", radius: 4 }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="rect"
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  />
                  <Bar
                    dataKey="volume"
                    name="Scan Volume"
                    fill="url(#scanVolumeGradient)"
                    radius={[4, 4, 0, 0]}
                    className="transition-opacity hover:opacity-85"
                  />
                  <Bar
                    dataKey="avgDwellDays"
                    name="Avg Dwell (Days)"
                    fill="url(#avgDwellGradient)"
                    radius={[4, 4, 0, 0]}
                    className="transition-opacity hover:opacity-85"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No stage data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
