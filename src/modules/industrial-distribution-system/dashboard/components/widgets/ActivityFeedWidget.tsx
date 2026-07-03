// src/modules/industrial-distribution-system/dashboard/components/widgets/ActivityFeedWidget.tsx
// NOTE: Replaced hardcoded array with live database view logs fetched from useDashboard context.
// Formats timestamps dynamically and resolves bullet colors from the type field.

"use client";

import React from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { Skeleton } from "@/components/ui/skeleton";

export const ActivityFeedWidget: React.FC = () => {
  const { activityLogs, loading } = useDashboard();

  const getLogColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-emerald-500 text-emerald-500";
      case "warning":
        return "bg-amber-500 text-amber-500";
      case "error":
        return "bg-red-500 text-red-500";
      case "info":
      default:
        return "bg-blue-500 text-blue-500";
    }
  };

  const formatTimestamp = (timeStr: string) => {
    if (!timeStr) return "Just now";
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;

      // Check if it's today
      const today = new Date();
      const isToday =
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();

      if (isToday) {
        return d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      } else {
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }) + " " + d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      }
    } catch {
      return timeStr;
    }
  };

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
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-3">
        Live Operations Activity Audit Feed
      </span>

      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar relative pl-3.5 border-l border-border/40">
        {activityLogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No activity logs found for this branch.
          </div>
        ) : (
          activityLogs.map((log) => (
            <div key={log.id} className="relative group select-text">
              {/* Timeline bullet node */}
              <div className={`absolute -left-[18.5px] top-1.5 h-2 w-2 rounded-full ring-4 ring-background ${getLogColor(log.type)}`} />
              
              <div className="text-[11px] leading-relaxed">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted-foreground font-semibold">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-900/5 dark:bg-white/5 border border-border/40 px-1 rounded-sm">
                    {log.module || "System"}
                  </span>
                </div>
                <p className="mt-0.5 text-foreground/90 font-medium font-sans">
                  {log.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
