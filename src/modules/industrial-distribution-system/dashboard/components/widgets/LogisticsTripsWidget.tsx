// src/modules/industrial-distribution-system/dashboard/components/widgets/LogisticsTripsWidget.tsx

"use client";

import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Truck, User, Navigation, AlertTriangle } from "lucide-react";


export const LogisticsTripsWidget: React.FC = () => {
  const activeDispatches = useMemo(() => {
    return [
      {
        dispatchNo: "PDP-000185",
        driverName: "D. de Castro",
        vehiclePlate: "WUA-745 (6T Truck)",
        route: "Pasig ➔ Valenzuela Hub",
        status: "In Transit",
        time: "Started 42 mins ago",
        priority: "High",
      },
      {
        dispatchNo: "PDP-000186",
        driverName: "J. Ramos",
        vehiclePlate: "XET-902 (4T Truck)",
        route: "Pasig ➔ Makati Dealers",
        status: "Loading",
        time: "Loading since 10:15 AM",
        priority: "Normal",
      },
      {
        dispatchNo: "PDP-000184",
        driverName: "M. Santos",
        vehiclePlate: "YRE-384 (10T Truck)",
        route: "Batangas Refill ➔ Pasig",
        status: "Delivered",
        time: "Completed at 09:40 AM",
        priority: "Critical",
      },
      {
        dispatchNo: "PDP-000187",
        driverName: "R. Del Rosario",
        vehiclePlate: "TRK-582 (6T Truck)",
        route: "Pasig ➔ Quezon City RTOs",
        status: "Pending",
        time: "Scheduled at 11:30 AM",
        priority: "Normal",
      },
    ];
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Transit":
        return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/35";
      case "Loading":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/35";
      case "Delivered":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/35";
      case "Pending":
      default:
        return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/35";
    }
  };

  return (
    <div className="flex flex-col h-full justify-between">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-3">
        Active Logistics & Dispatch Fleet Logs
      </span>

      <div className="flex-1 space-y-2.5 overflow-y-auto custom-scrollbar">
        {activeDispatches.map((dispatch, idx) => (
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
                <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                  <Navigation className="h-2.5 w-2.5" />
                  {dispatch.route}
                </div>
              </div>
            </div>

            <div className="text-right">
              <Badge variant="outline" className={`text-[9px] font-bold py-0.5 px-2 ${getStatusColor(dispatch.status)}`}>
                {dispatch.status}
              </Badge>
              <span className="text-[9px] text-slate-400 block mt-1.5 font-medium leading-none">
                {dispatch.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
