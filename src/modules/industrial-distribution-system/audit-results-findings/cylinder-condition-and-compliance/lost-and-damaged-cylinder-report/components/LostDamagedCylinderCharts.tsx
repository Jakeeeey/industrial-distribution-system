// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/components/LostDamagedCylinderCharts.tsx
// ==============================================================================
// Charts Component for Lost and Damaged Cylinder Report
// Visualizes category distribution (Donut) and monthly financial impact (Bar).
// Built with Recharts and styled for dark & light mode responsiveness.
// ==============================================================================

"use client";

import * as React from "react";
import { useLostDamagedCylinder } from "../providers/LostDamagedCylinderProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { PieChart as PieIcon, TrendingUp } from "lucide-react";

export function LostDamagedCylinderCharts() {
  const { report, isLoading } = useLostDamagedCylinder();

  const incidentData = report?.charts?.incidentDistribution || [];
  const trendData = report?.charts?.monthlyTrend || [];

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `₱${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `₱${(val / 1_000).toFixed(0)}k`;
    return `₱${val}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
      {/* Chart 1: Donut Distribution */}
      <Card className="lg:col-span-5 border border-border shadow-sm bg-card">
        <CardHeader className="py-3 px-4 border-b border-border/60">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-primary" />
            <span>Incident Status & Condition Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-56 w-full flex items-center justify-center">
            {isLoading ? (
              <div className="text-xs text-muted-foreground animate-pulse">Loading visual breakdown...</div>
            ) : incidentData.every((d) => d.value === 0) ? (
              <div className="text-xs text-muted-foreground">No incident data to display</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incidentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {incidentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                    }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 500 }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 600 }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(val) => <span className="text-[11px] text-foreground">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chart 2: Monthly Financial Impact Trend */}
      <Card className="lg:col-span-7 border border-border shadow-sm bg-card">
        <CardHeader className="py-3 px-4 border-b border-border/60">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span>Assessed Loss vs Recovered Asset Value (Monthly)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="h-56 w-full">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground animate-pulse">
                Loading financial trends...
              </div>
            ) : trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No monthly trends for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: number) => [`₱${val.toLocaleString()}`, ""]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                    }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 500 }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 600 }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(val) => <span className="text-[11px] text-foreground">{val}</span>}
                  />
                  <Bar dataKey="lossValue" name="Loss Value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="recoveredValue"
                    name="Recovered Value"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
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
