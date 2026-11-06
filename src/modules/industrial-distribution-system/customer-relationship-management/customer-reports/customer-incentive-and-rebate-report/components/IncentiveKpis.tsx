"use client";

// ============================================================
// IncentiveKpis.tsx
// KPI band. Earned and approved sit in the same card on purpose: the whole
// point of this report is the gap between what the volume records and what
// finance signed, so separating them into different panels would hide it.
// ============================================================

import * as React from "react";
import {  BadgeDollarSign, Boxes, Stamp } from "lucide-react";

 
import { Card, CardContent } from "@/components/ui/card";

import { useCustomerIncentiveReport } from "../hooks/useCustomerIncentiveReport";
import {
  eligibleSizeLabel,
  formatAmount,
  formatKg,
  formatQty,
  formatRate,
} from "../services/customer-incentive.helpers";
import { CLAIM_STATUS_LABELS } from "../types/customer-incentive.types";
import type { ClaimStatus } from "../types/customer-incentive.types";

interface KpiBandProps {
  /** Jumps the tab band to the exception list; hidden when absent. */
  onOpenExceptions?(): void;
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          emphasis
            ? "text-sm font-semibold tabular-nums"
            : "text-sm tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function CardShell({
  title,
  icon,
  basis,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  basis?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border-border/80 ${className ?? ""}`}>
      <CardContent className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {icon}
            <span className="truncate">{title}</span>
          </div>
          {basis ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {basis}
            </span>
          ) : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function IncentiveKpis({}: KpiBandProps): React.ReactElement | null {
  const { report } = useCustomerIncentiveReport();
  if (!report) return null;

  const { overview } = report;
  const netEarned = overview.earnedAmount - overview.adjustmentAmount;
  const recordedRate =
    overview.eligibleKg > 0 && netEarned > 0 ? netEarned / overview.eligibleKg : null;
  const impliedRate =
    overview.eligibleKg > 0 && overview.approvedAmount > 0
      ? overview.approvedAmount / overview.eligibleKg
      : null;

  return (
    <section aria-label="Report totals" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <CardShell
        title="Eligible volume"
        basis={
          (report.filters.categoryIds?.length ?? 0) === 0 && !report.filters.sizeKg
            ? "All industrial cylinders"
            : `${eligibleSizeLabel(report.filters)} products`
        }
        icon={<Boxes aria-hidden="true" className="size-4 text-amber-700" />}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums">
            {formatKg(overview.eligibleKg)}
          </span>
          <span className="text-xs text-muted-foreground">kg billed</span>
        </div>
        <dl className="grid gap-x-6 border-t border-border/60 pt-1 sm:grid-cols-2">
          <Stat label="Units" value={formatQty(overview.eligibleUnits)} />
          <Stat label="Customers" value={formatQty(overview.customerCount)} />
          <Stat label="Recorded ₱/kg" value={formatRate(recordedRate)} />
          <Stat label="Implied ₱/kg" value={formatRate(impliedRate)} />
        </dl>
        <p className="text-xs text-muted-foreground">
          Recorded comes from the invoice lines; implied from the approved memos.
        </p>
      </CardShell>

      <CardShell
        title="Earned against approved"
        basis="reconciles, not restated"
        icon={<BadgeDollarSign aria-hidden="true" className="size-4 text-primary" />}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums">
            {formatAmount(overview.approvedAmount)}
          </span>
          <span className="text-xs text-muted-foreground">approved</span>
        </div>
        <dl className="grid gap-x-6 border-t border-border/60 pt-1 sm:grid-cols-2">
          <Stat label="Earned (recorded)" value={formatAmount(overview.earnedAmount)} />
          <Stat label="Return adjustments" value={formatAmount(-overview.adjustmentAmount)} />
          <Stat label="Earned net of returns" value={formatAmount(netEarned)} emphasis />
          <Stat
            label="Variance"
            value={formatAmount(overview.varianceAmount)}
            emphasis
          />
        </dl>
        <p className="text-xs text-muted-foreground">
          Variance is approved minus earned. The source holds no rebate rate, so
          the gap is shown for a reviewer, not settled here.
        </p>
      </CardShell>

      <CardShell
        title="Settlement"
        icon={<Stamp aria-hidden="true" className="size-4 text-sky-700" />}
        className="md:col-span-2 xl:col-span-1"
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums">
            {formatAmount(overview.outstandingAmount)}
          </span>
          <span className="text-xs text-muted-foreground">outstanding</span>
        </div>
        <dl className="grid gap-x-6 border-t border-border/60 pt-1 sm:grid-cols-2">
          <Stat label="Released" value={formatAmount(overview.releasedAmount)} />
          <Stat label="Result rows" value={formatQty(overview.rowRowCount)} />
          <Stat label="Source rows" value={formatQty(report.sourceRowCount)} />
        </dl>

        <dl className="grid gap-x-6 border-t border-border/60 pt-1 sm:grid-cols-2">
          {(Object.keys(CLAIM_STATUS_LABELS) as ClaimStatus[]).map((status) => (
            <Stat
              key={status}
              label={CLAIM_STATUS_LABELS[status]}
              value={formatQty(overview.claimCounts[status])}
            />
          ))}
        </dl>
      </CardShell>
    </section>
  );
}
