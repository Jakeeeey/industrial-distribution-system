// src/modules/industrial-distribution-system/dashboard/components/widgets/InventoryStockWidget.tsx

"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from "recharts";


export const InventoryStockWidget: React.FC = () => {
  const { filters } = useDashboard();

  // Mock cylinder data based on branches
  const stockData = useMemo(() => {
    const branch = filters.branchId;

    // Adjust ratios slightly depending on branch selected to look dynamic
    let filled = 1450;
    let empty = 820;
    let transit = 340;
    let repair = 75;

    if (branch === "1") {
      filled = 650;
      empty = 410;
      transit = 120;
      repair = 30;
    } else if (branch === "2") {
      filled = 480;
      empty = 260;
      transit = 150;
      repair = 25;
    } else if (branch === "3") {
      filled = 320;
      empty = 150;
      transit = 70;
      repair = 20;
    }

    return [
      { name: "Filled Cylinders", value: filled, color: "#06b6d4" }, // Cyan
      { name: "Empty Cylinders", value: empty, color: "#94a3b8" }, // Slate
      { name: "Cylinders In Transit", value: transit, color: "#f59e0b" }, // Amber
      { name: "Under Repair", value: repair, color: "#ef4444" }, // Red
    ];
  }, [filters.branchId]);

  const totalStock = useMemo(() => {
    return stockData.reduce((a, b) => a + b.value, 0);
  }, [stockData]);

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
                data={stockData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={3}
                dataKey="value"
              >
                {stockData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Custom Legends & Details */}
        <div className="flex-1 pl-4 space-y-1.5 self-center">
          {stockData.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-400 font-bold truncate">{item.name}</span>
              </div>
              <span className="font-mono font-extrabold text-foreground ml-2">
                {item.value.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="border-t border-border/40 pt-1.5 mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
            <span className="text-slate-400">Total Asset Pool</span>
            <span className="text-primary font-black">{totalStock.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
