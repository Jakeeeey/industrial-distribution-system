// src/modules/industrial-distribution-system/dashboard/components/widgets/LowStockAlertWidget.tsx
// NOTE: Replaced hardcoded stock warnings list with live data from useDashboard context.

"use client";

import React from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowDown } from "lucide-react";

export const LowStockAlertWidget: React.FC = () => {
  const { lowStock, loading } = useDashboard();

  if (loading) {
    return (
      <div className="flex flex-col h-full justify-between p-2">
        <Skeleton className="h-4 w-1/3 mb-4" />
        <div className="space-y-3 flex-1">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-between">
      {/* <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-3">
        Inventory Threshold Warnings
      </span> */}

      <div className="flex-1 space-y-2.5 overflow-y-auto custom-scrollbar">
        {lowStock.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No items are currently below their reorder limits.
          </div>
        ) : (
          lowStock.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between border border-border/40 rounded-xl p-3 bg-muted/5 transition-all"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5
                  ${item.status === "Critical" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}
                >
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-foreground block truncate">
                    {item.productName}
                  </span>
                  <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                    {item.productCode} • {item.category}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 pl-3">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className={`text-xs font-black font-mono flex items-center ${item.status === "Critical" ? "text-red-500" : "text-amber-500"}`}>
                    <ArrowDown className="h-3 w-3 mr-0.5 animate-bounce" />
                    {item.stockOnHand}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">
                    / {item.reorderPoint} Limit
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[8px] font-bold py-0 px-1.5 mt-1 border
                    ${item.status === "Critical" ? "border-red-500/25 bg-red-500/10 text-red-500" : "border-amber-500/25 bg-amber-500/10 text-amber-500"}`}
                >
                  {item.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
