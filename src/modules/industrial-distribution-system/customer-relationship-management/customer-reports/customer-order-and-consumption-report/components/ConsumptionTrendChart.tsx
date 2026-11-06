"use client";

// ============================================================
// ConsumptionTrendChart.tsx
// Monthly demand. Cylinder and LPG kg are drawn as separate bars and never
// stacked: stacking would imply the two bases add up to one demand figure.
// ============================================================

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import {
  formatKgCompact,
  formatQty,
  formatYearMonth,
} from "../services/customer-order-consumption.helpers";
import type {
  AppliedFilterContext,
  ReportTrendPoint,
} from "../types/customer-order-consumption.types";

type TrendMetric = "kg" | "events" | "qty";

// A bucket cut mid-month draws a shorter bar than a full month, and a reader
// comparing the two needs to know which is which.
interface SeriesOptions {
  partial: Set<string>;
}

/** Month buckets the applied window does not cover end to end. */
function partialMonthKeys(filters: AppliedFilterContext): Set<string> {
  const partial = new Set<string>();
  const { startDate, endDate } = filters;

  if (startDate.length === 10 && startDate.slice(8, 10) !== "01") {
    partial.add(startDate.slice(0, 7));
  }
  if (endDate.length === 10) {
    const key = endDate.slice(0, 7);
    const lastDay = new Date(
      Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)
    ).getUTCDate();
    if (Number(endDate.slice(8, 10)) !== lastDay) partial.add(key);
  }
  return partial;
}

interface MonthSeries {
  yearMonth: string;
  label: string;
  cylinder: number;
  lpg: number;
  partial: boolean;
}

const METRIC_READERS: Record<TrendMetric, (point: ReportTrendPoint) => number> = {
  kg: (point) => Number(point.netKg.toFixed(3)),
  events: (point) => point.orderCount,
  qty: (point) => Number(point.grossQty.toFixed(3)),
};

const METRIC_LABELS: Record<TrendMetric, string> = {
  kg: "Net kg (proxy vs measured)",
  events: "Ordering / billing events",
  qty: "Gross quantity",
};

/** Pivots the long per-channel series into one row per month. */
function toMonthSeries(
  points: ReportTrendPoint[],
  metric: TrendMetric,
  options: SeriesOptions
): MonthSeries[] {
  const read = METRIC_READERS[metric];
  const byMonth = new Map<string, MonthSeries>();

  for (const point of points) {
    const current =
      byMonth.get(point.yearMonth) ??
      {
        yearMonth: point.yearMonth,
        label: formatYearMonth(point.yearMonth),
        cylinder: 0,
        lpg: 0,
        partial: options.partial.has(point.yearMonth),
      };
    if (point.channel === "CYLINDER") current.cylinder += read(point);
    else current.lpg += read(point);
    byMonth.set(point.yearMonth, current);
  }

  return [...byMonth.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}

function formatValue(metric: TrendMetric, value: number): string {
  if (metric === "kg") return `${formatKgCompact(value)} kg`;
  return formatQty(value);
}

export function ConsumptionTrendChart(): React.ReactElement | null {
  const { report } = useCustomerOrderConsumptionReport();
  const [metric, setMetric] = React.useState<TrendMetric>("kg");

  const partial = React.useMemo(
    () => (report ? partialMonthKeys(report.filters) : new Set<string>()),
    [report]
  );

  const series = React.useMemo(
    () => (report ? toMonthSeries(report.monthlyTrend, metric, { partial }) : []),
    [report, metric, partial]
  );

  // Peak month per channel, in that channel's own unit, so the callout never
  // needs the two kg bases to be added together.
  const peaks = React.useMemo(() => {
    const read = METRIC_READERS[metric];
    let cylinder: { label: string; value: number } | null = null;
    let lpg: { label: string; value: number } | null = null;
    for (const point of report?.monthlyTrend ?? []) {
      const value = read(point);
      if (value <= 0) continue;
      const candidate = { label: formatYearMonth(point.yearMonth), value };
      if (point.channel === "CYLINDER") {
        if (!cylinder || value > cylinder.value) cylinder = candidate;
      } else if (!lpg || value > lpg.value) {
        lpg = candidate;
      }
    }
    return { cylinder, lpg };
  }, [report, metric]);

  if (!report || series.length === 0) return null;

  const hasCylinder = series.some((row) => row.cylinder !== 0);
  const hasLpg = series.some((row) => row.lpg !== 0);

  return (
    <Card className="border-border/80">
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              Monthly demand by channel
            </h2>
            <span className="text-xs text-muted-foreground">
              {series.length} month{series.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="coc-trend-metric" className="text-xs text-muted-foreground">
              Metric
            </Label>
            <Select value={metric} onValueChange={(next) => setMetric(next as TrendMetric)}>
              <SelectTrigger id="coc-trend-metric" className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(METRIC_LABELS) as TrendMetric[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {METRIC_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {peaks.cylinder || peaks.lpg ? (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {peaks.cylinder ? (
              <span>
                Cylinder / bulk peak:{" "}
                <span className="font-medium text-foreground">
                  {peaks.cylinder.label} ({formatValue(metric, peaks.cylinder.value)})
                </span>
              </span>
            ) : null}
            {peaks.lpg ? (
              <span>
                LPG peak:{" "}
                <span className="font-medium text-foreground">
                  {peaks.lpg.label} ({formatValue(metric, peaks.lpg.value)})
                </span>
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickFormatter={(value: unknown, index: number) =>
                  series[index]?.partial ? `${String(value)} *` : String(value)
                }
              />
              <YAxis
                tick={{ fontSize: 11 }}
                width={64}
                tickFormatter={(value) => formatQty(Number(value))}
              />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [
                  formatValue(metric, Number(value ?? 0)),
                  String(name ?? ""),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {hasCylinder ? (
                <Bar
                  dataKey="cylinder"
                  name="Cylinder / bulk (proxy kg)"
                  fill="#d97706"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={38}
                />
              ) : null}
              {hasLpg ? (
                <Bar
                  dataKey="lpg"
                  name="Metered & weighed LPG (kg)"
                  fill="#0284c7"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={38}
                />
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <TrendValuesTable series={series} metric={metric} />

        <p className="text-xs text-muted-foreground">
          Bars are shown side by side rather than stacked because cylinder kilograms
          are inferred from purchased pieces while LPG kilograms are read from a
          meter or weighbridge.
          {partial.size > 0
            ? " A month marked * is partial: the window starts or ends mid-month, so its bar is shorter by construction, not by demand."
            : ""}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * The same numbers the bars encode, for keyboard and screen-reader readers and
 * for anyone who wants to check a bar against a figure.
 */
function TrendValuesTable({
  series,
  metric,
}: {
  series: MonthSeries[];
  metric: TrendMetric;
}): React.ReactElement {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">
        Show the {series.length} month values behind the chart
      </summary>
      <table className="mt-2 w-full max-w-lg border-collapse text-xs">
        <caption className="sr-only">
          Monthly demand by channel for the selected metric
        </caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-1 pr-3 font-medium">
              Month
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">
              Cylinder / bulk
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Metered &amp; weighed LPG
            </th>
          </tr>
        </thead>
        <tbody>
          {series.map((row) => (
            <tr key={row.yearMonth} className="border-b border-border/50 last:border-0">
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {row.label}
                {row.partial ? (
                  <span className="text-muted-foreground"> (partial)</span>
                ) : null}
              </th>
              <td className="py-1 pr-3 text-right tabular-nums">
                {row.cylinder === 0 ? "—" : formatValue(metric, row.cylinder)}
              </td>
              <td className="py-1 text-right tabular-nums">
                {row.lpg === 0 ? "—" : formatValue(metric, row.lpg)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
