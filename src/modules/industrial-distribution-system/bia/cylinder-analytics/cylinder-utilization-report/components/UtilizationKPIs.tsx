// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationKPIs.tsx
// ==============================================================================
// KPI Summary Strip for the Cylinder Utilization Report (spec §7 outputs).
//
// Revised layout with human-understandable terminology and fully visible subtext:
// - Total Registered Cylinders, Active Working Fleet, With Customers, Ready in Yard,
//   Idle (>30d), Under Repair, and Utilization Rate.
// - Plain explanations for why Lost/Retired and Unclassified are excluded.
//
// Complies with VoSync Design System standards:
// - Shimmer loading state
// - Clear color semantics and badge pills
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";


import {

  CheckCircle2,
  CircleDollarSign,
  Cylinder,
  Gauge,

  Moon,
  Warehouse,
  Wrench,
} from "lucide-react";
import { useCylinderUtilizationReport } from "../hooks/useCylinderUtilizationReport";
import { formatCount, formatPercent } from "../services";
import { resolveUtilizationClass } from "./BucketBadge";

export function UtilizationKPIs() {
  const { reportData, isLoading } = useCylinderUtilizationReport();
  const kpis = reportData?.kpis;

  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, idx) => (
          <div key={idx} className="h-36 animate-pulse rounded-xl border bg-card p-4">
            <div className="mb-3 h-3 w-24 rounded-sm bg-muted" />
            <div className="mb-2 h-7 w-20 rounded-sm bg-muted" />
            <div className="h-2.5 w-full rounded-sm bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const thresholdLabel = reportData?.rules.idleThresholdDays ?? 30;

  // AG-COMMENT: Normal business user terminology replacing ambiguous terms per user instructions
  const cards = [
    {
      title: "Total",
      value: formatCount(kpis.totalFleet),
      description: "All serialized cylinder assets currently registered in system",
      icon: Cylinder,
      badge: "Total Registered",
      color: "text-slate-700 dark:text-slate-300",
      border: "border-slate-500/20",
      bg: "bg-slate-500/10",
    },
    {
      title: "Active",
      value: formatCount(kpis.eligibleFleet),
      description: "Usable cylinders: Total minus lost, retired, or invalid data",
      icon: Warehouse,
      badge: "In Service",
      color: "text-indigo-600 dark:text-indigo-400",
      border: "border-indigo-500/20",
      bg: "bg-indigo-500/10",
    },
    {
      title: "Circulating",
      value: formatCount(kpis.circulating),
      description: "Cylinders deployed with customers or loaded on delivery trucks",
      icon: CircleDollarSign,
      badge: "Earning",
      color: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Available",
      value: formatCount(kpis.available),
      description: "Usable cylinders in stock ready for immediate deployment",
      icon: CheckCircle2,
      badge: "Available",
      color: "text-blue-600 dark:text-blue-400",
      border: "border-blue-500/20",
      bg: "bg-blue-500/10",
    },
    {
      title: "Idle",
      value: formatCount(kpis.idle),
      description: `Dormant in stock for more than ${thresholdLabel} days without movement`,
      icon: Moon,
      badge: kpis.idle > 0 ? "Action Needed" : "All Clear",
      color: kpis.idle > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
      border: kpis.idle > 0 ? "border-amber-500/20" : "border-emerald-500/20",
      bg: kpis.idle > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
    },
    {
      title: "For Repair",
      value: formatCount(kpis.maintenance),
      description: `Tagged for repair or maintenance (${formatPercent(kpis.maintenanceRate)} of active fleet)`,
      icon: Wrench,
      badge: "Maintenance",
      color: "text-violet-600 dark:text-violet-400",
      border: "border-violet-500/20",
      bg: "bg-violet-500/10",
    },
    {
      title: "Utilization Rate",
      value: formatPercent(kpis.utilization),
      description: `With customers ÷ active fleet × 100 (Idle: ${formatPercent(kpis.idleRate)})`,
      icon: Gauge,
      badge: "Fleet Usage",
      color: resolveUtilizationClass(kpis.utilization),
      border: "border-primary/20",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div className="space-y-3.5">
      {/* ── Primary KPI Cards: Fully visible subtext with responsive layout ──── */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition hover:shadow-xs hover:border-primary/30"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate"
                    title={card.title}
                  >
                    {card.title}
                  </span>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className={`text-2xl font-bold tracking-tight sm:text-2xl ${card.color}`}>{card.value}</span>
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${card.border} ${card.bg} ${card.color}`}
                  >
                    {card.badge}
                  </span>
                </div>
              </div>

              {/* AG-COMMENT: Removed truncate constraint so explanatory subtext fully displays */}
              <div className="mt-3 border-t border-border/50 pt-2 text-[11px] leading-relaxed text-muted-foreground">
                {card.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
