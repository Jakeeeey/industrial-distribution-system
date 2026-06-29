// src/modules/industrial-distribution-system/dashboard/components/widgets/LogisticsTripsWidget.tsx
// NOTE: Replaced hardcoded arrays with live data from useDashboard context.

"use client";

import React from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, User, AlertTriangle } from "lucide-react";

export const LogisticsTripsWidget: React.FC = () => {
  const { activeDispatches, loading } = useDashboard();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Dispatched":
      case "Picked":
        return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/35";
      case "Picking":
      case "Approved":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/35";
      case "Rejected":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/35";
      case "Pending":
      default:
        return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/35";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full justify-between p-2">
        <Skeleton className="h-4 w-1/3 mb-4" />
        <div className="space-y-3 flex-1">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-between">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-3">
        Active Logistics & Dispatch Fleet Logs
      </span>

      <div className="flex-1 space-y-2.5 overflow-y-auto custom-scrollbar">
        {activeDispatches.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No active dispatch plans found for this branch.
          </div>
        ) : (
          activeDispatches.map((dispatch, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between border border-border/40 hover:border-border/80 rounded-xl p-3 bg-muted/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="bg-slate-900/5 dark:bg-white/5 border border-border/50 p-2 rounded-lg">
                  <Truck className="h-4.5 w-4.5 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-foreground">
                      {dispatch.dispatchNo}
                    </span>
                    {dispatch.priority === "Critical" && (
                      <Badge variant="outline" className="text-[8px] border-red-500/30 bg-red-500/10 text-red-500 py-0 px-1 font-bold">
                        <AlertTriangle className="h-2 w-2 mr-1" />
                        CRITICAL
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span className="flex items-center gap-1 font-semibold">
                      <User className="h-3 w-3" />
                      {dispatch.driverName}
                    </span>
                    <span>•</span>
                    <span className="font-mono">{dispatch.vehiclePlate}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 pl-3">
                <span className="text-[10px] text-slate-400 block font-mono font-medium">
                  {dispatch.time}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[8px] font-bold py-0 px-1.5 mt-1 border ${getStatusColor(dispatch.status)}`}
                >
                  {dispatch.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
