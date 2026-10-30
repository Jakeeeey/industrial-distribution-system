// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationKPIs.tsx
// ==============================================================================
// KPI Summary Strip for the Cylinder Utilization Report (spec §7 outputs).
//
// Primary cards carry the figures a reviewer reads first: fleet size, the eligible
// denominator, what is circulating, what is dormant, what is stuck in repair and
// the resulting utilization ratio. A secondary strip carries the remaining bucket
// counts plus the movement-evidence counters so every documented output is
// displayed and nothing is quietly dropped.
//
// Drill-down deliberately lives on the results table (spec §11), where a bucket
// always belongs to one identifiable branch × size grouping; a fleet-wide bucket
// would have no grouping to show its supporting records against.
//
// Complies with VoSync Design System standards:
// - Loading shimmers for the initial render
// - Colour semantics identical to the grid badges
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import {
  Ban,
  CircleDollarSign,
  Cylinder,
  Gauge,
  HelpCircle,
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-28 animate-pulse rounded-xl border bg-card p-4">
            <div className="mb-3 h-3 w-20 rounded-sm bg-muted" />
            <div className="mb-2 h-6 w-16 rounded-sm bg-muted" />
            <div className="h-2.5 w-full rounded-sm bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const thresholdLabel = reportData?.rules.idleThresholdDays ?? 30;

  const cards = [
    {
      title: "Total Fleet",
      value: formatCount(kpis.totalFleet),
      description: "Active serialized cylinder assets in scope",
      icon: Cylinder,
      badge: "Assets",
      color: "text-slate-600 dark:text-slate-400",
      border: "border-slate-500/20",
      bg: "bg-slate-500/10",
    },
    {
      title: "Eligible Fleet",
      value: formatCount(kpis.eligibleFleet),
      description: "Denominator: fleet minus unavailable and unclassified",
      icon: Warehouse,
      badge: "Denominator",
      color: "text-indigo-600 dark:text-indigo-400",
      border: "border-indigo-500/20",
      bg: "bg-indigo-500/10",
    },
    {
      title: "Circulating",
      value: formatCount(kpis.circulating),
      description: "Deployed with a customer or loaded for delivery",
      icon: CircleDollarSign,
      badge: "Earning",
      color: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Idle",
      value: formatCount(kpis.idle),
      description: `Dormant beyond ${thresholdLabel} days as at the cutoff`,
      icon: Moon,
      badge: kpis.idle > 0 ? "Recoverable" : "All Clear",
      color: kpis.idle > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
      border: kpis.idle > 0 ? "border-amber-500/20" : "border-emerald-500/20",
      bg: kpis.idle > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
    },
    {
      title: "Maintenance",
      value: formatCount(kpis.maintenance),
      description: `Out of service pending repair — ${formatPercent(kpis.maintenanceRate)}`,
      icon: Wrench,
      badge: "Out of service",
      color: "text-violet-600 dark:text-violet-400",
      border: "border-violet-500/20",
      bg: "bg-violet-500/10",
    },
    {
      title: "Utilization",
      value: formatPercent(kpis.utilization),
      description: `Idle rate ${formatPercent(kpis.idleRate)} of eligible fleet`,
      icon: Gauge,
      badge: "Fleet usage",
      color: resolveUtilizationClass(kpis.utilization),
      border: "border-primary/20",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition hover:shadow-xs"
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {card.title}
                </span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.bg} ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="my-2">
                <div className={`text-xl font-bold tracking-tight sm:text-2xl ${card.color}`}>{card.value}</div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate pr-1" title={card.description}>
                  {card.description}
                </span>
                <span
                  className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${card.border} ${card.bg} ${card.color}`}
                >
                  {card.badge}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Secondary counters: remaining buckets and movement evidence ──── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
        <Counter icon={Ban} label="Unavailable" value={formatCount(kpis.unavailable)} />
        <Counter
          icon={HelpCircle}
          label="Unclassified (data exceptions)"
          value={formatCount(kpis.unclassified)}
          highlight={kpis.unclassified > 0}
        />
        <span className="inline-flex items-center gap-1.5">
          Reporting across{" "}
          <span className="font-mono font-bold text-foreground">{formatCount(kpis.branchesReported)}</span> branch(es)
          and <span className="font-mono font-bold text-foreground">{formatCount(kpis.sizesReported)}</span> size(s)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono font-bold text-foreground">{formatCount(kpis.movementsConsidered)}</span> verified
          movement(s) applied to last activity
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono font-bold text-foreground">{formatCount(kpis.reversalsExcluded)}</span> reversal(s)
          retained as evidence but not counted
        </span>
      </div>
    </div>
  );
}

/** Inline counter used by the secondary strip. */
function Counter({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 ${highlight ? "text-destructive" : "text-muted-foreground"}`} />
      <span>{label}:</span>
      <span className={`font-mono font-bold ${highlight ? "text-destructive" : "text-foreground"}`}>{value}</span>
    </span>
  );
}
