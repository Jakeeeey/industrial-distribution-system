"use client";

// ============================================================
// CustomerOrderConsumptionKpis.tsx
// KPI band, grouped by channel. Cylinder kg and LPG kg sit in separate
// cards on purpose — the ticket forbids one combined demand figure.
// ============================================================

import * as React from "react";
import { AlertTriangle, Boxes, Flame, ListFilter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import {
  formatAmount,
  formatKgCompact,
  formatPercent,
  formatQty,
} from "../services/customer-order-consumption.helpers";
import type { ChannelTotals } from "../types/customer-order-consumption.types";

interface KpiBandProps {
  /** Jumps the tab band to the exception list; hidden when absent. */
  onOpenExceptions?(): void;
}

interface ChannelCardProps {
  title: string;
  basis: string;
  icon: React.ReactNode;
  totals: ChannelTotals;
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

function ChannelCard({ title, basis, icon, totals }: ChannelCardProps) {
  const active = totals.customers > 0 || totals.orders > 0 || totals.netKg !== 0;

  return (
    <Card className="border-border/80">
      <CardContent className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {icon}
            <span className="truncate">{title}</span>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {basis}
          </span>
        </div>

        {active ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span
                className={
                  totals.netKg < 0
                    ? "text-2xl font-semibold tabular-nums text-destructive"
                    : "text-2xl font-semibold tabular-nums"
                }
              >
                {formatKgCompact(totals.netKg)}
              </span>
              <span className="text-xs text-muted-foreground">
                net kg{totals.netKg < 0 ? " — returns exceed demand" : ""}
              </span>
            </div>

            <dl className="grid gap-x-6 border-t border-border/60 pt-1 sm:grid-cols-2">
              <Stat label="Customers" value={formatQty(totals.customers)} />
              <Stat label="Ordering events" value={formatQty(totals.orders)} />
              <Stat label="Gross kg" value={formatKgCompact(totals.grossKg)} />
              <Stat
                label="Returned kg"
                value={totals.returnedKg === 0 ? "—" : formatKgCompact(totals.returnedKg)}
              />
              <Stat
                label="Avg net kg / event"
                value={totals.orders === 0 ? "—" : formatKgCompact(totals.avgOrderSizeKg)}
              />
              <Stat label="Return rate" value={formatPercent(totals.returnRatePct)} />
              <Stat label="Gross pieces" value={formatQty(totals.grossQty)} />
              <Stat label="Net amount" value={formatAmount(totals.netAmount)} emphasis />
            </dl>
          </>
        ) : (
          <div className="space-y-1 border-t border-border/60 pt-3">
            <p className="text-sm font-medium">No demand in this window</p>
            <p className="text-xs text-muted-foreground">
              Nothing was sold, returned or billed through this channel for the
              filters on screen. The other channel is unaffected — the two are
              never added together.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CustomerOrderConsumptionKpis({
  onOpenExceptions,
}: KpiBandProps): React.ReactElement | null {
  const { report } = useCustomerOrderConsumptionReport();

  // Read off the rows already on screen: distinct products and months are the
  // two things a reader checks to see how wide this window actually is.
  const coverage = React.useMemo(() => {
    const products = new Set<number>();
    const months = new Set<string>();
    for (const row of report?.rows ?? []) {
      products.add(row.productId);
      for (const point of row.monthlyTrend) {
        if (point.netKg !== 0 || point.orderCount > 0) months.add(point.yearMonth);
      }
    }
    return { products: products.size, months: months.size };
  }, [report]);

  if (!report) return null;

  const { overview, sourceRowCount } = report;

  return (
    <section
      aria-label="Report totals"
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      <ChannelCard
        title="Cylinder & bulk"
        basis="industrial cylinders · kg = qty x category size"
        icon={<Boxes aria-hidden="true" className="size-4 text-amber-700" />}
        totals={overview.cylinder}
      />
      <ChannelCard
        title="Metered & weighed LPG"
        basis="kg = recorded usage"
        icon={<Flame aria-hidden="true" className="size-4 text-sky-700" />}
        totals={overview.lpg}
      />

      <Card className="border-border/80 md:col-span-2 xl:col-span-1">
        <CardContent className="space-y-2 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListFilter aria-hidden="true" className="size-4 text-primary" />
            Window coverage
          </div>

          <dl className="grid gap-x-6 sm:grid-cols-2">
            <Stat label="Products" value={formatQty(coverage.products)} />
            <Stat label="Months with demand" value={formatQty(coverage.months)} />
            <Stat label="Result rows" value={formatQty(report.rows.length)} />
            <Stat label="Source rows" value={formatQty(sourceRowCount)} />
          </dl>

          <p className="text-xs text-muted-foreground">
            {formatQty(overview.totalCustomers)} customers placed{" "}
            {formatQty(overview.totalOrders)} ordering events across both
            channels. One event is one sales order, so an order billed across
            several invoices is not counted twice.
          </p>

          {overview.exceptionCount > 0 ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
              <span className="flex items-center gap-2 text-xs font-medium">
                <AlertTriangle
                  aria-hidden="true"
                  className="size-4 text-amber-700"
                />
                {formatQty(overview.exceptionCount)} data exception
                {overview.exceptionCount === 1 ? "" : "s"}
              </span>
              {onOpenExceptions ? (
                <Button type="button" size="sm" variant="outline" onClick={onOpenExceptions}>
                  Review
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No data exceptions in this window.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
