// src/modules/industrial-distribution-system/dashboard/components/widgets/SalesPerformanceWidget.tsx

"use client";

import React, { useMemo } from "react";
import { formatCurrency, formatPercent } from "../../utils/kpiCalculations";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";

export const SalesPerformanceWidget: React.FC = () => {
  // Mock monthly target and revenue metrics for dashboard visualization
  const targetAmount = 60000000;
  const actualAmount = 54250000;
  const progressPercent = (actualAmount / targetAmount) * 100;

  // Daily revenue tracking data
  const revenueTrendData = useMemo(() => {
    return [
      { day: "Jun 01", sales: 1200000 },
      { day: "Jun 05", sales: 1550000 },
      { day: "Jun 10", sales: 2450000 },
      { day: "Jun 15", sales: 1800000 },
      { day: "Jun 20", sales: 3200000 },
      { day: "Jun 25", sales: 2840000 },
      { day: "Jun 29", sales: 4100000 },
    ];
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full items-center justify-between">
      {/* Target Gauge Indicator */}
      <div className="flex flex-col items-center justify-center p-3 border border-border/40 rounded-xl bg-muted/5 w-full lg:w-[180px] shrink-0 text-center relative overflow-hidden">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-2">
          Monthly Revenue Target
        </span>
        
        {/* Visual Progress ring */}
        <div className="relative h-20 w-20 flex items-center justify-center">
          <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-muted-foreground/15 fill-transparent"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-indigo-500 fill-transparent"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - progressPercent / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="text-center select-none">
            <span className="text-lg font-black text-foreground">{formatPercent(progressPercent)}</span>
          </div>
        </div>

        <div className="mt-3">
          <span className="text-[10px] text-muted-foreground block font-bold">
            Actual: {formatCurrency(actualAmount)}
          </span>
          <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">
            Goal: {formatCurrency(targetAmount)}
          </span>
        </div>
      </div>

      {/* Revenue Trend Area Chart */}
      <div className="flex-1 w-full flex flex-col justify-between self-stretch">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-2 px-1">
          Daily Revenue Trend - Current Month
        </span>

        <div className="flex-1 w-full min-h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueTrendData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" cx="50%" cy="50%" r="50%">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(224, 224, 224, 0.15)" />
              <XAxis
                dataKey="day"
                stroke="#888888"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                fontFamily="monospace"
                fontWeight="bold"
              />
              <YAxis
                stroke="#888888"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                fontFamily="monospace"
                tickFormatter={(val) => `₱${(val / 1000000).toFixed(1)}M`}
              />
              <ChartTooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 12px",
                }}
                labelStyle={{ color: "#ffffff", fontSize: "11px", fontWeight: "bold" }}
                itemStyle={{ color: "#a5f3fc", fontSize: "11px" }}
                formatter={(val: number) => [formatCurrency(val), "Revenue"]}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSales)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
