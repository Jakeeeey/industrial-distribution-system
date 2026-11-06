// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceKPIs.tsx
// ==============================================================================
// KPI Summary Band for Stock Movement and Variance Report (spec §11).
// Every figure is a roll-up of the reconciled rows, so what a supervisor reads
// here always ties back to the table below it.
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  ClipboardCheck,
  Hash,
  Scale,
} from "lucide-react";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";
import { formatQty, formatSigned } from "../services/stock-movement-variance.calc";

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
}

/** Single metric tile. Tone drives only accent colour, never information. */
function KpiCard({ icon: Icon, label, value, hint, tone = "neutral" }: KpiCardProps) {
  const toneClass = {
    neutral: "text-primary bg-primary/10",
    positive: "text-emerald-600 bg-emerald-500/10",
    negative: "text-red-600 bg-red-500/10",
    warning: "text-amber-600 bg-amber-500/10",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border bg-card p-3 shadow-xs"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={cnIcon(toneClass)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-1.5 truncate text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </motion.div>
  );
}

/** Maps the tone class string onto the icon wrapper. */
function cnIcon(classes: string): string {
  return `flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${classes}`;
}

export function StockMovementVarianceKPIs() {
  const { report, isLoading } = useStockMovementVarianceReport();
  const kpis = report?.kpis;

  // Nothing has been applied yet: the results table carries the prompt, so the
  // band stays out of the way rather than showing figures that do not exist.
  if (!kpis && !isLoading) return null;

  if (!kpis) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-[78px] animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        icon={Hash}
        label="Reconciled lines"
        value={formatQty(kpis.totalLines)}
        hint="Products with movement or a count"
      />

      <KpiCard
        icon={Scale}
        label="Net variance"
        value={formatSigned(kpis.netVarianceUnits)}
        hint="Counted minus expected, base units"
        tone={kpis.netVarianceUnits < 0 ? "negative" : kpis.netVarianceUnits > 0 ? "positive" : "neutral"}
      />

      <KpiCard
        icon={ArrowDownRight}
        label="Total shortage"
        value={formatSigned(kpis.shortUnits)}
        hint={`${formatQty(kpis.shortLines)} lines short`}
        tone={kpis.shortUnits < 0 ? "negative" : "neutral"}
      />

      <KpiCard
        icon={ArrowUpRight}
        label="Total overage"
        value={formatSigned(kpis.overUnits)}
        hint={`${formatQty(kpis.overLines)} lines over`}
        tone={kpis.overUnits > 0 ? "warning" : "neutral"}
      />

      <KpiCard
        icon={ClipboardCheck}
        label="Lines counted in this period"
        value={`${formatQty(kpis.linesCounted)} / ${formatQty(kpis.totalLines)}`}
        hint={
          kpis.linesCountedEarlier > 0
            ? `${formatQty(kpis.linesUncounted)} uncounted (${formatQty(kpis.linesCountedEarlier)} last counted in an earlier period)`
            : `${formatQty(kpis.linesUncounted)} uncounted — variance unavailable`
        }
        tone={kpis.linesUncounted > 0 ? "warning" : "positive"}
      />
    </div>
  );
}
