// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationCharts.tsx
// ==============================================================================
// Visual Analytics & Recharts Charts for Cylinder Utilization Report.
// Displays:
//   1. Fleet Status Composition (Interactive Donut Chart with Status Breakdown)
//   2. Branch Utilization Comparison (Bar Chart with Benchmark)
//   3. Cylinder Allocation by Branch (Stacked Bar Chart: Customer, Yard, Idle, Repair)
//   4. Utilization by Cylinder Size / Product Description (Horizontal / Vertical Bar Chart)
//
// Complies with VoSync Design System standards:
// - Seamless theme integration (Tailwind tokens & dark mode safe)
// - Smooth Framer Motion transitions
// - Informative tooltips and accessible legends
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
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
  ReferenceLine,
} from "recharts";
import {

  PieChart as PieChartIcon,
  TrendingUp,
  Building2,
  Layers,
  AlertCircle,
} from "lucide-react";
import { useCylinderUtilizationReport } from "../hooks/useCylinderUtilizationReport";
import { formatCount, formatPercent } from "../services";

// Palette matching VoSync category badge tokens
const STATUS_COLORS: Record<string, string> = {
  "Circulating": "#10b981", // emerald-500
  "Available": "#3b82f6",  // blue-500
  "Idle": "#f59e0b",   // amber-500
  "For Repair": "#8b5cf6",   // violet-500
  "Scrap": "#64748b", // slate-500
  "Needs Review": "#ef4444",   // red-500
};

export function UtilizationCharts() {
  const { reportData, isLoading } = useCylinderUtilizationReport();

  if (isLoading || !reportData) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-80 animate-pulse rounded-xl border bg-card p-4">
            <div className="mb-4 h-4 w-40 rounded bg-muted" />
            <div className="h-60 w-full rounded bg-muted/60" />
          </div>
        ))}
      </div>
    );
  }

  const { kpis, rows } = reportData;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 text-center shadow-2xs">
        <AlertCircle className="mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="text-base font-bold text-foreground">No data for graphical analysis</h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Adjust the branch or cylinder size filters above to visualize fleet metrics.
        </p>
      </div>
    );
  }

  // ── 1. Status Composition Data (Donut Chart) ──────────────────────────────
  const statusData = [
    { name: "Circulating", value: kpis.circulating, color: STATUS_COLORS["Circulating"] },
    { name: "Available", value: kpis.available, color: STATUS_COLORS["Available"] },
    { name: "Idle", value: kpis.idle, color: STATUS_COLORS["Idle"] },
    { name: "For Repair", value: kpis.maintenance, color: STATUS_COLORS["For Repair"] },
    { name: "Scrap", value: kpis.unavailable, color: STATUS_COLORS["Scrap"] },
    ...(kpis.unclassified > 0
      ? [{ name: "Needs Review", value: kpis.unclassified, color: STATUS_COLORS["Needs Review"] }]
      : []),
  ].filter((item) => item.value > 0);

  // ── 2. Aggregations by Branch ─────────────────────────────────────────────
  const branchMap = new Map<
    string,
    {
      name: string;
      total: number;
      eligible: number;
      circulating: number;
      available: number;
      idle: number;
      maintenance: number;
    }
  >();

  rows.forEach((row) => {
    const branch = row.branchName || "Unassigned";
    const existing = branchMap.get(branch) || {
      name: branch,
      total: 0,
      eligible: 0,
      circulating: 0,
      available: 0,
      idle: 0,
      maintenance: 0,
    };
    existing.total += row.fleet;
    existing.eligible += row.eligibleFleet;
    existing.circulating += row.circulating;
    existing.available += row.available;
    existing.idle += row.idle;
    existing.maintenance += row.maintenance;
    branchMap.set(branch, existing);
  });

  const branchData = Array.from(branchMap.values())
    .map((b) => ({
      ...b,
      utilization: b.eligible > 0 ? Math.round((b.circulating / b.eligible) * 1000) / 10 : 0,
      idleRate: b.eligible > 0 ? Math.round((b.idle / b.eligible) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.utilization - a.utilization);

  // ── 3. Aggregations by Cylinder Size (Product Description) ─────────────────
  const sizeMap = new Map<
    string,
    {
      name: string;
      total: number;
      eligible: number;
      circulating: number;
      available: number;
      idle: number;
    }
  >();

  rows.forEach((row) => {
    const size = row.sizeLabel || "Unmapped";
    const existing = sizeMap.get(size) || {
      name: size,
      total: 0,
      eligible: 0,
      circulating: 0,
      available: 0,
      idle: 0,
    };
    existing.total += row.fleet;
    existing.eligible += row.eligibleFleet;
    existing.circulating += row.circulating;
    existing.available += row.available;
    existing.idle += row.idle;
    sizeMap.set(size, existing);
  });

  const sizeData = Array.from(sizeMap.values())
    .map((s) => ({
      ...s,
      utilization: s.eligible > 0 ? Math.round((s.circulating / s.eligible) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10); // top 10 sizes for clean layout

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Chart 1: Fleet Status Distribution ───────────────────────── */}
        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <PieChartIcon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Fleet Status Composition
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Proportion of total registered cylinders across categories
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-foreground">
              {formatCount(kpis.totalFleet)} Total
            </span>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number, name: string) => [
                    `${formatCount(val)} cylinders (${Math.round((Number(val) / kpis.totalFleet) * 1000) / 10}%)`,
                    String(name),
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-[11px] font-medium text-foreground">{value}</span>
                  )}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Chart 2: Branch Utilization Comparison ──────────────────── */}
        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Branch Utilization Rate (%)
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Percentage of active working cylinders currently earning with customers
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {formatPercent(kpis.utilization)} Fleet Avg
            </span>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={branchData}
                margin={{ top: 10, right: 15, left: -20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  interval={0}
                  height={70}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <ReferenceLine y={70} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Target 70%", position: "top", fill: "#10b981", fontSize: 10 }} />
                <Tooltip
                  formatter={(val: number, _name: string, item: { payload?: { circulating?: number; eligible?: number } }) => {
                    // AG-COMMENT: Type-safe tooltip payload extraction without using any
                    const circulating = item.payload?.circulating ?? 0;
                    const eligible = item.payload?.eligible ?? 0;
                    return [
                      `${val}% (${formatCount(circulating)} / ${formatCount(eligible)} active cylinders)`,
                      "Utilization",
                    ];
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="utilization" name="Utilization %" radius={[4, 4, 0, 0]}>
                  {branchData.map((entry, index) => {
                    const color =
                      entry.utilization >= 70
                        ? "#10b981"
                        : entry.utilization >= 40
                          ? "#f59e0b"
                          : "#ef4444";
                    return <Cell key={`branch-cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Chart 3: Cylinder Allocation by Branch (Stacked) ───────── */}
        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Cylinder Fleet Allocation by Branch
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Active cylinder distribution: Customer, Ready Yard, Idle, Repair
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-foreground">
              {formatCount(kpis.eligibleFleet)} Active Fleet
            </span>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={branchData}
                margin={{ top: 10, right: 15, left: -10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  interval={0}
                  height={70}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: "12px",
                  }}
                />
                {/* AG-COMMENT: Positioned Legend at top right to eliminate overlap with bottom branch names */}
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: "12px" }}
                  formatter={(value: string) => (
                    <span className="text-[11px] font-medium text-foreground">{value}</span>
                  )}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="circulating" name="Circulating" stackId="a" fill="#10b981" />
                <Bar dataKey="available" name="Available" stackId="a" fill="#3b82f6" />
                <Bar dataKey="idle" name="Idle" stackId="a" fill="#f59e0b" />
                <Bar dataKey="maintenance" name="For Repair" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Chart 4: Utilization by Product Description ──────────────── */}
        <div className="rounded-xl border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Utilization by Cylinder Product Description
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Deployment efficiency across serialized cylinder products
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-foreground">
              Top {sizeData.length} Products
            </span>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sizeData}
                margin={{ top: 10, right: 15, left: -20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  interval={0}
                  height={85}
                  angle={-28}
                  textAnchor="end"
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <Tooltip
                  formatter={(val: number, _name: string, item: { payload?: { circulating?: number; eligible?: number } }) => {
                    // AG-COMMENT: Type-safe tooltip payload extraction without using any
                    const circulating = item.payload?.circulating ?? 0;
                    const eligible = item.payload?.eligible ?? 0;
                    return [
                      `${val}% (${formatCount(circulating)} / ${formatCount(eligible)} cylinders)`,
                      "Utilization",
                    ];
                  }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="utilization" name="Utilization %" fill="#2563eb" radius={[4, 4, 0, 0]}>
                  {sizeData.map((entry, index) => {
                    const color =
                      entry.utilization >= 70
                        ? "#10b981"
                        : entry.utilization >= 40
                          ? "#3b82f6"
                          : "#f59e0b";
                    return <Cell key={`size-cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}