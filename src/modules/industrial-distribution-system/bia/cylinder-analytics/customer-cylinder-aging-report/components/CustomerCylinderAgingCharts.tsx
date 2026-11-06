// components/CustomerCylinderAgingCharts.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Recharts visualizations for Customer Cylinder Aging Report.
// Includes Aging Bucket Distribution (BarChart) and Overdue Risk Breakdown (Pie/Donut).
// Fully styled for Dark and Light themes with custom blur tooltips and interactive hover effects.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { BarChart3, PieChart as PieIcon } from "lucide-react";
import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";

// High-contrast, saturated colors looking vibrant in both dark and light modes
const BUCKET_COLORS = [
  "#10b981", // 0-15d: Emerald
  "#0ea5e9", // 16-30d: Sky
  "#f59e0b", // 31-60d: Amber
  "#f43f5e", // 61-90d: Rose
  "#a855f7", // 90+d: Purple
];

const RISK_COLORS = [
  "#10b981", // Compliant: Emerald
  "#f59e0b", // Warning: Amber
  "#f43f5e", // Critical: Rose
  "#a855f7", // Delinquent: Purple
];

interface TooltipPayloadItem {
  value?: number | string;
  name?: string;
  color?: string;
  payload: {
    fill?: string;
    label?: string;
    bucket?: string;
    count?: number;
    name?: string;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

// Custom theme-aware tooltip for the Bar Chart
function CustomBarTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const color = item.payload.fill || item.color || "#3b82f6";

  return (
    <div className="rounded-lg border bg-card/95 backdrop-blur-md px-3 py-2 shadow-xl border-border text-foreground text-xs space-y-1">
      <div className="flex items-center gap-1.5 font-semibold">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span>{item.payload.label || item.payload.bucket}</span>
      </div>
      <div className="text-muted-foreground text-[11px] font-mono">
        Quantity:{" "}
        <strong className="text-foreground font-sans">
          {Number(item.value ?? 0).toLocaleString()} Cylinders
        </strong>
      </div>
    </div>
  );
}

// Custom theme-aware tooltip for the Donut Chart
function CustomDonutTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const color = item.payload.fill || "#3b82f6";

  return (
    <div className="rounded-lg border bg-card/95 backdrop-blur-md px-3 py-2 shadow-xl border-border text-foreground text-xs space-y-1">
      <div className="flex items-center gap-1.5 font-semibold">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span>{item.name}</span>
      </div>
      <div className="text-muted-foreground text-[11px] font-mono">
        Volume:{" "}
        <strong className="text-foreground font-sans">
          {Number(item.value ?? 0).toLocaleString()} Cylinders
        </strong>
      </div>
    </div>
  );
}

export function CustomerCylinderAgingCharts() {
  const { reportData, isLoading } = useCustomerCylinderAging();

  const bucketData = (reportData?.charts.bucketDistribution || []).map(
    (d, index) => ({
      ...d,
      fill: BUCKET_COLORS[index % BUCKET_COLORS.length],
    })
  );

  const riskData = (reportData?.charts.riskDistribution || []).filter(
    (d) => d.count > 0
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Aging Bucket Volume Distribution ── */}
      <Card className="lg:col-span-2 border shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all duration-200 bg-card">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Aging Bucket Volume Distribution
              </CardTitle>
              <CardDescription className="text-xs">
                Cylinder counts categorized across customer holding durations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          {isLoading ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground animate-pulse">
              Loading distribution graphics...
            </div>
          ) : bucketData.every((d) => d.count === 0) ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
              No outstanding cylinders recorded for selected filters.
            </div>
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={bucketData}
                  margin={{ top: 15, right: 15, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border/40"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    className="text-[11px] fill-muted-foreground"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    className="text-[11px] fill-muted-foreground"
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                    content={<CustomBarTooltip />}
                  />
                  <Bar
                    dataKey="count"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                    className="cursor-pointer hover:opacity-85 transition-opacity"
                  >
                    {bucketData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Overdue Risk Share (Donut) ── */}
      <Card className="border shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all duration-200 bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-primary" />
            Overdue Risk Breakdown
          </CardTitle>
          <CardDescription className="text-xs">
            Ratio of compliant vs. overdue customer cylinders
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          {isLoading ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground animate-pulse">
              Loading risk shares...
            </div>
          ) : riskData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
              No data to display.
            </div>
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    className="cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    {riskData.map((_, index) => (
                      <Cell
                        key={`risk-cell-${index}`}
                        fill={RISK_COLORS[index % RISK_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomDonutTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
