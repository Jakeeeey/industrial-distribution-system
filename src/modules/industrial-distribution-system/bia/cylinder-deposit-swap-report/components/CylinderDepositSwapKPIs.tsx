// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/components/CylinderDepositSwapKPIs.tsx
// ==============================================================================
// KPI Summary Cards for Cylinder Deposit and Swap Report.
// Displays core operational metrics with badges and status indicators.
// ==============================================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cylinder, ArrowUpRight, ArrowDownLeft, AlertTriangle } from "lucide-react";
import { useCylinderDepositSwapReport } from "../hooks/useCylinderDepositSwapReport";

export function CylinderDepositSwapKPIs() {
  const { report, isLoading } = useCylinderDepositSwapReport();
  const kpis = report?.kpis;

  const cardItems = [
    {
      title: "Active Customer Base",
      value: kpis ? kpis.totalActiveCustomerBase.toLocaleString() : "—",
      subtext: kpis ? `${kpis.lifecycle.circulating.toLocaleString()} actively circulating` : "Loading base...",
      icon: Cylinder,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/40",
      borderColor: "border-blue-200/60 dark:border-blue-900/50",
    },
    {
      title: "New Deposits Issued",
      value: kpis ? `+${kpis.totalPeriodDeposits.toLocaleString()}` : "—",
      subtext: "Net customer base expansions",
      icon: ArrowUpRight,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
      borderColor: "border-emerald-200/60 dark:border-emerald-900/50",
    },
    {
      title: "Empty Swaps Collected",
      value: kpis ? kpis.totalPeriodSwapsReturned.toLocaleString() : "—",
      subtext: kpis ? `${kpis.totalPeriodSwapsDelivered.toLocaleString()} full delivered` : "Balanced refills",
      icon: ArrowDownLeft,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
      borderColor: "border-indigo-200/60 dark:border-indigo-900/50",
    },
    {
      title: "Stagnant Cylinders (>60d)",
      value: kpis ? kpis.totalStagnantCylinders.toLocaleString() : "—",
      subtext: "Inactive in customer custody",
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/40",
      borderColor: "border-amber-200/60 dark:border-amber-900/50",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cardItems.map((item, index) => {
        const IconComponent = item.icon;
        return (
          // AG-COMMENT: Staggered entry animation for operational KPI cards
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.04 }}
            className={`rounded-xl border ${item.borderColor} bg-card p-4 shadow-2xs transition-all hover:shadow-xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {item.title}
              </span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bgColor}`}>
                <IconComponent className={`h-4 w-4 ${item.color}`} />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground min-h-[32px] flex items-center">
                {/* AG-COMMENT: Smooth loading crossfade transition for metric numbers */}
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.span
                      key="skeleton"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="inline-block h-7 w-20 animate-pulse rounded-md bg-muted"
                    />
                  ) : (
                    <motion.span
                      key="val"
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {item.value}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">{item.subtext}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
