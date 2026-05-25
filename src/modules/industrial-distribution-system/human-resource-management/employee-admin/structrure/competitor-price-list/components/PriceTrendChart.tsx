"use client";

import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Area,
  ReferenceLine,
  ComposedChart,
  Bar,
  BarChart,
  Cell,
  LabelList,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownUp,
  BarChart2,
  LineChart as LineChartIcon,
} from "lucide-react";

import type { CompetitorPriceEntry } from "../types";
import { parseEntryDate, resolveCompetitorName } from "../utils/analytics";

interface PriceTrendChartProps {
  data: CompetitorPriceEntry[];
  competitorId?: string;
  competitorName?: string;
}

// ─── Analytics View Type ─────────────────────────────────────────────────────

type AnalyticsView = "comparison" | "spread" | "indexed" | "range" | "snapshot";

// ─── Bar Chart Sub-Mode ───────────────────────────────────────────────────────

type BarMode = "ranked" | "delta";
type SortOrder = "asc" | "desc";

// ─── Color Helpers ────────────────────────────────────────────────────────────

const getCompetitorColor = (index: number) => {
  const hues = [200, 280, 45, 10, 140, 320, 80, 240];
  const hue = hues[index % hues.length];
  return `hsl(${hue}, 75%, 50%)`;
};

const resolveCompetitorId = (entry: CompetitorPriceEntry): string => {
  const c = entry.competitor_id;
  return typeof c === "object" && c !== null ? String(c.id) : String(c);
};

const getCompetitorKey = (id: string) => `competitor_${id}`;

// ─── Snapshot Bar Data Builder ────────────────────────────────────────────────

interface BarEntry {
  name: string;
  price: number;
  delta: number | null;
  isOurs: boolean;
  colorIndex: number;
}

function buildSnapshotBarData(
  data: CompetitorPriceEntry[],
  barMode: BarMode,
  sortOrder: SortOrder,
): {
  barData: BarEntry[];
  ourPrice: number | null;
  marketAvg: number;
} {
  if (!data || data.length === 0) {
    return { barData: [], ourPrice: null, marketAvg: 0 };
  }

  // Determine our price from first entry that has it
  const ourPriceEntry = data.find((e) => e.our_price != null);
  const ourPrice = ourPriceEntry?.our_price ?? null;

  // Group competitor prices by name → average
  const grouped = new Map<string, number[]>();
  for (const entry of data) {
    const name = resolveCompetitorName(entry);
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push(Number(entry.price));
  }

  let colorIndex = 0;
  const rows: BarEntry[] = [];

  grouped.forEach((prices, name) => {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    rows.push({
      name,
      price: Number(avg.toFixed(2)),
      delta: ourPrice != null ? Number((avg - ourPrice).toFixed(2)) : null,
      isOurs: false,
      colorIndex: colorIndex++,
    });
  });

  // Add "Our Price" as a special highlighted bar
  if (ourPrice != null) {
    rows.push({
      name: "Our Price ★",
      price: ourPrice,
      delta: 0,
      isOurs: true,
      colorIndex: -1,
    });
  }

  const marketAvg =
    rows.filter((r) => !r.isOurs).reduce((a, b) => a + b.price, 0) /
    (rows.filter((r) => !r.isOurs).length || 1);

  // Sort
  const sortKey = barMode === "delta" ? "delta" : "price";
  const sorted = [...rows].sort((a, b) => {
    const aVal = a[sortKey] ?? a.price;
    const bVal = b[sortKey] ?? b.price;
    return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
  });

  return { barData: sorted, ourPrice, marketAvg };
}

// ─── Custom Tooltip for Bar Chart ─────────────────────────────────────────────

function SnapshotTooltip({
  active,
  payload,
  barMode,
  ourPrice,
}: {
  active?: boolean;
  payload?: Array<{ payload: BarEntry; value: number }>;
  barMode: BarMode;
  ourPrice: number | null;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  const val = barMode === "delta" ? entry.delta : entry.price;

  return (
    <div className="rounded-lg border bg-background shadow-lg px-3.5 py-3 text-sm min-w-[180px]">
      <p className="font-bold mb-1 text-foreground truncate max-w-[200px]">
        {entry.name}
      </p>
      {barMode === "ranked" ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground text-xs">Avg Price</span>
            <span className="font-mono font-semibold text-primary">
              ₱{entry.price.toFixed(2)}
            </span>
          </div>
          {ourPrice != null && !entry.isOurs && (
            <div className="flex items-center justify-between gap-4 mt-0.5">
              <span className="text-muted-foreground text-xs">
                vs Our Price
              </span>
              <span
                className={`font-mono font-semibold text-xs ${
                  entry.delta! > 0
                    ? "text-rose-500"
                    : entry.delta! < 0
                      ? "text-emerald-500"
                      : "text-slate-400"
                }`}
              >
                {entry.delta! > 0 ? "+" : ""}₱{entry.delta!.toFixed(2)}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground text-xs">
            {entry.isOurs ? "Baseline" : "vs Our Price"}
          </span>
          <span
            className={`font-mono font-semibold ${
              val! > 0
                ? "text-rose-500"
                : val! < 0
                  ? "text-emerald-500"
                  : "text-slate-400"
            }`}
          >
            {val! > 0 ? "+" : ""}₱{val!.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Snapshot Bar Chart ───────────────────────────────────────────────────────

function SnapshotBarChart({
  data,
  barMode,
  sortOrder,
  competitorName,
}: {
  data: CompetitorPriceEntry[];
  barMode: BarMode;
  sortOrder: SortOrder;
  competitorName?: string;
}) {
  const { barData, ourPrice, marketAvg } = useMemo(
    () => buildSnapshotBarData(data, barMode, sortOrder),
    [data, barMode, sortOrder],
  );

  if (barData.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">
        No data to display for current selection.
      </div>
    );
  }

  const yTickFormatter = (value: number) => {
    if (barMode === "delta") {
      const sign = value > 0 ? "+" : "";
      return `${sign}₱${value}`;
    }
    return `₱${value}`;
  };

  return (
    <div className="h-[350px] w-full">
      <ChartContainer
        config={{
          price: { label: "Price", color: "hsl(var(--muted-foreground))" },
          ourPrice: { label: "Our Price", color: "hsl(var(--primary))" },
        }}
        className="h-full w-full"
      >
        <BarChart
          data={barData}
          margin={{ top: 20, right: 16, left: -8, bottom: 60 }}
          barCategoryGap="25%"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            angle={-35}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            tick={{ fontSize: 11 }}
            tickFormatter={yTickFormatter}
          />
          <ChartTooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            content={<SnapshotTooltip barMode={barMode} ourPrice={ourPrice} />}
          />

          {/* Market average reference line (only in ranked mode) */}
          {barMode === "ranked" && marketAvg > 0 && (
            <ReferenceLine
              y={marketAvg}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: `Market Avg ₱${marketAvg.toFixed(2)}`,
                position: "insideTopRight",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
                fontWeight: "600",
              }}
            />
          )}

          {/* Our price reference line (only in ranked mode) */}
          {barMode === "ranked" && ourPrice != null && (
            <ReferenceLine
              y={ourPrice}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeDasharray="6 3"
              label={{
                value: `Our Price ₱${ourPrice.toFixed(2)}`,
                position: "insideBottomRight",
                fill: "hsl(var(--primary))",
                fontSize: 10,
                fontWeight: "bold",
              }}
            />
          )}

          {/* Zero baseline for delta mode */}
          {barMode === "delta" && (
            <ReferenceLine
              y={0}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeDasharray="5 3"
              label={{
                value: "Our Price (Baseline)",
                position: "insideTopLeft",
                fill: "hsl(var(--primary))",
                fontSize: 10,
                fontWeight: "bold",
              }}
            />
          )}

          <Bar
            dataKey={barMode === "delta" ? "delta" : "price"}
            radius={[4, 4, 0, 0]}
            maxBarSize={52}
          >
            {barData.map((entry, index) => {
              if (entry.isOurs) {
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill="hsl(var(--primary))"
                    fillOpacity={1}
                  />
                );
              }
              if (barMode === "delta") {
                const isPositive = (entry.delta ?? 0) >= 0;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      isPositive ? "hsl(10, 75%, 55%)" : "hsl(140, 65%, 45%)"
                    }
                    fillOpacity={entry.name === competitorName ? 1.0 : 0.75}
                  />
                );
              }
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={getCompetitorColor(entry.colorIndex)}
                  fillOpacity={
                    competitorName && entry.name === competitorName ? 1.0 : 0.55
                  }
                />
              );
            })}
            <LabelList
              dataKey={barMode === "delta" ? "delta" : "price"}
              position="top"
              formatter={(val: number) => {
                if (val == null) return "";
                const sign = val > 0 && barMode === "delta" ? "+" : "";
                return `₱${sign}${val.toFixed(0)}`;
              }}
              style={{
                fontSize: 9,
                fontWeight: 600,
                fill: "hsl(var(--foreground))",
                opacity: 0.7,
              }}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PriceTrendChart({
  data,
  competitorId,
  competitorName,
}: PriceTrendChartProps) {
  const [showAllCompetitors, setShowAllCompetitors] = useState(false);
  const [analyticsView, setAnalyticsView] =
    useState<AnalyticsView>("comparison");

  // Bar chart sub-state
  const [barMode, setBarMode] = useState<BarMode>("ranked");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const { chartData, chartConfig, competitorSeries } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], chartConfig: {}, competitorSeries: [] };
    }

    const competitorSeries = Array.from(
      new Map(
        data.map((entry) => {
          const id = resolveCompetitorId(entry);
          return [
            id,
            {
              id,
              key: getCompetitorKey(id),
              name: resolveCompetitorName(entry),
            },
          ];
        }),
      ).values(),
    ).sort((a, b) => a.name.localeCompare(b.name));

    // Group entries by date
    const grouped = new Map<
      string,
      {
        ourPrices: number[];
        competitorPrices: number[];
        individualCompetitors: Map<string, number[]>;
      }
    >();

    data.forEach((entry) => {
      const dateObj = parseEntryDate(entry.created_at);
      if (!dateObj) return;
      const dateKey = `${dateObj.getFullYear()}-${String(
        dateObj.getMonth() + 1,
      ).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, {
          ourPrices: [],
          competitorPrices: [],
          individualCompetitors: new Map(),
        });
      }
      const dateMap = grouped.get(dateKey)!;

      const price = Number(entry.price);
      const isValidPrice = Number.isFinite(price);

      // Collect competitor price for average
      if (isValidPrice) {
        dateMap.competitorPrices.push(price);
      }

      // Collect competitor price individually (use stable key)
      const competitorKey = getCompetitorKey(resolveCompetitorId(entry));
      if (!dateMap.individualCompetitors.has(competitorKey)) {
        dateMap.individualCompetitors.set(competitorKey, []);
      }
      if (isValidPrice) {
        dateMap.individualCompetitors.get(competitorKey)!.push(price);
      }

      // Collect our price if available
      const ourPrice = Number(entry.our_price);
      if (Number.isFinite(ourPrice)) {
        dateMap.ourPrices.push(ourPrice);
      }
    });

    const sortedDates = Array.from(grouped.keys()).sort();

    // ─── Base Computations ───
    const baseData = sortedDates.map((dateKey) => {
      const dateObj = new Date(dateKey);
      const formattedDate = dateObj.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
      });
      const { ourPrices, competitorPrices, individualCompetitors } =
        grouped.get(dateKey)!;

      const row: Record<string, string | number | undefined> = {
        date: formattedDate,
        rawDate: dateKey,
      };

      if (ourPrices.length > 0) {
        row["ourPrice"] =
          ourPrices.reduce((a, b) => a + b, 0) / ourPrices.length;
      }

      if (competitorPrices.length > 0) {
        row["competitorPrice"] =
          competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
        row["minPrice"] = Math.min(...competitorPrices);
        row["maxPrice"] = Math.max(...competitorPrices);
        row["rangeDiff"] =
          Math.max(...competitorPrices) - Math.min(...competitorPrices);
      }

      individualCompetitors.forEach((prices, key) => {
        row[key] = prices.reduce((a, b) => a + b, 0) / prices.length;
      });

      return row;
    });

    // ─── View Transformation ───
    let transformedData: Record<string, string | number | undefined>[] = [];

    if (
      analyticsView === "comparison" ||
      analyticsView === "range" ||
      analyticsView === "snapshot"
    ) {
      transformedData = baseData.map((row) => {
        const newRow: Record<string, string | number | undefined> = {
          date: row.date,
        };
        if (row.ourPrice !== undefined)
          newRow.ourPrice = Number(Number(row.ourPrice).toFixed(2));
        if (row.competitorPrice !== undefined)
          newRow.competitorPrice = Number(
            Number(row.competitorPrice).toFixed(2),
          );
        if (row.minPrice !== undefined)
          newRow.minPrice = Number(Number(row.minPrice).toFixed(2));
        if (row.maxPrice !== undefined)
          newRow.maxPrice = Number(Number(row.maxPrice).toFixed(2));
        if (row.rangeDiff !== undefined)
          newRow.rangeDiff = Number(Number(row.rangeDiff).toFixed(2));

        competitorSeries.forEach((series) => {
          if (row[series.key] !== undefined) {
            newRow[series.key] = Number(Number(row[series.key]).toFixed(2));
          }
        });
        return newRow;
      });
    } else if (analyticsView === "spread") {
      transformedData = baseData
        .map((row) => {
          const newRow: Record<string, string | number | undefined> = {
            date: row.date,
          };
          if (row.ourPrice === undefined) return newRow;

          newRow.ourBaseline = 0;

          if (row.competitorPrice !== undefined) {
            newRow.competitorPrice = Number(
              (
                (row.competitorPrice as number) - (row.ourPrice as number)
              ).toFixed(2),
            );
          }

          competitorSeries.forEach((series) => {
            if (row[series.key] !== undefined) {
              newRow[series.key] = Number(
                (
                  (row[series.key] as number) - (row.ourPrice as number)
                ).toFixed(2),
              );
            }
          });

          return newRow;
        })
        .filter((row) => Object.keys(row).length > 1);
    } else if (analyticsView === "indexed") {
      let baseOur: number | null = null;
      let baseComp: number | null = null;
      const baseCompetitors: Record<string, number> = {};

      for (const row of baseData) {
        if (baseOur === null && row.ourPrice !== undefined) {
          const val = Number(row.ourPrice);
          if (Number.isFinite(val) && val > 0) baseOur = val;
        }
        if (baseComp === null && row.competitorPrice !== undefined) {
          const val = Number(row.competitorPrice);
          if (Number.isFinite(val) && val > 0) baseComp = val;
        }
        competitorSeries.forEach((series) => {
          if (
            baseCompetitors[series.key] === undefined &&
            row[series.key] !== undefined
          ) {
            const val = Number(row[series.key]);
            if (Number.isFinite(val) && val > 0)
              baseCompetitors[series.key] = val;
          }
        });
      }

      transformedData = baseData.map((row) => {
        const newRow: Record<string, string | number | undefined> = {
          date: row.date,
        };

        if (baseOur !== null && row.ourPrice !== undefined) {
          const val = Number(row.ourPrice);
          const indexed = (val / baseOur) * 100;
          if (Number.isFinite(indexed)) {
            newRow.ourPrice = Number(indexed.toFixed(2));
          }
        }

        if (baseComp !== null && row.competitorPrice !== undefined) {
          const val = Number(row.competitorPrice);
          const indexed = (val / baseComp) * 100;
          if (Number.isFinite(indexed)) {
            newRow.competitorPrice = Number(indexed.toFixed(2));
          }
        }

        competitorSeries.forEach((series) => {
          const baseVal = baseCompetitors[series.key];
          if (baseVal !== undefined && row[series.key] !== undefined) {
            const val = Number(row[series.key]);
            const indexed = (val / baseVal) * 100;
            if (Number.isFinite(indexed)) {
              newRow[series.key] = Number(indexed.toFixed(2));
            }
          }
        });

        return newRow;
      });
    }

    // ─── Chart Config ───
    const chartConfig: ChartConfig = {
      ourPrice: {
        label: "Our Price",
        color: "hsl(var(--primary))",
      },
      competitorPrice: {
        label: "Market Average",
        color: "hsl(var(--muted-foreground))",
      },
    };

    if (analyticsView === "spread") {
      chartConfig.ourBaseline = {
        label: "Our Price (Baseline)",
        color: "hsl(var(--primary))",
      };
    }

    const activeCompetitor = competitorId
      ? competitorSeries.find((series) => series.id === competitorId)
      : undefined;

    if (showAllCompetitors) {
      competitorSeries.forEach((series, index) => {
        chartConfig[series.key] = {
          label: series.name,
          color: getCompetitorColor(index),
        };
      });
    } else if (activeCompetitor) {
      const activeIndex = competitorSeries.findIndex(
        (series) => series.id === activeCompetitor.id,
      );
      chartConfig[activeCompetitor.key] = {
        label: activeCompetitor.name,
        color:
          activeIndex >= 0
            ? getCompetitorColor(activeIndex)
            : "hsl(200, 75%, 50%)",
      };
    }

    return { chartData: transformedData, chartConfig, competitorSeries };
  }, [data, competitorId, showAllCompetitors, analyticsView]);

  const activeCompetitor = useMemo(() => {
    if (!competitorId) return undefined;
    return competitorSeries.find((series) => series.id === competitorId);
  }, [competitorId, competitorSeries]);

  const competitorColor = useMemo(() => {
    if (!activeCompetitor) return "hsl(200, 75%, 50%)";
    const index = competitorSeries.findIndex(
      (series) => series.id === activeCompetitor.id,
    );
    return index >= 0 ? getCompetitorColor(index) : "hsl(200, 75%, 50%)";
  }, [activeCompetitor, competitorSeries]);

  React.useEffect(() => {
    console.log("[PriceTrendChart] analyticsView:", analyticsView);
    console.log("[PriceTrendChart] showAllCompetitors:", showAllCompetitors);
    console.log(
      "[PriceTrendChart] competitorSeries:",
      competitorSeries.map((series) => ({
        id: series.id,
        key: series.key,
        name: series.name,
      })),
    );

    const marketAvgSample = chartData.slice(0, 5).map((row) => ({
      date: row.date,
      ourPrice: row.ourPrice,
      competitorPrice: row.competitorPrice,
    }));

    const marketAvgPoints = chartData.filter(
      (row) => typeof row.competitorPrice === "number",
    ).length;
    const ourPricePoints = chartData.filter(
      (row) => typeof row.ourPrice === "number",
    ).length;

    console.log("[PriceTrendChart] chartData sample:", chartData.slice(0, 3));
    console.log("[PriceTrendChart] market avg sample:", marketAvgSample);
    console.log(
      "[PriceTrendChart] points (marketAvg/ourPrice/total):",
      marketAvgPoints,
      ourPricePoints,
      chartData.length,
    );
  }, [analyticsView, showAllCompetitors, competitorSeries, chartData]);

  if (chartData.length === 0 && analyticsView !== "snapshot") {
    return null;
  }

  // ─── If snapshot mode, render bar chart ──────────────────────────────────

  if (analyticsView === "snapshot") {
    // Count competitors for display
    const uniqueCompetitors = competitorSeries.length;
    const ourPriceVal = data.find((e) => e.our_price != null)?.our_price;

    return (
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 space-y-2 sm:space-y-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold">
                Market Position
              </CardTitle>
              <Badge
                variant="secondary"
                className="text-xs font-semibold gap-1"
              >
                <BarChart2 className="h-3 w-3" />
                Snapshot Mode
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {barMode === "ranked"
                ? `Current price ranking across ${uniqueCompetitors} competitor${uniqueCompetitors !== 1 ? "s" : ""} — sorted ${sortOrder === "asc" ? "cheapest first" : "most expensive first"}`
                : `Competitive pressure: positive bars are more expensive than us, negative bars are cheaper`}
              {ourPriceVal != null &&
                ` · Our Price: ₱${ourPriceVal.toFixed(2)}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle: Line vs Bar */}
            <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium gap-1"
                onClick={() => setAnalyticsView("comparison")}
                title="Line Chart — Trends"
              >
                <LineChartIcon className="h-3 w-3" />
                Trends
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setAnalyticsView("spread")}
                title="Price Gap Spread"
              >
                Spread
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setAnalyticsView("indexed")}
                title="Indexed Comparison"
              >
                Indexed
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setAnalyticsView("range")}
                title="Band / Range Chart"
              >
                Range
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium gap-1"
                onClick={() => setAnalyticsView("snapshot")}
                title="Snapshot Bar Chart"
              >
                <BarChart2 className="h-3 w-3" />
                Snapshot
              </Button>
            </div>

            {/* Bar mode toggle */}
            <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs">
              <Button
                variant={barMode === "ranked" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setBarMode("ranked")}
                title="Ranked by raw price"
              >
                Ranked
              </Button>
              <Button
                variant={barMode === "delta" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setBarMode("delta")}
                title="Delta vs Our Price"
              >
                Δ Delta
              </Button>
            </div>

            {/* Sort toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
              }
              className="h-7 gap-1.5 text-xs"
              title={
                sortOrder === "asc"
                  ? "Sorted: cheapest first"
                  : "Sorted: most expensive first"
              }
            >
              <ArrowDownUp className="h-3 w-3" />
              {sortOrder === "asc" ? "Cheapest First" : "Most Expensive First"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SnapshotBarChart
            data={data}
            barMode={barMode}
            sortOrder={sortOrder}
            competitorName={competitorName}
          />

          {/* Legend pills */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            {barMode === "ranked" ? (
              <>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
                  Our Price
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-2.5 w-2.5 rounded-sm bg-muted-foreground opacity-55" />
                  Competitors (muted)
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-0.5 w-5 bg-muted-foreground border-dashed border-t-2" />
                  Market Avg
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-0.5 w-5 bg-primary border-dashed border-t-2" />
                  Our Price Line
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <div className="h-2.5 w-2.5 rounded-sm bg-rose-500 opacity-75" />
                  More expensive than us (+)
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500 opacity-75" />
                  Cheaper than us (−)
                </div>
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
                  Our Price (baseline = 0)
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Line / composed chart rendering ─────────────────────────────────────

  const renderChartContent = () => {
    switch (analyticsView) {
      case "spread":
        return (
          <LineChart
            key="spread"
            data={chartData}
            margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tickFormatter={(value) => {
                const val = Number(value);
                return `${val > 0 ? "+" : ""}₱${val}`;
              }}
            />
            <ChartTooltip
              cursor={{
                stroke: "hsl(var(--muted-foreground))",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  formatter={(value) => {
                    const val = Number(value);
                    const sign = val > 0 ? "+" : "";
                    return `${sign}₱${val.toFixed(2)}`;
                  }}
                />
              }
            />
            <ChartLegend
              content={<ChartLegendContent />}
              className="flex-wrap mt-4"
            />

            <ReferenceLine
              y={0}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: "Our Price (Baseline)",
                position: "top",
                fill: "hsl(var(--primary))",
                fontSize: 10,
                fontWeight: "bold",
              }}
            />

            {showAllCompetitors ? (
              competitorSeries.map((series, index) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.key}
                  stroke={getCompetitorColor(index)}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  connectNulls
				  name={series.name}
                />
              ))
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="ourBaseline"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  strokeOpacity={0.9}
                  dot={false}
                  activeDot={false}
                  connectNulls
                  name="Our Price (Baseline)"
                />
                <Line
                  type="monotone"
                  dataKey="competitorPrice"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeOpacity={0.95}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                  name="Market Average"
                />
                {activeCompetitor && (
                  <Line
                    key={activeCompetitor.id}
                    type="monotone"
                    dataKey={activeCompetitor.key}
                    stroke={competitorColor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                    name={activeCompetitor.name}
                  />
                )}
              </>
            )}
          </LineChart>
        );
      case "indexed":
        return (
          <LineChart
            key="indexed"
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tickFormatter={(value) => `${value}`}
            />
            <ChartTooltip
              cursor={{
                stroke: "hsl(var(--muted-foreground))",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  formatter={(value) => {
                    const val = Number(value);
                    return `${val.toFixed(1)}%`;
                  }}
                />
              }
            />
            <ChartLegend
              content={<ChartLegendContent />}
              className="flex-wrap mt-4"
            />

            {showAllCompetitors ? (
              <>
                {competitorSeries.map((series, index) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.key}
                    stroke={getCompetitorColor(index)}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    strokeOpacity={0.35}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                    name={series.name}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="ourPrice"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{
                    r: 4,
                    strokeWidth: 1.5,
                    fill: "hsl(var(--primary))",
                  }}
                  activeDot={{ r: 6 }}
                  connectNulls
                  name="Our Price"
                />
              </>
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="ourPrice"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.2}
                  dot={{
                    r: 4,
                    strokeWidth: 1.5,
                    fill: "hsl(var(--primary))",
                  }}
                  activeDot={{ r: 6 }}
                  connectNulls
                  name="Our Price"
                />

                <Line
                  type="monotone"
                  dataKey="competitorPrice"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeOpacity={0.95}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                  name="Market Average"
                />

                {activeCompetitor && (
                  <Line
                    key={activeCompetitor.id}
                    type="monotone"
                    dataKey={activeCompetitor.key}
                    stroke={competitorColor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                    name={activeCompetitor.name}
                  />
                )}
              </>
            )}
          </LineChart>
        );
      case "range":
        return (
          <ComposedChart
            key="range"
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tickFormatter={(value) => `₱${value}`}
            />
            <ChartTooltip
              cursor={{
                stroke: "hsl(var(--muted-foreground))",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value, name) => {
                    const val = Number(value);
                    if (name === "rangeDiff")
                      return `₱${val.toFixed(2)} (Spread)`;
                    return `₱${val.toFixed(2)}`;
                  }}
                />
              }
            />
            <ChartLegend
              content={<ChartLegendContent />}
              className="flex-wrap mt-4"
            />

            {/* Stacked Range Area (show only when competitor is focused or All Competitors) */}
            {(showAllCompetitors || !!activeCompetitor) && (
              <>
                <Area
                  type="monotone"
                  dataKey="minPrice"
                  stackId="range"
                  stroke="none"
                  fill="transparent"
                  fillOpacity={0}
                  connectNulls
                  name="Market Min"
                />
                <Area
                  type="monotone"
                  dataKey="rangeDiff"
                  stackId="range"
                  stroke="none"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.12}
                  name="Market Volatility Band"
                  connectNulls
                />
              </>
            )}

            {activeCompetitor && (
              <Line
                type="monotone"
                dataKey={activeCompetitor.key}
                stroke={competitorColor}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={activeCompetitor.name}
                connectNulls
              />
            )}

            {/* Our Price Line */}
            <Line
              type="monotone"
              dataKey="ourPrice"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 1.5, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 6 }}
              name="Our Price"
              connectNulls
            />

            {/* Market Average Line (rendered after Our Price for visibility) */}
            <Line
              type="monotone"
              dataKey="competitorPrice"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeOpacity={0.9}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              name="Market Average"
              connectNulls
            />
          </ComposedChart>
        );
      case "comparison":
      default:
        return (
          <LineChart
            key="comparison"
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tickFormatter={(value) => `₱${value}`}
            />
            <ChartTooltip
              cursor={{
                stroke: "hsl(var(--muted-foreground))",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  formatter={(value) => {
                    const val = Number(value);
                    return `₱${val.toFixed(2)}`;
                  }}
                />
              }
            />
            <ChartLegend
              content={<ChartLegendContent />}
              className="flex-wrap mt-4"
            />

            {showAllCompetitors ? (
              <>
                {competitorSeries.map((series, index) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.key}
                    stroke={getCompetitorColor(index)}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    strokeOpacity={0.35}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls
					name={series.name}
                  />
                ))}

                {/* Our Price Line (Primary - rendered last so it's on top z-index) */}
                <Line
                  type="monotone"
                  dataKey="ourPrice"
                  stroke="var(--color-ourPrice)"
                  strokeWidth={2.5}
                  dot={{
                    r: 4,
                    strokeWidth: 1.5,
                    fill: "var(--color-ourPrice)",
                  }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              </>
            ) : (
              <>
                {/* Our Price Line */}
                <Line
                  type="monotone"
                  dataKey="ourPrice"
                  stroke="var(--color-ourPrice)"
                  strokeWidth={2.2}
                  dot={{
                    r: 4,
                    strokeWidth: 1.5,
                    fill: "var(--color-ourPrice)",
                  }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />

                {/* Market Average Line (rendered after our price for visibility) */}
                <Line
                  type="monotone"
                  dataKey="competitorPrice"
                  stroke="var(--color-competitorPrice)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeOpacity={0.9}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />

                {activeCompetitor && (
                  <Line
                    key={activeCompetitor.id}
                    type="monotone"
                    dataKey={activeCompetitor.key}
                    stroke={competitorColor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                )}
              </>
            )}
          </LineChart>
        );
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 space-y-2 sm:space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold">Market Position</CardTitle>
          <CardDescription>
            {analyticsView === "comparison"
              ? competitorName
                ? `Comparison: Our Price vs ${competitorName}`
                : "Compare OUR Price vs competitors and market average"
              : analyticsView === "spread"
                ? "Price gap: Competitor Price − Our Price (Above 0 means competitor is more expensive)"
                : analyticsView === "indexed"
                  ? "Normalized trends starting at 100 (removes category/size distortion)"
                  : "Market Volatility: Competitor price range (max/min) vs Our Price"}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Analytics View Selector Button Group */}
          <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs">
            <Button
              variant={analyticsView === "comparison" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs font-medium gap-1"
              onClick={() => setAnalyticsView("comparison")}
              title="Multi-Line Comparison"
            >
              <LineChartIcon className="h-3 w-3" />
              Trends
            </Button>
            <Button
              variant={analyticsView === "spread" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={() => setAnalyticsView("spread")}
              title="Price Gap Spread"
            >
              Spread
            </Button>
            <Button
              variant={analyticsView === "indexed" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={() => setAnalyticsView("indexed")}
              title="Indexed Comparison"
            >
              Indexed
            </Button>
            <Button
              variant={analyticsView === "range" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={() => setAnalyticsView("range")}
              title="Band / Range Chart"
            >
              Range
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs font-medium gap-1"
              onClick={() => setAnalyticsView("snapshot")}
              title="Snapshot Bar Chart — Current Market View"
            >
              <BarChart2 className="h-3 w-3" />
              Snapshot
            </Button>
          </div>

          <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs">
            <Button
              variant={!showAllCompetitors ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={() => setShowAllCompetitors(false)}
              title="Show Market Average"
            >
              Market Avg
            </Button>
            <Button
              variant={showAllCompetitors ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={() => setShowAllCompetitors(true)}
              title="Show All Competitors"
            >
              All Competitors
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          {renderChartContent()}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
