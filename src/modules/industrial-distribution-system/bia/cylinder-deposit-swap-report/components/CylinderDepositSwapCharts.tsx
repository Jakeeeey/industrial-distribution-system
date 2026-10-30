// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/components/CylinderDepositSwapCharts.tsx
// ==============================================================================
// Visual Analytics & Recharts Charts for Cylinder Deposit and Swap Report.
// Displays:
//   1. Deposit vs. Swap Movement Trends (Composed Bar & Area Chart)
//   2. Customer Base Distribution by Product Capacity (Interactive Donut Chart)
// ==============================================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "recharts";
import { TrendingUp, PieChart as PieChartIcon } from "lucide-react";
import { useCylinderDepositSwapReport } from "../hooks/useCylinderDepositSwapReport";

const DONUT_COLORS = [
  "#2563eb", // blue-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
  "#0891b2", // cyan-600
];

export function CylinderDepositSwapCharts() {
  const { report, isLoading } = useCylinderDepositSwapReport();

  const trends = report?.trends || [];
  // AG-COMMENT: Strictly filter active base distribution to serialized cylinder products with active physical units (> 0)
  const productDistribution = (report?.productDistribution || []).filter((p) => p.quantity > 0);

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        // AG-COMMENT: Framer Motion animated skeleton placeholder while charts data is being retrieved
        <motion.div
          key="charts-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          <div className="lg:col-span-2 rounded-xl border bg-card p-4 shadow-2xs h-[320px] animate-pulse flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Loading trend visualizations...</span>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-2xs h-[320px] animate-pulse flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Loading distribution...</span>
          </div>
        </motion.div>
      ) : !report || report.rows.length === 0 ? null : (
        // AG-COMMENT: Smooth entrance for populated graphical analytics
        <motion.div
          key="charts-content"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
      {/* ── Left 2 Columns: Movement Trends ──────────────────────────────────── */}
      <div className="lg:col-span-2 rounded-xl border bg-card p-4 shadow-2xs text-card-foreground">
        <div className="flex items-center justify-between border-b pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Deposit vs. Swap Activity Trends</h2>
              <p className="text-xs text-muted-foreground">
                Period comparison of new deposits issued vs. empty cylinder returns
              </p>
            </div>
          </div>

        </div>

        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="formattedDate" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              {/* AG-COMMENT: Fixed transparent tooltip background by using hsl(var(--popover)) compatible with Tailwind CSS tokens */}
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  borderColor: "hsl(var(--border))",
                  color: "hsl(var(--popover-foreground))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                  padding: "8px 12px",
                }}
                itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Bar dataKey="deposits" name="New Deposits (+)" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="swapsIn" name="Swaps Collected (Empty)" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="swapsOut" name="Swaps Delivered (Full)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Right Column: Product Breakdown Donut ────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4 shadow-2xs text-card-foreground">
        <div className="flex items-center gap-2 border-b pb-3 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
            <PieChartIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Active Base by Product</h2>
            <p className="text-xs text-muted-foreground">Proportion of cylinder capacities</p>
          </div>
        </div>

        <div className="h-[200px] w-full">
          {productDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productDistribution}
                  dataKey="quantity"
                  nameKey="productName"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {productDistribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                    />
                  ))}
                </Pie>
                {/* AG-COMMENT: Fixed transparent tooltip background by using hsl(var(--popover)) compatible with Tailwind CSS tokens */}
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--popover-foreground))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                    padding: "8px 12px",
                  }}
                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 600 }}
                  formatter={(val, name) => [`${val} units`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No product breakdown data
            </div>
          )}
        </div>

        {/* Custom Legend */}
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs max-h-[70px] overflow-y-auto">
          {productDistribution.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 truncate">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-xs"
                style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
              />
              <span className="truncate text-muted-foreground">{item.productName}</span>
              <span className="font-semibold text-foreground ml-auto">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )}
</AnimatePresence>
  );
}
