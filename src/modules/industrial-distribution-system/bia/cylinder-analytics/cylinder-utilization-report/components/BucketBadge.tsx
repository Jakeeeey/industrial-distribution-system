// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/BucketBadge.tsx
// ==============================================================================
// Fleet Bucket Badge — one badge per mutually exclusive utilization category.
// Colour carries meaning: green earns, slate sits in the yard, amber is dormant,
// violet is in for repair, grey is written off, red is a data exception.
// ==============================================================================

"use client";

import * as React from "react";
import {
  CircleDollarSign,
  Warehouse,
  Moon,
  Wrench,
  Ban,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { BUCKET_LABELS } from "../services";
import type { UtilizationBucket } from "../types/cylinder-utilization-report.types";

/** Icon and palette per bucket, kept together so the legend cannot drift from it. */
const BUCKET_STYLES: Record<UtilizationBucket, { className: string; icon: LucideIcon }> = {
  CIRCULATING: { className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: CircleDollarSign },
  AVAILABLE: { className: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300", icon: Warehouse },
  IDLE: { className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: Moon },
  MAINTENANCE: { className: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400", icon: Wrench },
  UNAVAILABLE: { className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400", icon: Ban },
  UNCLASSIFIED: { className: "border-destructive/20 bg-destructive/10 text-destructive", icon: HelpCircle },
};

export function BucketBadge({
  bucket,
  withIcon = true,
  className = "",
}: {
  bucket: UtilizationBucket;
  withIcon?: boolean;
  className?: string;
}) {
  const style = BUCKET_STYLES[bucket];
  const Icon = style.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${style.className} ${className}`}
    >
      {withIcon && <Icon className="h-3 w-3 shrink-0" />}
      <span>{BUCKET_LABELS[bucket]}</span>
    </span>
  );
}

/** Utilization percentage colour scale, reused by the grid and the KPI strip. */
export function resolveUtilizationClass(utilization: number): string {
  if (utilization >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (utilization >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}
