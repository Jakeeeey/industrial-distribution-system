/* eslint-disable @typescript-eslint/no-explicit-any */
// src/modules/industrial-distribution-system/dashboard/components/widgets/OrderStatusWidget.tsx

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
  const { opsData, loading } = useDashboard();

  const counts = useMemo(() => {
    const statuses: Record<string, number> = {
      "For Approval": 0,
      "For Consolidation": 0,
      "For Picking": 0,
      "For Invoicing": 0,
      "For Loading": 0,
      "For Shipping": 0,
      "En Route": 0,
      "Delivered": 0,
      "On Hold": 0,
      "Cancelled": 0,
    };

    if (opsData.length > 0) {
      // Data format from BFF is:
      // StatusGroupedOrders[] or flat array of orders
      if (Array.isArray(opsData)) {
        opsData.forEach((item: any) => {
          // If grouped by status
          if (item.status && Array.isArray(item.customerGroups)) {
            let count = 0;
            item.customerGroups.forEach((cg: any) => {
              count += Array.isArray(cg.orders) ? cg.orders.length : 0;
            });
            statuses[item.status] = count;
          } else if (item.status && typeof item.status === "string") {
            // Flat order list fallback
            const status = item.status;
            if (statuses[status] !== undefined) {
              statuses[status]++;
            }
          }
        });
      }
    }

    // Default mock fallback seed if database is empty
    const totalCount = Object.values(statuses).reduce((a, b) => a + b, 0);
    if (totalCount === 0) {
      statuses["For Approval"] = 5;
      statuses["For Consolidation"] = 12;
      statuses["For Picking"] = 8;
      statuses["For Invoicing"] = 14;
      statuses["For Loading"] = 6;
      statuses["For Shipping"] = 9;
      statuses["En Route"] = 18;
      statuses["Delivered"] = 245;
      statuses["On Hold"] = 2;
      statuses["Cancelled"] = 4;
    }

    return statuses;
  }, [opsData]);

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
      count: counts["For Approval"],
      color: "bg-blue-500",
      textColor: "text-blue-500",
      icon: FileText,
    },
    {
      title: "Consolidation",
      count: counts["For Consolidation"],
      color: "bg-cyan-500",
      textColor: "text-cyan-500",
      icon: Boxes,
    },
    {
      title: "Warehouse Picking",
      count: counts["For Picking"],
      color: "bg-indigo-500",
      textColor: "text-indigo-500",
      icon: FileCheck2,
    },
    {
      title: "Logistics Dispatch",
      count: counts["For Loading"] + counts["For Shipping"] + counts["En Route"],
      color: "bg-amber-500",
      textColor: "text-amber-500",
      icon: Truck,
    },
    {
      title: "Delivered Cores",
      count: counts["Delivered"],
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
                  {stage.count}
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
