// src/modules/industrial-distribution-system/dashboard/components/widgets/OrderStatusWidget.tsx
// NOTE: Replaced hardcoded fallback counts with live orderStatusData from useDashboard context.

"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Boxes,
  Truck,
  CheckCircle,
  FileCheck2,
} from "lucide-react";

export const OrderStatusWidget: React.FC = () => {
  const { orderStatusData, loading } = useDashboard();

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 h-full items-center">
        {Array.from({ length: 4 }).map((_, i) => (
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
    <div className="flex flex-col h-full justify-between">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
        CRM Sales Order Operations Pipeline
      </span>

      {/* Pipeline stage cards: 1-col on mobile → 2-col on sm → 5-col on md+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 flex-1 items-center">
        {pipelineStages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div
              key={idx}
              className="flex flex-col justify-between border border-border/40 rounded-xl p-3.5 bg-muted/5 relative overflow-hidden h-full min-h-[90px]"
            >
              {/* Top Accent Line */}
              <div className={`absolute top-0 inset-x-0 h-1 ${stage.color}`} />
              <div className="flex items-center justify-between">
                <Icon className={`h-4.5 w-4.5 ${stage.textColor}`} />
                <span className="text-xl font-black text-foreground">
                  {stage.count.toLocaleString()}
                </span>
              </div>
              <div className="mt-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 block">
                  {stage.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
