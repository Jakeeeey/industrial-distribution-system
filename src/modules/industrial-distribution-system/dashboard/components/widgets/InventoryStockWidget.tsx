// src/modules/industrial-distribution-system/dashboard/components/widgets/InventoryStockWidget.tsx
// NOTE: Replaced hardcoded status ratios with live aggregates from useDashboard context.

"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";

export const InventoryStockWidget: React.FC = () => {
  const { cylinderStock, loading } = useDashboard();

  const totalStock = useMemo(() => {
    if (!cylinderStock) return 0;
    return cylinderStock.reduce((a, b) => a + b.value, 0);
  }, [cylinderStock]);

  if (loading || !cylinderStock) {
    return (
      <div className="flex flex-col h-full justify-between p-2">
        <Skeleton className="h-4 w-1/3 mb-4" />
        <div className="flex items-center gap-4 flex-1">
          <Skeleton className="h-20 w-20 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-between">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
        Cylinder Inventory Allocation Status
      </span>

      <div className="flex-1 w-full min-h-[140px] flex items-center justify-between">
        <div className="w-[130px] h-[130px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartTooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 10px",
                }}
                itemStyle={{ color: "#ffffff", fontSize: "10px" }}
              />
              <Pie
                data={cylinderStock}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={3}
                dataKey="value"
              >
                {cylinderStock.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Custom Legends & Details */}
        <div className="flex-1 pl-4 space-y-1.5 self-center">
          {cylinderStock.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-400 font-bold truncate">{item.name}</span>
              </div>
              <span className="font-mono text-foreground font-black text-right pl-2">
                {item.value.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="border-t border-border/40 pt-1.5 mt-2 flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            <span>Total Asset Pool</span>
            <span className="font-mono text-foreground text-right">{totalStock.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
