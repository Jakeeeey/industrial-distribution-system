// src/modules/industrial-distribution-system/dashboard/components/NotificationsPanel.tsx
// NOTE: Removed hardcoded static alert strings (inv-low-lpg, ops-delay-dispatch, sys-failed-sync).
// Alerts are now synthesized from live context: rtoData, lowStock, activeDispatches.

"use client";

import React, { useMemo } from "react";
import { useDashboard } from "../providers/DashboardProvider";
import { CriticalAlert } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert, AlertTriangle, Info, BellRing, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { rtoData, lowStock, activeDispatches, filters } = useDashboard();

  const alerts = useMemo((): CriticalAlert[] => {
    const list: CriticalAlert[] = [];
    const branchIdStr = String(filters.branchId);

    // ── 1. RTO high-risk customer alerts ────────────────────────────────────
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

    // ── 2. Low stock threshold alerts ───────────────────────────────────────
    lowStock
      .filter((item) => item.status === "Critical")
      .slice(0, 3)
      .forEach((item) => {
        list.push({
          id: `inv-low-${item.productCode}`,
          severity: "critical",
          message: `LOW STOCK ALERT: ${item.productName} has only ${item.stockOnHand} units remaining, well below the maintaining quantity of ${item.reorderPoint} units.`,
          timestamp: "Live",
          category: "inventory",
        });
      });

    lowStock
      .filter((item) => item.status === "Warning")
      .slice(0, 2)
      .forEach((item) => {
        list.push({
          id: `inv-warn-${item.productCode}`,
          severity: "warning",
          message: `STOCK WARNING: ${item.productName} is below the maintaining quantity. Current stock: ${item.stockOnHand} units (Maintaining quantity: ${item.reorderPoint} units).`,
          timestamp: "Live",
          category: "inventory",
        });
      });

    // ── 3. Late / pending dispatch alerts ───────────────────────────────────
    const filteredDispatches = branchIdStr === "all"
      ? activeDispatches
      : activeDispatches.filter((d) => d.route?.includes(branchIdStr));

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

    // Sort: critical → warning → info
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
        return <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />;
      default:
        return <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black backdrop-blur-xs cursor-pointer"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl border-l border-border/80"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 p-5 bg-muted/20">
              <div className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-rose-500 animate-bounce" />
                <div>
                  <h2 className="text-base font-black uppercase italic tracking-tighter text-slate-800 dark:text-slate-100">
                    Operational Alerts
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                    Critical Flags & Warnings ({alerts.length})
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
              {alerts.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No active critical alerts. All systems operational!
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 border rounded-xl p-4 bg-muted/5 transition-all text-xs ${getAlertStyle(alert.severity)}`}
                  >
                    {getIcon(alert.severity)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[8px] font-bold py-0.5 px-1 bg-white/20 border-0 ${getAlertStyle(alert.severity)}`}>
                          {alert.category.toUpperCase()}
                        </Badge>
                        <span className="text-[9px] text-slate-400 font-medium font-mono">{alert.timestamp}</span>
                      </div>
                      <p className="mt-1.5 text-[11px] font-bold leading-normal text-foreground/95 select-text">
                        {alert.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border/60 p-4 bg-muted/20 text-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
              Resolved alerts are automatically cleared from the console.
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
