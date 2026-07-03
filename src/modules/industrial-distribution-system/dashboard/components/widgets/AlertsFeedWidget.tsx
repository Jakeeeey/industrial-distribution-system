// src/modules/industrial-distribution-system/dashboard/components/widgets/AlertsFeedWidget.tsx
// NOTE: Replaced hardcoded static fallback alerts with synthesized live alerts from context states.
// Sources: lowStock → inventory alerts, activeDispatches → late dispatch warnings, rtoData → exposure alerts.

"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../../providers/DashboardProvider";
import { CriticalAlert } from "../../types";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle, Info, BellRing, CheckCircle } from "lucide-react";

export const AlertsFeedWidget: React.FC = () => {
  const { rtoData, lowStock, activeDispatches, filters } = useDashboard();

  const alerts = useMemo((): CriticalAlert[] => {
    const list: CriticalAlert[] = [];
    const branchIdStr = String(filters.branchId);

    // ── 1. RTO high-risk customer alerts ─────────────────────────────────────
    const filteredRto = branchIdStr === "all"
      ? rtoData
      : rtoData.filter((r) => String(r.branchId) === branchIdStr);

    filteredRto.forEach((r) => {
      if (r.missingStatus === "critical" && r.financialExposure > 500000) {
        list.push({
          id: `rto-exp-${r.customerCode}`,
          severity: "critical",
          message: `HIGH EXPOSURE: ${r.customerName} holds ${r.missingTanks} overdue cylinders. Net exposure: ₱${(r.financialExposure / 1000).toFixed(0)}K.`,
          timestamp: "Live",
          category: "rto",
        });
      }
      if (r.unpaidBalance > 200000) {
        list.push({
          id: `fin-bal-${r.customerCode}`,
          severity: "warning",
          message: `OVER CREDIT LIMIT: ${r.customerName} has ₱${(r.unpaidBalance / 1000).toFixed(0)}K unpaid balances. Delivery on hold.`,
          timestamp: "Live",
          category: "finance",
        });
      }
    });

    // ── 2. Low stock threshold alerts (from /api/ids/dashboard/low-stock) ────
    lowStock
      .filter((item) => item.status === "Critical")
      .slice(0, 3) // cap at 3 critical stock alerts
      .forEach((item) => {
        list.push({
          id: `inv-low-${item.productCode}`,
          severity: "critical",
         message: `LOW STOCK ALERT: ${item.productName} has ${item.stockOnHand} units remaining, which is below the maintaining quantity of ${item.reorderPoint} units.`,
          timestamp: "Live",
          category: "inventory",
        });
      });

    lowStock
      .filter((item) => item.status === "Warning")
      .slice(0, 2) // cap at 2 warning-level stock alerts
      .forEach((item) => {
        list.push({
          id: `inv-warn-${item.productCode}`,
          severity: "warning",
         message: `STOCK WARNING: ${item.productName} has ${item.stockOnHand} units remaining and is approaching the maintaining quantity of ${item.reorderPoint} units.`,
          timestamp: "Live",
          category: "inventory",
        });
      });

    // ── 3. Late / pending dispatch alerts (from /api/ids/dashboard/active-dispatches) ──
    const filteredDispatches = branchIdStr === "all"
      ? activeDispatches
      : activeDispatches.filter((d) => {
          // Route string contains branch number: "Warehouse Branch 196"
          return d.route?.includes(branchIdStr);
        });

    filteredDispatches
      .filter((d) => d.status === "Pending" || d.priority === "Critical")
      .slice(0, 2)
      .forEach((d) => {
        list.push({
          id: `dispatch-pending-${d.dispatchNo}`,
          severity: d.priority === "Critical" ? "critical" : "warning",
          message: `DISPATCH PENDING: Trip ${d.dispatchNo} (Driver: ${d.driverName}, ${d.vehiclePlate}) awaiting clearance.`,
          timestamp: d.time || "Live",
          category: "operations",
        });
      });

    // ── 4. Empty state — if all systems clear, show a positive info alert ────
    if (list.length === 0) {
      list.push({
        id: "sys-all-clear",
        severity: "info",
        message: "ALL SYSTEMS CLEAR: No critical inventory, dispatch, or RTO alerts at this time.",
        timestamp: "Live",
        category: "system",
      });
    }

    // Sort: critical first → warning → info
    const priority: Record<string, number> = { critical: 3, warning: 2, info: 1 };
    return list.sort((a, b) => priority[b.severity] - priority[a.severity]);
  }, [rtoData, lowStock, activeDispatches, filters.branchId]);

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
        return <Info className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />;
      default:
        return <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />;
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
