// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/components/CylinderInspectionHydrotestCharts.tsx
// ==============================================================================
// Visual Charts Component for Cylinder Inspection and Hydrotest Due Report
// Renders Donut chart for compliance rating breakdown and Bar chart for due date horizons.
// Custom ChartTooltip with theme-aware colors to ensure readability in dark and light modes.
// ==============================================================================

"use client";

import * as React from "react";
import { useCylinderInspection } from "../providers/CylinderInspectionHydrotestProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { PieChart as PieIcon, BarChart3 } from "lucide-react";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: {
      fill?: string;
      color?: string;
      name?: string;
      horizon?: string;
    };
  }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const title = label || item.payload?.name || item.payload?.horizon || item.name || "Metric";
  const color = item.payload?.fill || item.payload?.color || item.color || "#10b981";
  const val = Number(item.value ?? 0);

  return (
    <div className="rounded-lg border border-border bg-popover/95 backdrop-blur-sm p-2.5 shadow-xl text-xs space-y-1 z-50">
      <div className="font-semibold text-popover-foreground">{title}</div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span>Count:</span>
        <span className="font-bold text-foreground">{val.toLocaleString()} cylinders</span>
      </div>
    </div>
  );
}

export function CylinderInspectionHydrotestCharts() {
  const { report, isLoading } = useCylinderInspection();
  const charts = report?.charts;

  if (isLoading || !charts) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="h-64 flex items-center justify-center border-dashed">
          <span className="text-xs text-muted-foreground">Loading chart data...</span>
        </Card>
        <Card className="h-64 flex items-center justify-center border-dashed">
          <span className="text-xs text-muted-foreground">Loading chart data...</span>
        </Card>
      </div>
    );
  }

  const statusDistribution = charts.statusDistribution.filter((d) => d.value > 0);
  const expirationHorizon = charts.expirationHorizon;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Compliance Status Distribution Donut */}
      <Card className="border-border shadow-sm">
        <CardHeader className="p-4 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs sm:text-sm font-semibold">
              Fleet Compliance Distribution
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="h-48 w-full sm:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full sm:w-1/2 space-y-2">
            {charts.statusDistribution.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground">
                  {item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Expiration Horizon Bar Chart */}
      <Card className="border-border shadow-sm">
        <CardHeader className="p-4 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs sm:text-sm font-semibold">
              Hydrotest Expiration Horizon
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expirationHorizon} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="horizon"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {expirationHorizon.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
