// src/modules/industrial-distribution-system/dashboard/components/widgets/OrderStatusWidget.tsx
// NOTE: Replaced hardcoded fallback counts with live orderStatusData from useDashboard context.

"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetLayout } from "../../types";
import { cn } from "@/lib/utils";
import {
  FileText,
  Boxes,
  Truck,
  CheckCircle,
  FileCheck2,
} from "lucide-react";

export const OrderStatusWidget: React.FC<{ layout?: WidgetLayout }> = ({ layout }) => {
  const { orderStatusData, loading } = useDashboard();

  const w = layout?.w ?? 12;
  const cols = w >= 10 ? 5 : (w >= 6 ? 3 : (w >= 3 ? 2 : 1));
  const rows = Math.ceil(5 / cols);

  // Convert flat array to lookup map: { status → count }
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    orderStatusData.forEach(({ status, count }) => {
      map[status] = count;
    });
    return map;
  }, [orderStatusData]);

  if (loading) {
    return (
      <div 
        className="grid gap-2 flex-1 items-center min-h-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border border-border/30 rounded-xl p-3 bg-muted/5 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const pipelineStages = [
    {
      title: "Draft/Approval",
      // Combine Draft + Pending + For Approval into the first column
      count: (counts["Draft"] ?? 0) + (counts["Pending"] ?? 0) + (counts["For Approval"] ?? 0),
      color: "bg-blue-500",
      textColor: "text-blue-500",
      icon: FileText,
    },
    {
      title: "Consolidation",
      count: counts["For Consolidation"] ?? 0,
      color: "bg-cyan-500",
      textColor: "text-cyan-500",
      icon: Boxes,
    },
    {
      title: "Warehouse Picking",
      count: (counts["For Picking"] ?? 0) + (counts["For Invoicing"] ?? 0),
      color: "bg-indigo-500",
      textColor: "text-indigo-500",
      icon: FileCheck2,
    },
    {
      title: "Logistics Dispatch",
      count: (counts["For Loading"] ?? 0) + (counts["For Shipping"] ?? 0) + (counts["En Route"] ?? 0),
      color: "bg-amber-500",
      textColor: "text-amber-500",
      icon: Truck,
    },
    {
      title: "Delivered Cores",
      count: counts["Delivered"] ?? 0,
      color: "bg-emerald-500",
      textColor: "text-emerald-500",
      icon: CheckCircle,
    },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full justify-between">
      {/* <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-2 shrink-0">
        CRM Sales Order Operations Pipeline
      </span> */}

      <div 
        className="grid gap-2 flex-1 min-h-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {pipelineStages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div
              key={idx}
              className="flex items-center justify-between border border-border/40 rounded-xl px-2.5 py-2 bg-muted/5 relative overflow-hidden min-h-[42px] h-full transition-all hover:bg-muted/10"
            >
              {/* Top Accent Line */}
              <div className={`absolute top-0 inset-x-0 h-[3px] ${stage.color}`} />
              
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-1.5">
                <div className="p-1 rounded bg-muted/20 shrink-0">
                  <Icon className={cn("h-3.5 w-3.5", stage.textColor)} />
                </div>
                <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground block truncate">
                  {stage.title}
                </span>
              </div>
              
              <span className="font-mono text-xs font-black text-foreground shrink-0 select-all">
                {stage.count.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
