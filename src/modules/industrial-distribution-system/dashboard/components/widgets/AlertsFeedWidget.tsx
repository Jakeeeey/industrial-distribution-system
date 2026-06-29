// src/modules/industrial-distribution-system/dashboard/components/widgets/AlertsFeedWidget.tsx

"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { CriticalAlert } from "../../types";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle, Info, BellRing } from "lucide-react";

export const AlertsFeedWidget: React.FC = () => {
  const { rtoData, filters } = useDashboard();

  const alerts = useMemo((): CriticalAlert[] => {
    const list: CriticalAlert[] = [];
    const branchIdStr = String(filters.branchId);

    // 1. Gather high-risk customers from RTO data
    const filteredRto = branchIdStr === "all"
      ? rtoData
      : rtoData.filter((r) => String(r.branchId) === branchIdStr);

    filteredRto.forEach((r) => {
      if (r.missingStatus === "critical" && r.financialExposure > 500000) {
        list.push({
          id: `rto-exp-${r.customerCode}`,
          severity: "critical",
          message: `HIGH EXPOSURE: ${r.customerName} holds ${r.missingTanks} overdue cylinders. Net exposure: ₱${(r.financialExposure / 1000).toFixed(0)}K.`,
          timestamp: "Just now",
          category: "rto",
        });
      }
      if (r.unpaidBalance > 200000) {
        list.push({
          id: `fin-bal-${r.customerCode}`,
          severity: "warning",
          message: `OVER CREDIT LIMIT: ${r.customerName} has ₱${(r.unpaidBalance / 1000).toFixed(0)}K unpaid balances. Delivery on hold.`,
          timestamp: "10 mins ago",
          category: "finance",
        });
      }
    });

    // 2. Generic stock & system alerts fallback if list is short
    if (list.length < 3) {
      list.push({
        id: "inv-low-lpg",
        severity: "critical",
        message: "LOW STOCK WARNING: Industrial LPG 50kg stock (12) has fallen below reorder threshold (35).",
        timestamp: "5 mins ago",
        category: "inventory",
      });
      list.push({
        id: "ops-delay-dispatch",
        severity: "warning",
        message: "LATE DISPATCH: Trip PDP-000186 (Driver J. Ramos) is delayed in loading phase >30 mins.",
        timestamp: "15 mins ago",
        category: "operations",
      });
      list.push({
        id: "sys-failed-sync",
        severity: "info",
        message: "SYSTEM UPDATE: Directus collection 'subsystems' synced successfully with Spring ERP gateways.",
        timestamp: "1 hour ago",
        category: "system",
      });
    }

    // Sort: critical first, then warning, then info
    const priority = { critical: 3, warning: 2, info: 1 };
    return list.sort((a, b) => priority[b.severity] - priority[a.severity]);
  }, [rtoData, filters.branchId]);

  const getAlertStyle = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25";
      case "warning":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25";
      case "info":
      default:
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25";
    }
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <ShieldAlert className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />;
      case "warning":
        return <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />;
      case "info":
      default:
        return <Info className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex items-center gap-1.5 mb-3 border-b border-border/40 pb-2">
        <BellRing className="h-4 w-4 text-rose-500" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
          Critical Operational Notification Alerts
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start gap-3 border rounded-xl p-3 bg-muted/5 transition-all text-xs ${getAlertStyle(alert.severity)}`}
          >
            {getIcon(alert.severity)}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className={`text-[8px] font-bold py-0.5 px-1 bg-white/20 border-0 ${getAlertStyle(alert.severity)}`}>
                  {alert.category.toUpperCase()}
                </Badge>
                <span className="text-[9px] text-slate-400 font-medium font-mono">{alert.timestamp}</span>
              </div>
              <p className="mt-1 text-[11px] font-bold leading-normal text-foreground/95 select-text">
                {alert.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
