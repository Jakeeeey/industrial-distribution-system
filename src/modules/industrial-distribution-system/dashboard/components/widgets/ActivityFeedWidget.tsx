// src/modules/industrial-distribution-system/dashboard/components/widgets/ActivityFeedWidget.tsx

"use client";

import React, { useMemo } from "react";
import { ActivityLog } from "../../types";


export const ActivityFeedWidget: React.FC = () => {
  const activities = useMemo((): ActivityLog[] => {
    return [
      {
        id: "act-1",
        timestamp: "10:35 AM",
        type: "success",
        message: "Sales Order SO-000152 Approved & forwarded to Warehouse Consolidation.",
        module: "CRM",
      },
      {
        id: "act-2",
        timestamp: "10:15 AM",
        type: "info",
        message: "Dispatch Plan PDP-000186 started loading at Pasig Central Warehouse.",
        module: "SCM",
      },
      {
        id: "act-3",
        timestamp: "09:50 AM",
        type: "success",
        message: "Customer ABC Construction paid Sales Invoice SI-000481 (₱1,250,000).",
        module: "Finance",
      },
      {
        id: "act-4",
        timestamp: "09:42 AM",
        type: "success",
        message: "Cylinder recovery logged: 12 empty cylinders returned from Shellane Cavite.",
        module: "RTO Operations",
      },
      {
        id: "act-5",
        timestamp: "08:30 AM",
        type: "warning",
        message: "Inventory discrepancy reported in Warehouse B (Product: Regulator A1, -2 units).",
        module: "SCM Inventory",
      },
    ];
  }, []);

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

  return (
    <div className="flex flex-col h-full justify-between">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-3">
        Live Operations Activity Audit Feed
      </span>

      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar relative pl-3.5 border-l border-border/40">
        {activities.map((log) => (
          <div key={log.id} className="relative group select-text">
            {/* Timeline bullet node */}
            <div className={`absolute -left-[18.5px] top-1.5 h-2 w-2 rounded-full ring-4 ring-background ${getLogColor(log.type)}`} />
            
            <div className="text-[11px] leading-relaxed">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-muted-foreground font-semibold">
                  {log.timestamp}
                </span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-900/5 dark:bg-white/5 border border-border/40 px-1 rounded-sm">
                  {log.module}
                </span>
              </div>
              <p className="mt-0.5 text-foreground/90 font-medium font-sans">
                {log.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
