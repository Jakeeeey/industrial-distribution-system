// components/BranchOperationalCharts.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Recharts visualizations with top-side color accents, dark theme styling,
// and rich interactive custom tooltips.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useBranchOperationalPerformanceReport } from "../hooks/useBranchOperationalPerformanceReport";

const PIE_COLORS = [
  "#ef4444", // lost (red)
  "#f59e0b", // damaged (amber)
  "#3b82f6", // aging (blue)
  "#6b7280", // variance (gray)
];

const RECOVERY_COLORS = [
  "#3b82f6", // in custody
  "#f59e0b", // pending recovery
  "#10b981", // recovered
  "#ef4444", // written off
];

interface TooltipItem {
  dataKey?: string | number;
  value?: number | string;
  name?: string;
  color?: string;
  fill?: string;
  payload?: {
    fill?: string;
    [key: string]: unknown;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
}

// ── Custom Tooltip for Sales vs Trip Cost Bar Chart ──────────────────────────
function CustomCostRevenueTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const sales = Number(payload.find((p) => p.dataKey === "salesRevenue")?.value ?? 0);
  const cost = Number(payload.find((p) => p.dataKey === "tripExpense")?.value ?? 0);
  const netSpread = sales - cost;

  return (
    <div className="rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur-xs text-xs space-y-2 min-w-48 border-border">
      <div className="font-semibold text-foreground border-b pb-1">
        {label || "Date"}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Sales Revenue:
          </span>
          <span className="font-semibold text-foreground tabular-nums">
            PHP {sales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Trip Cost:
          </span>
          <span className="font-semibold text-foreground tabular-nums">
            PHP {cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      <div className="border-t pt-1.5 flex items-center justify-between font-medium">
        <span className="text-muted-foreground">Net Margin:</span>
        <span className={`tabular-nums font-semibold ${netSpread >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
          {netSpread >= 0 ? "+" : ""}PHP {netSpread.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

// ── Custom Tooltip for Volume Trends Area Chart ──────────────────────────────
function CustomVolumeTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const delivered = Number(payload.find((p) => p.dataKey === "deliveredFulls")?.value ?? 0);
  const returned = Number(payload.find((p) => p.dataKey === "returnedEmpties")?.value ?? 0);

  return (
    <div className="rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur-xs text-xs space-y-2 min-w-44 border-border">
      <div className="font-semibold text-foreground border-b pb-1">
        {label || "Date"}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Delivered Fulls:
          </span>
          <span className="font-semibold text-foreground tabular-nums">
            {delivered.toLocaleString()} units
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Returned Empties:
          </span>
          <span className="font-semibold text-foreground tabular-nums">
            {returned.toLocaleString()} units
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Custom Tooltip for Pie Charts ─────────────────────────────────────────────
function CustomPieTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];

  return (
    <div className="rounded-lg border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-xs text-xs border-border flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.payload?.fill || item.color }} />
      <span className="font-medium text-foreground">{item.name}:</span>
      <span className="font-bold text-foreground tabular-nums">{item.value}</span>
    </div>
  );
}

export function BranchOperationalCharts() {
  const { report } = useBranchOperationalPerformanceReport();

  const volumeTrends = report?.charts?.volumeTrends ?? [];
  const costRevenueTrends = report?.charts?.costRevenueTrends ?? [];
  const incidentDistribution = report?.charts?.incidentDistribution ?? [];
  const recoveryDistribution = report?.charts?.recoveryDistribution ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Volume & Return Trends */}
      <Card className="border shadow-xs bg-card border-t-2 border-t-teal-500">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            Dispatches vs Empty Recovery Trends
          </CardTitle>
          <CardDescription className="text-xs">
            Comparison of delivered full cylinders vs returned empties over time
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorReturned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.4)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                <Tooltip content={<CustomVolumeTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Area
                  type="monotone"
                  dataKey="deliveredFulls"
                  name="Delivered Fulls"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorDelivered)"
                />
                <Area
                  type="monotone"
                  dataKey="returnedEmpties"
                  name="Returned Empties"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorReturned)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 2. Operational Revenue vs Trip Costs */}
      <Card className="border shadow-xs bg-card border-t-2 border-t-indigo-500">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            Sales Revenue vs Trip Operating Costs
          </CardTitle>
          <CardDescription className="text-xs">
            Operational margin comparison of branch sales against transport costs
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costRevenueTrends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.4)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  tickFormatter={(val) => `₱${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.25)" }}
                  content={<CustomCostRevenueTooltip />}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Bar dataKey="salesRevenue" name="Sales Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="tripExpense" name="Trip Costs" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 3. Incident Breakdown */}
      <Card className="border shadow-xs bg-card border-t-2 border-t-rose-500">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            Exception & Incident Breakdown
          </CardTitle>
          <CardDescription className="text-xs">
            Distribution of identified exceptions across cylinder holdings
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-around gap-4">
          <div className="h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={incidentDistribution.filter((d) => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {incidentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || PIE_COLORS[index % PIE_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-xs w-full sm:w-auto">
            {incidentDistribution.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between sm:justify-start gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill || PIE_COLORS[idx % PIE_COLORS.length] }} />
                <span className="font-medium text-foreground">{item.name}:</span>
                <span className="text-muted-foreground font-semibold tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4. Recovery Status Breakdown */}
      <Card className="border shadow-xs bg-card border-t-2 border-t-emerald-500">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            Recovery Accountability Status
          </CardTitle>
          <CardDescription className="text-xs">
            Custody and recovery progress for active exceptions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-around gap-4">
          <div className="h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={recoveryDistribution.filter((d) => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {recoveryDistribution.map((entry, index) => (
                    <Cell key={`cell-rec-${index}`} fill={entry.fill || RECOVERY_COLORS[index % RECOVERY_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-xs w-full sm:w-auto">
            {recoveryDistribution.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between sm:justify-start gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill || RECOVERY_COLORS[idx % RECOVERY_COLORS.length] }} />
                <span className="font-medium text-foreground">{item.name}:</span>
                <span className="text-muted-foreground font-semibold tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
