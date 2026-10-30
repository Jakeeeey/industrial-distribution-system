// src/modules/industrial-distribution-system/supply-chain-management/cylinder-asset-management/cylinder-deposit-swap-report/components/CylinderDepositSwapKPIs.tsx
// ==============================================================================
// KPI Summary Cards for Cylinder Deposit and Swap Report.
// Displays core operational metrics with badges, status indicators, and
// rich interactive hover tooltips explaining the calculation basis of each KPI.
// ==============================================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cylinder, ArrowUpRight, ArrowDownLeft, AlertTriangle, Info } from "lucide-react";
import { useCylinderDepositSwapReport } from "../hooks/useCylinderDepositSwapReport";

export function CylinderDepositSwapKPIs() {
  const { report, isLoading } = useCylinderDepositSwapReport();
  const kpis = report?.kpis;

  const cardItems = [
    {
      title: "Active Customer Base",
      value: kpis ? kpis.totalActiveCustomerBase.toLocaleString() : "—",
      subtext: kpis ? `${kpis.lifecycle.circulating.toLocaleString()} actively circulating` : "Loading base...",
      infoTooltip:
        "Total physical cylinders actively deployed and held across all customer premises. Sourced from tracked serialized assets and customer site installations.",
      icon: Cylinder,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/40",
      borderColor: "border-blue-200/60 dark:border-blue-900/50",
      hoverBorderColor: "hover:border-blue-400 dark:hover:border-blue-700",
    },
    {
      title: "New Deposits Issued",
      value: kpis ? `+${kpis.totalPeriodDeposits.toLocaleString()}` : "—",
      subtext: "Net customer base expansions",
      infoTooltip:
        "New physical cylinder containers issued/onboarded to customers within the selected cutoff range. Directly increases the customer custody balance (+).",
      icon: ArrowUpRight,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
      borderColor: "border-emerald-200/60 dark:border-emerald-900/50",
      hoverBorderColor: "hover:border-emerald-400 dark:hover:border-emerald-700",
    },
    {
      title: "Empty Swaps Collected",
      value: kpis ? kpis.totalPeriodSwapsReturned.toLocaleString() : "—",
      subtext: kpis ? `${kpis.totalPeriodSwapsDelivered.toLocaleString()} full delivered` : "Balanced refills",
      infoTooltip:
        "Routine 1-to-1 refill exchanges (empty cylinders received back from customers in exchange for refilled cylinders). Net zero custody change.",
      icon: ArrowDownLeft,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
      borderColor: "border-indigo-200/60 dark:border-indigo-900/50",
      hoverBorderColor: "hover:border-indigo-400 dark:hover:border-indigo-700",
    },
    {
      title: "Stagnant Cylinders (>60d)",
      value: kpis ? kpis.totalStagnantCylinders.toLocaleString() : "—",
      subtext: "Inactive in customer custody",
      infoTooltip:
        "Physical cylinders held in customer custody without recorded movement or refill transactions for over 60 days. High risk of asset stagnation or loss.",
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/40",
      borderColor: "border-amber-200/60 dark:border-amber-900/50",
      hoverBorderColor: "hover:border-amber-400 dark:hover:border-amber-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cardItems.map((item, index) => {
        const IconComponent = item.icon;
        return (
          // AG-COMMENT: Staggered entry animation with interactive hover elevation and informative tooltip
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3, transition: { duration: 0.16 } }}
            transition={{ duration: 0.22, delay: index * 0.04 }}
            title={item.infoTooltip}
            className={`group rounded-xl border ${item.borderColor} ${item.hoverBorderColor} bg-card p-4 shadow-2xs hover:shadow-md transition-all duration-200 cursor-help`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  {item.title}
                </span>
                <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bgColor} group-hover:scale-110 transition-transform duration-200`}>
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