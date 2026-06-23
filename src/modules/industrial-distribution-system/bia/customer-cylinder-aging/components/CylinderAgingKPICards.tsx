// components/CylinderAgingKPICards.tsx
// ──────────────────────────────────────────────────────────────────────────────
// 4 KPI summary cards derived from the records array.
// Calculations happen here (not in the provider) to keep the provider thin.
// Shows skeleton state while isLoading.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Package, Clock, AlertTriangle, HelpCircle } from "lucide-react";
import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";
import { Skeleton } from "@/components/ui/skeleton";

// ── KPI computation ───────────────────────────────────────────────────────────
function computeKPIs(records: ReturnType<typeof useCustomerCylinderAging>["records"]) {
  const total = records.length;

  const validDays = records
    .map((r) => r.daysWithCustomer)
    .filter((d): d is number => d !== null && d !== undefined);

  const avgDays =
    validDays.length > 0
      ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length)
      : 0;

  // >90 days is considered high-risk per the helpers threshold
  const highRisk = records.filter(
    (r) => r.daysWithCustomer !== null && r.daysWithCustomer >= 91
  ).length;

  const noTransaction = records.filter(
    (r) => r.customerActivityStatus === "NO_TRANSACTION_RECORD"
  ).length;

  return { total, avgDays, highRisk, noTransaction };
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function KPICardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

// ── Single KPI card ───────────────────────────────────────────────────────────
interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  highlight?: "default" | "warning" | "destructive";
}

function KPICard({ icon, label, value, sub, highlight = "default" }: KPICardProps) {
  const highlightClass =
    highlight === "destructive"
      ? "text-destructive"
      : highlight === "warning"
      ? "text-amber-500"
      : "text-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className={`text-2xl font-black tabular-nums ${highlightClass}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function CylinderAgingKPICards() {
  const { records, isLoading } = useCustomerCylinderAging();
  const kpis = React.useMemo(() => computeKPIs(records), [records]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KPICard
        icon={<Package className="h-4 w-4" />}
        label="Total Cylinders"
        value={kpis.total.toLocaleString()}
        sub="WITH_CUSTOMER cylinders"
      />
      <KPICard
        icon={<Clock className="h-4 w-4" />}
        label="Avg. Days w/ Customer"
        value={kpis.avgDays}
        sub="Average across all records"
        highlight={kpis.avgDays >= 91 ? "destructive" : kpis.avgDays >= 31 ? "warning" : "default"}
      />
      <KPICard
        icon={<AlertTriangle className="h-4 w-4" />}
        label="High Risk (>90 days)"
        value={kpis.highRisk.toLocaleString()}
        sub="Cylinders aged over 90 days"
        highlight={kpis.highRisk > 0 ? "destructive" : "default"}
      />
      <KPICard
        icon={<HelpCircle className="h-4 w-4" />}
        label="No Transaction Record"
        value={kpis.noTransaction.toLocaleString()}
        sub="No invoice or dispatch found"
        highlight={kpis.noTransaction > 0 ? "warning" : "default"}
      />
    </div>
  );
}
