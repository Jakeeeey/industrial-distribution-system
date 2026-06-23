"use client";

// =============================================================================
// Price Monitoring — PriceTrendChart Component
// Layer  : components (UI only)
// Spec   : §8.1 Trend Chart — one line per Price Type, X-axis = events
// Uses   : recharts, Tabs from shadcn ui
// =============================================================================

import * as React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import type { ViewPriceMonitoringRow, PriceTypeGroup } from "../types";
import {
  formatCurrency,
  formatPct,
  getPriceTypeColor,
  groupByPriceType,
} from "../utils/matrixUtils";
import { mapPriceTypeName } from "../../product-pricing/utils/constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PriceTrendChartProps {
  allRows: ViewPriceMonitoringRow[];
  filteredRows: ViewPriceMonitoringRow[];
  selectedYear: number;
  loading: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  granularity?: "daily" | "weekly" | "monthly" | "yearly";
  chartType?: "line" | "bar";
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadEntry {
  name: string;
  value: number | null;
  color: string;
  payload: Record<string, unknown>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background px-3 py-2.5 shadow-xl text-xs min-w-[200px] sm:min-w-[220px] flex flex-col gap-1.5 max-w-[calc(100vw-32px)]">
      <div className="font-bold text-foreground border-b pb-1">
        {String(point.displayDate ?? "")}
      </div>
      <div className="flex flex-col gap-1.5">
        {payload.map((entry) => {
          const event = point[`${entry.name}_event`] as ViewPriceMonitoringRow | null;
          const changed = point[`${entry.name}_changed`] as boolean;
          const resolvedOldPrice: number | null =
            (point[`${entry.name}_prevPrice`] as number | null) ?? null;

          return (
            <div
              key={entry.name}
              className="flex flex-col gap-0.5 pb-1.5 last:pb-0 border-b last:border-0 border-muted/50"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 font-bold text-foreground">
                  <span
                    className="inline-block h-2 w-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  {mapPriceTypeName(entry.name)}
                </span>
                <span className="font-mono font-bold text-foreground">
                  {entry.value !== null ? formatCurrency(entry.value) : "—"}
                </span>
              </div>

              {changed && event && (
                <div className="pl-3.5 mt-0.5 text-[10px] text-muted-foreground flex flex-col gap-0.5 bg-muted/40 p-1.5 rounded border border-muted/20">
                  <div className="flex justify-between font-semibold text-foreground/90">
                    <span>Change:</span>
                    <span>
                      {resolvedOldPrice != null
                        ? formatCurrency(resolvedOldPrice)
                        : "—"}{" "}
                      → {formatCurrency(event.newPrice)}
                    </span>
                  </div>
                  {event.priceChangePercentage !== null && (
                    <div className="flex justify-between">
                      <span>Percentage:</span>
                      <span className="font-mono">
                        {formatPct(event.priceChangePercentage)}
                      </span>
                    </div>
                  )}
                  {event.approvedByName && (
                    <div className="flex justify-between text-[9px] text-muted-foreground/80 mt-0.5">
                      <span>Approved By:</span>
                      <span
                        className="truncate max-w-[100px]"
                        title={event.approvedByName}
                      >
                        {event.approvedByName}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: get active price on target date
// ---------------------------------------------------------------------------

function getActivePriceForGroup(
  group: PriceTypeGroup,
  date: Date,
  allRows: ViewPriceMonitoringRow[],
  startOfChart: Date,
) {
  const priorRows = allRows
    .filter(
      (r) =>
        r.priceTypeId === group.priceTypeId &&
        r.priceChangeDatetime !== null &&
        r.requestStatus === "APPROVED" &&
        new Date(r.priceChangeDatetime!).getTime() < startOfChart.getTime(),
    )
    .sort(
      (a, b) =>
        new Date(a.priceChangeDatetime!).getTime() -
        new Date(b.priceChangeDatetime!).getTime(),
    );

  const seedPrice =
    priorRows.length > 0 ? priorRows[priorRows.length - 1].newPrice : null;
  const seedEvent = priorRows.length > 0 ? priorRows[priorRows.length - 1] : null;

  const activeRows = group.rows
    .filter((r) => {
      if (r.requestStatus !== "APPROVED") return false;
      const dt = r.priceChangeDatetime ?? r.approvedAt;
      if (!dt) return false;
      return new Date(dt).getTime() <= date.getTime();
    })
    .sort((a, b) => {
      const tA = new Date(a.priceChangeDatetime ?? a.approvedAt ?? 0).getTime();
      const tB = new Date(b.priceChangeDatetime ?? b.approvedAt ?? 0).getTime();
      return tA - tB;
    });

  const activeRow = activeRows.length > 0 ? activeRows[activeRows.length - 1] : null;
  const activePrice = activeRow ? activeRow.newPrice : seedPrice;
  const activeEvent = activeRow || seedEvent;

  const changedOnThisDate = activeRow
    ? Math.abs(
        new Date(activeRow.priceChangeDatetime ?? activeRow.approvedAt ?? 0).getTime() -
          date.getTime(),
      ) < 60000
    : false;

  return { activePrice, activeEvent, changedOnThisDate };
}

// ---------------------------------------------------------------------------
// Chart component
// ---------------------------------------------------------------------------

export function PriceTrendChart({
  allRows,
  selectedYear,
  loading,
  dateFrom,
  dateTo,
  granularity = "monthly",
  chartType = "line",
}: PriceTrendChartProps) {
  const priceTypeGroups = React.useMemo(
    () => groupByPriceType(allRows),
    [allRows],
  );

  // Build granular timeline data
  const chartData = React.useMemo(() => {
    if (priceTypeGroups.length === 0) return [];

    const now = new Date();
    const currentYear = now.getFullYear();

    // 1. YEARLY MODE
    if (granularity === "yearly") {
      const yearsSet = new Set<number>();
      const startFilterYear = dateFrom ? dateFrom.getFullYear() : -Infinity;
      const endFilterYear = dateTo ? dateTo.getFullYear() : Infinity;

      for (const r of allRows) {
        if (r.requestStatus !== "APPROVED") continue;
        const dt = r.priceChangeDatetime ?? r.approvedAt;
        if (!dt) continue;
        const y = new Date(dt).getFullYear();
        if (Number.isFinite(y) && y >= startFilterYear && y <= endFilterYear) {
          yearsSet.add(y);
        }
      }
      if (currentYear >= startFilterYear && currentYear <= endFilterYear) {
        yearsSet.add(currentYear);
      }

      const sortedYears = Array.from(yearsSet).sort((a, b) => a - b);
      const prevPriceMap: Record<string, number | null> = {};

      return sortedYears.map((y) => {
        const displayDate = `Year ${y}`;
        const point: Record<
          string,
          string | number | boolean | null | ViewPriceMonitoringRow | undefined
        > = {
          dateLabel: String(y),
          displayDate,
          timestamp: new Date(y, 11, 31).getTime(),
        };

        const activeDate =
          y === currentYear ? now : new Date(y, 11, 31, 23, 59, 59, 999);
        const startOfChart = new Date(y, 0, 1, 0, 0, 0, 0);

        for (const group of priceTypeGroups) {
          const { activePrice, activeEvent } = getActivePriceForGroup(
            group,
            activeDate,
            allRows,
            startOfChart,
          );
          point[`${group.priceTypeName}_prevPrice`] =
            prevPriceMap[group.priceTypeName] ?? null;
          point[group.priceTypeName] = activePrice;
          point[`${group.priceTypeName}_event`] = activeEvent;
          point[`${group.priceTypeName}_changed`] = false;
          prevPriceMap[group.priceTypeName] = activePrice;
        }

        return point;
      });
    }

    const startOfChart = dateFrom
      ? new Date(dateFrom)
      : new Date(selectedYear, 0, 1, 0, 0, 0, 0);
    let endOfChart = dateTo
      ? new Date(dateTo)
      : new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    if (endOfChart > now) {
      endOfChart = now;
    }

    // 2. MONTHLY MODE
    if (granularity === "monthly") {
      const points = [];
      let currentDate = new Date(
        startOfChart.getFullYear(),
        startOfChart.getMonth(),
        1,
        0,
        0,
        0,
        0,
      );
      const prevPriceMap: Record<string, number | null> = {};

      while (currentDate <= endOfChart) {
        const m = currentDate.getMonth();
        const y = currentDate.getFullYear();
        const label = currentDate.toLocaleDateString("en-PH", { month: "short" });
        const displayDate = currentDate.toLocaleDateString("en-PH", {
          month: "long",
          year: "numeric",
        });
        const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);
        const activeDate = endOfMonth > endOfChart ? endOfChart : endOfMonth;

        const point: Record<
          string,
          string | number | boolean | null | ViewPriceMonitoringRow | undefined
        > = { dateLabel: label, displayDate, timestamp: activeDate.getTime() };

        for (const group of priceTypeGroups) {
          const { activePrice, activeEvent } = getActivePriceForGroup(
            group,
            activeDate,
            allRows,
            startOfChart,
          );
          const monthEvents = group.rows.filter((r) => {
            const dt = r.priceChangeDatetime ?? r.approvedAt;
            if (!dt) return false;
            const d = new Date(dt);
            return d.getFullYear() === y && d.getMonth() === m;
          });
          point[`${group.priceTypeName}_prevPrice`] =
            prevPriceMap[group.priceTypeName] ?? null;
          point[group.priceTypeName] = activePrice;
          point[`${group.priceTypeName}_event`] =
            monthEvents.length > 0 ? monthEvents[monthEvents.length - 1] : activeEvent;
          point[`${group.priceTypeName}_changed`] = monthEvents.length > 0;
          prevPriceMap[group.priceTypeName] = activePrice;
        }

        points.push(point);
        currentDate = new Date(y, m + 1, 1, 0, 0, 0, 0);
      }
      return points;
    }

    // 3. WEEKLY MODE
    if (granularity === "weekly") {
      const points = [];
      let currentWeekDate = new Date(startOfChart);
      let lastLabelMonth = -1;
      let monthWeekCounter = 0;
      const prevPriceMap: Record<string, number | null> = {};

      while (currentWeekDate <= endOfChart) {
        const weekMonth = currentWeekDate.getMonth();
        if (weekMonth !== lastLabelMonth) {
          lastLabelMonth = weekMonth;
          monthWeekCounter = 1;
        } else {
          monthWeekCounter++;
        }

        const monthShort = currentWeekDate.toLocaleDateString("en-PH", {
          month: "short",
        });
        const label = `${monthShort} W${monthWeekCounter}`;
        const displayDate = `${currentWeekDate.toLocaleDateString("en-PH", { month: "long", year: "numeric" })} — Week ${monthWeekCounter}`;

        const activeDate = new Date(
          currentWeekDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1,
        );
        const activeCapped = activeDate > endOfChart ? endOfChart : activeDate;

        const point: Record<
          string,
          string | number | boolean | null | ViewPriceMonitoringRow | undefined
        > = {
          dateLabel: label,
          displayDate,
          timestamp: activeCapped.getTime(),
        };

        for (const group of priceTypeGroups) {
          const { activePrice, activeEvent } = getActivePriceForGroup(
            group,
            activeCapped,
            allRows,
            startOfChart,
          );
          const weekEvents = group.rows.filter((r) => {
            const dt = r.priceChangeDatetime ?? r.approvedAt;
            if (!dt) return false;
            const t = new Date(dt).getTime();
            return (
              t >= currentWeekDate.getTime() && t <= activeCapped.getTime()
            );
          });
          point[`${group.priceTypeName}_prevPrice`] =
            prevPriceMap[group.priceTypeName] ?? null;
          point[group.priceTypeName] = activePrice;
          point[`${group.priceTypeName}_event`] =
            weekEvents.length > 0
              ? weekEvents[weekEvents.length - 1]
              : activeEvent;
          point[`${group.priceTypeName}_changed`] = weekEvents.length > 0;
          prevPriceMap[group.priceTypeName] = activePrice;
        }

        points.push(point);
        currentWeekDate = new Date(
          currentWeekDate.getTime() + 7 * 24 * 60 * 60 * 1000,
        );
      }
      return points;
    }

    // 4. DAILY MODE
    const points = [];
    let currentDate = new Date(startOfChart);
    const prevPriceMap: Record<string, number | null> = {};

    while (currentDate <= endOfChart) {
      const label = currentDate.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      });
      const displayDate = currentDate.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const activeCapped = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        23,
        59,
        59,
        999,
      );
      const activeDate = activeCapped > endOfChart ? endOfChart : activeCapped;

      const point: Record<
        string,
        string | number | boolean | null | ViewPriceMonitoringRow | undefined
      > = { dateLabel: label, displayDate, timestamp: activeDate.getTime() };

      for (const group of priceTypeGroups) {
        const { activePrice, activeEvent } = getActivePriceForGroup(
          group,
          activeDate,
          allRows,
          startOfChart,
        );
        const dayEvents = group.rows.filter((r) => {
          const dt = r.priceChangeDatetime ?? r.approvedAt;
          if (!dt) return false;
          const d = new Date(dt);
          return (
            d.getFullYear() === currentDate.getFullYear() &&
            d.getMonth() === currentDate.getMonth() &&
            d.getDate() === currentDate.getDate()
          );
        });
        point[`${group.priceTypeName}_prevPrice`] =
          prevPriceMap[group.priceTypeName] ?? null;
        point[group.priceTypeName] = activePrice;
        point[`${group.priceTypeName}_event`] =
          dayEvents.length > 0 ? dayEvents[dayEvents.length - 1] : activeEvent;
        point[`${group.priceTypeName}_changed`] = dayEvents.length > 0;
        prevPriceMap[group.priceTypeName] = activePrice;
      }

      points.push(point);
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() + 1,
        0,
        0,
        0,
        0,
      );
    }
    return points;
  }, [priceTypeGroups, allRows, selectedYear, granularity, dateFrom, dateTo]);

  if (loading) {
    return <Skeleton className="h-[240px] sm:h-[350px] w-full rounded-lg" />;
  }

  if (priceTypeGroups.length === 0) {
    return (
      <div className="flex h-[240px] sm:h-[350px] items-center justify-center rounded-lg border border-dashed text-muted-foreground gap-2 text-sm">
        <Activity className="h-4 w-4" />
        No data to chart for {selectedYear}.
      </div>
    );
  }

  // Shared Y-axis domain computation
  const yAxisDomain = [
    0,
    (() => {
      const allValues = chartData.flatMap((pt) =>
        priceTypeGroups
          .map((g) => pt[g.priceTypeName] as number | null)
          .filter((v): v is number => v != null),
      );
      if (allValues.length === 0) return 1000;
      const max = Math.max(...allValues);
      const buffer = max * 0.1;
      const raw = max + buffer;
      const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
      return Math.ceil(raw / magnitude) * magnitude;
    })(),
  ] as [number, number];

  const yAxisFormatter = (v: number) => {
    if (v === 0) return "0";
    if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return `${v}`;
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Chart area — shorter on mobile */}
      <div className="w-full h-[220px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={yAxisDomain}
                tickFormatter={yAxisFormatter}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                formatter={(value) => mapPriceTypeName(value)}
              />
              {priceTypeGroups.map((group) => (
                <Bar
                  key={group.priceTypeId}
                  dataKey={group.priceTypeName}
                  fill={getPriceTypeColor(group.priceTypeSort)}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={yAxisDomain}
                tickFormatter={yAxisFormatter}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                formatter={(value) => mapPriceTypeName(value)}
              />
              {priceTypeGroups.map((group) => (
                <Line
                  key={group.priceTypeId}
                  type="monotone"
                  dataKey={group.priceTypeName}
                  stroke={getPriceTypeColor(group.priceTypeSort)}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}