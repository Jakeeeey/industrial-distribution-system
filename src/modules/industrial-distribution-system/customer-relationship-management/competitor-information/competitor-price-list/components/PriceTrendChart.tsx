"use client";

import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
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
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {

  BarChart2,
  LineChart as LineChartIcon,
} from "lucide-react";

import type { CompetitorPriceEntry } from "../types";
import { parseEntryDate, resolveCompetitorName } from "../utils/analytics";
import { Separator } from "@/components/ui/separator";

interface PriceTrendChartProps {
  data: CompetitorPriceEntry[];
  competitorId?: string;
  competitorName?: string;
  dateFrom?: Date;
  dateTo?: Date;
  /** Controls which direction the chart auto-configures when a row is clicked:
   * - "competitor" → product mode (show products of the focused competitor vs our price)
   * - "product"    → all-competitors mode (show all competitors for the focused product vs our price)
   * - null/undefined → no auto-config, user controls via the toolbar toggle
   */
  focusMode?: "competitor" | "product" | null;
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

// ─── Stable Custom Dot Factories (module-level to prevent remounting) ─────────
// These MUST be defined outside the component so React sees a stable component
// identity. If defined inside, every render creates a new component type and
// React will unmount+remount every dot, causing jank and freezing.

type DotProps = {
  cx?: number;
  cy?: number;
  value?: number | null;
  isHoveredLine: boolean;
  baseColor: string;
  baseWidth: number;
  onEnter: () => void;
  onLeave: () => void;
};

const ChartDot = React.memo(function ChartDot({
  cx,
  cy,
  value,
  isHoveredLine,
  baseColor,
  baseWidth,
  onEnter,
  onLeave,
}: DotProps) {
  if (
    cx === undefined || cx === null || isNaN(cx) ||
    cy === undefined || cy === null || isNaN(cy) ||
    value === undefined || value === null || !isFinite(Number(value))
  ) return null;

  const visibleR = isHoveredLine ? 4.5 : Math.max(1.5, baseWidth + 0.5);
  const hitR = visibleR + 8;

  return (
    <g onMouseEnter={onEnter} onMouseLeave={onLeave} style={{ cursor: "pointer" }}>
      <circle cx={cx} cy={cy} r={hitR} fill="transparent" stroke="none" />
      <circle cx={cx} cy={cy} r={visibleR} fill={baseColor} stroke="white" strokeWidth={1.5} />
    </g>
  );
});

const ChartActiveDot = React.memo(function ChartActiveDot({
  cx,
  cy,
  value,
  isHoveredLine,
  baseColor,
  baseWidth,
  onEnter,
  onLeave,
}: DotProps) {
  if (
    cx === undefined || cx === null || isNaN(cx) ||
    cy === undefined || cy === null || isNaN(cy) ||
    value === undefined || value === null || !isFinite(Number(value))
  ) return null;

  const activeR = isHoveredLine ? 6.5 : Math.max(3, baseWidth + 2);

  return (
    <g onMouseEnter={onEnter} onMouseLeave={onLeave} style={{ cursor: "pointer" }}>
      <circle cx={cx} cy={cy} r={activeR + 4} fill={baseColor} fillOpacity={0.18} stroke="none" />
      <circle cx={cx} cy={cy} r={activeR + 1.5} fill="none" stroke={baseColor} strokeWidth={1.5} strokeOpacity={0.5} />
      <circle cx={cx} cy={cy} r={activeR} fill={baseColor} stroke="white" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={activeR + 10} fill="transparent" stroke="none" />
    </g>
  );
});

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
  isProductMode: boolean,
  competitorId?: string,
): {
  barData: BarEntry[];
  ourPrice: number | null;
  marketAvg: number;
} {
  if (!data || data.length === 0) {
    return { barData: [], ourPrice: null, marketAvg: 0 };
  }

  // Filter by competitor if in product mode
  const filteredData = isProductMode && competitorId
    ? data.filter((e) => resolveCompetitorId(e) === competitorId)
    : data;

  // Determine our price from first entry that has it
  const ourPriceEntry = filteredData.find((e) => e.our_price != null);
  const ourPrice = ourPriceEntry?.our_price ?? null;

  // Group competitor prices by product name (in product mode) or competitor name (in competitor mode)
  const grouped = new Map<string, { prices: number[]; ourPrices: number[] }>();
  for (const entry of filteredData) {
    const name = isProductMode
      ? (entry.product_name || `Product #${entry.product_id}`)
      : resolveCompetitorName(entry);
    
    if (!grouped.has(name)) {
      grouped.set(name, { prices: [], ourPrices: [] });
    }
    const group = grouped.get(name)!;
    group.prices.push(Number(entry.price));
    if (entry.our_price != null) {
      group.ourPrices.push(Number(entry.our_price));
    }
  }

  let colorIndex = 0;
  const rows: BarEntry[] = [];

  grouped.forEach((group, name) => {
    const avg = group.prices.reduce((a, b) => a + b, 0) / group.prices.length;
    const prodOurPrice = group.ourPrices.length > 0
      ? group.ourPrices.reduce((a, b) => a + b, 0) / group.ourPrices.length
      : null;

    rows.push({
      name,
      price: Number(avg.toFixed(2)),
      delta: prodOurPrice != null ? Number((avg - prodOurPrice).toFixed(2)) : (ourPrice != null ? Number((avg - ourPrice).toFixed(2)) : null),
      isOurs: false,
      colorIndex: colorIndex++,
    });
  });

  // Add "Our Price" as a special highlighted bar (only in non-product mode)
  if (!isProductMode && ourPrice != null) {
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
    <div className="rounded-xl border bg-background/95 backdrop-blur-md shadow-xl p-4 text-xs min-w-[200px] border-border/80">
      <p className="font-bold text-sm text-foreground truncate max-w-[220px] mb-2 border-b pb-1.5">
        {entry.name}
      </p>
      {barMode === "ranked" ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground font-medium">Avg Price</span>
            <span className="font-mono font-bold text-foreground">
              ₱{entry.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {ourPrice != null && !entry.isOurs && (
            <div className="flex items-center justify-between gap-4 border-t border-dashed pt-1.5 mt-1 text-[10px]">
              <span className="text-muted-foreground">vs Our Price</span>
              <span
                className={`font-mono font-bold ${
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
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground font-medium">
            {entry.isOurs ? "Baseline" : "vs Our Price"}
          </span>
          <span
            className={`font-mono font-bold ${
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

// ─── Custom Premium Tooltip for Line Chart ──────────────────────────────────────

interface CustomLineTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string | number;
    name: string;
    value: number;
    stroke?: string;
    color?: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
  analyticsView: AnalyticsView;
  showAllCompetitors: boolean;
  activeCompetitor?: { key: string; name: string };
  competitorSeries: Array<{ id: string; key: string; name: string }>;
  productSeries?: Array<{ id: string; key: string; name: string }>;
  isProductMode?: boolean;
  chartConfig: ChartConfig;
  hoveredLineKey: string | null;
  setHoveredLineKey: (key: string | null) => void;
  chartData: Array<Record<string, string | number | boolean | undefined>>;
}

function CustomLineTooltip({
  active,
  payload,
  label,
  analyticsView,
  showAllCompetitors,
  activeCompetitor,
  competitorSeries,
  productSeries = [],
  isProductMode = false,
  chartConfig,
  hoveredLineKey,
  chartData,
}: CustomLineTooltipProps) {
  if (!active) return null;

  const dataRow = payload?.[0]?.payload || chartData.find((row) => row.date === label);
  if (!dataRow) return null;
  const activeKeys = new Set<string>();

  if (isProductMode) {
    productSeries.forEach((s) => activeKeys.add(s.key));
    if (analyticsView === "comparison" || analyticsView === "indexed") {
      activeKeys.add("ourPrice");
    }
  } else if (analyticsView === "spread") {
    if (showAllCompetitors) {
      competitorSeries.forEach((s) => activeKeys.add(s.key));
    } else {
      activeKeys.add("competitorPrice");
      if (activeCompetitor) activeKeys.add(activeCompetitor.key);
    }
  } else if (analyticsView === "indexed") {
    activeKeys.add("ourPrice");
    if (showAllCompetitors) {
      competitorSeries.forEach((s) => activeKeys.add(s.key));
    } else {
      activeKeys.add("competitorPrice");
      if (activeCompetitor) activeKeys.add(activeCompetitor.key);
    }
  } else if (analyticsView === "range") {
    activeKeys.add("ourPrice");
    activeKeys.add("competitorPrice");
    if (activeCompetitor) activeKeys.add(activeCompetitor.key);
  } else {
    activeKeys.add("ourPrice");
    if (showAllCompetitors) {
      competitorSeries.forEach((s) => activeKeys.add(s.key));
    } else {
      activeKeys.add("competitorPrice");
      if (activeCompetitor) activeKeys.add(activeCompetitor.key);
    }
  }

  const items = Array.from(activeKeys)
    .map((key) => {
      let name = "";
      let color = "hsl(var(--muted-foreground))";

      if (key === "ourPrice" || key === "ourBaseline") {
        name = "Our Price";
        color = "hsl(var(--primary))";
      } else if (key === "competitorPrice") {
        name = "Market Average";
        color = "hsl(var(--muted-foreground))";
      } else {
        const series = isProductMode
          ? productSeries.find((s) => s.key === key)
          : competitorSeries.find((s) => s.key === key);
        if (series) {
          name = series.name;
          color = chartConfig[key]?.color || color;
        } else {
          name = String(key);
        }
      }

      const isFake = dataRow[`${key}_isFake`] === true;
      const rawVal = dataRow[key];
      const value =
        rawVal !== undefined && rawVal !== null && !isNaN(Number(rawVal)) && !isFake
          ? Number(rawVal)
          : null;

      return {
        key,
        name,
        color,
        value,
      };
    })
    .sort((a, b) => {
      if (a.key === "ourPrice" || a.key === "ourBaseline") return -1;
      if (b.key === "ourPrice" || b.key === "ourBaseline") return 1;
      if (a.key === "competitorPrice") return -1;
      if (b.key === "competitorPrice") return 1;
      return a.name.localeCompare(b.name);
    });

  const ourPriceVal =
    dataRow.ourPrice !== undefined && dataRow.ourPrice !== null && dataRow.ourPrice_isFake !== true
      ? Number(dataRow.ourPrice)
      : null;
  const marketAvgVal =
    dataRow.competitorPrice !== undefined && dataRow.competitorPrice !== null && dataRow.competitorPrice_isFake !== true
      ? Number(dataRow.competitorPrice)
      : null;

  let diffText = "";
  let diffColorClass = "text-slate-400";
  let positionStatus = "";

  if (ourPriceVal !== null && marketAvgVal !== null) {
    const diff = ourPriceVal - marketAvgVal;
    const diffPct = marketAvgVal > 0 ? (diff / marketAvgVal) * 100 : 0;

    if (diff > 0) {
      diffText = `+₱${diff.toFixed(2)} (${diffPct.toFixed(1)}% higher)`;
      diffColorClass = "text-rose-500 font-semibold";
      positionStatus = "Premium Price (Higher than Market Average)";
    } else if (diff < 0) {
      diffText = `-₱${Math.abs(diff).toFixed(2)} (${Math.abs(diffPct).toFixed(1)}% lower)`;
      diffColorClass = "text-emerald-500 font-semibold";
      positionStatus = "Competitive Advantage (Lower than Market Average)";
    } else {
      diffText = "At parity (₱0.00)";
      diffColorClass = "text-slate-500 font-medium";
      positionStatus = "Price Parity";
    }
  }

  const minPrice = dataRow.minPrice !== undefined ? Number(dataRow.minPrice) : null;
  const maxPrice = dataRow.maxPrice !== undefined ? Number(dataRow.maxPrice) : null;

  return (
    <div className="rounded-xl border bg-background/95 backdrop-blur-md shadow-xl p-4 text-xs min-w-[260px] max-w-[320px] transition-all duration-200 border-border/80">
      <div className="flex items-center justify-between border-b pb-2 mb-2">
        <span className="font-bold text-sm text-foreground">{label}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium capitalize">
          {analyticsView} View
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        {items.map((item) => {
          const isHovered = hoveredLineKey === item.key;

          let displayVal = "";
          if (item.value === null) {
            displayVal = "No Data";
          } else if (analyticsView === "spread") {
            const sign = item.value > 0 ? "+" : "";
            displayVal = `${sign}₱${item.value.toFixed(2)}`;
          } else if (analyticsView === "indexed") {
            displayVal = `${item.value.toFixed(1)}%`;
          } else {
            displayVal = `₱${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }

          return (
            <div
              key={item.key}
              className={`flex items-center justify-between gap-3 px-2 py-1 rounded-md transition-all duration-150 border-l-2 ${
                isHovered ? "bg-muted scale-[1.02]" : "opacity-85 hover:opacity-100 hover:bg-muted/40"
              }`}
              style={{
                borderLeftColor: isHovered ? item.color : "transparent",
              }}
            >
              <div className="flex items-center gap-2 truncate">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className={`truncate ${isHovered ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                  {item.name}
                </span>
              </div>
              <span className={`font-mono tabular-nums ${isHovered ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>
                {displayVal}
              </span>
            </div>
          );
        })}
      </div>

      {ourPriceVal !== null && marketAvgVal !== null && (
        <div className="border-t pt-2 mt-2 space-y-1 bg-muted/20 rounded-lg p-2 border-border/40">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Price Spread vs Avg</span>
            <span className={diffColorClass}>{diffText}</span>
          </div>

          {minPrice !== null && maxPrice !== null && minPrice !== maxPrice && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Competitor Range</span>
              <span className="font-mono text-foreground font-medium">
                ₱{minPrice.toFixed(2)} - ₱{maxPrice.toFixed(2)}
              </span>
            </div>
          )}

          {positionStatus && (
            <div className="text-[9px] text-muted-foreground/80 mt-1 text-center font-medium leading-snug border-t border-dashed border-border/30 pt-1">
              {positionStatus}
            </div>
          )}
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
  isProductMode,
  competitorId,
}: {
  data: CompetitorPriceEntry[];
  barMode: BarMode;
  sortOrder: SortOrder;
  competitorName?: string;
  isProductMode: boolean;
  competitorId?: string;
}) {
  const { barData, ourPrice, marketAvg } = useMemo(
    () => buildSnapshotBarData(data, barMode, sortOrder, isProductMode, competitorId),
    [data, barMode, sortOrder, isProductMode, competitorId],
  );

  const dynamicBarSize = useMemo(() => {
    const numItems = barData.length || 1;
    return Math.max(24, Math.min(80, 480 / numItems));
  }, [barData.length]);

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
            maxBarSize={dynamicBarSize}
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
  dateFrom,
  dateTo,
  focusMode,
}: PriceTrendChartProps) {
  const [showAllCompetitors, setShowAllCompetitors] = useState(false);
  const [analyticsView, setAnalyticsView] =
    useState<AnalyticsView>("comparison");
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [chartType, setChartType] = useState<"line" | "bar">("line");

  // Bar chart sub-state
  const [barMode, setBarMode] = useState<BarMode>("ranked");
  const [sortOrder] = useState<SortOrder>("asc");

  // Line chart interactive hover state
  const [hoveredLineKey, setHoveredLineKey] = useState<string | null>(null);

  // Auto-switch view away from range if showAllCompetitors becomes false
  React.useEffect(() => {
    if (!showAllCompetitors && analyticsView === "range") {
      setAnalyticsView("comparison");
    }
  }, [showAllCompetitors, analyticsView]);

  // Auto-reset showAllCompetitors based on focusMode:
  // - "product"    → force showAllCompetitors = true  (all competitors for the focused product)
  // - "competitor" → force showAllCompetitors = false (products of the focused competitor)
  // - null         → no override, user controls via the toolbar toggle
  React.useEffect(() => {
    if (focusMode === "product") {
      setShowAllCompetitors(true);
    } else if (focusMode === "competitor") {
      setShowAllCompetitors(false);
    }
  }, [focusMode]);

  // When a competitor is focused, auto-reset showAllCompetitors to false to enter product comparison mode
  React.useEffect(() => {
    if (competitorId) {
      setShowAllCompetitors(false);
    }
  }, [competitorId]);

  const getLineProps = (key: string, baseColor: string, baseWidth = 2, hasDots = true) => {
    const isHovered = hoveredLineKey === key;
    const isAnyHovered = hoveredLineKey !== null;

    let strokeOpacity = 1;
    let strokeWidth = baseWidth;

    if (isAnyHovered) {
      if (isHovered) {
        strokeOpacity = 1.0;
        strokeWidth = baseWidth + 1.25;
      } else {
        strokeOpacity = 0.15;
        strokeWidth = Math.max(1, baseWidth - 0.5);
      }
    } else {
      if (key === "ourPrice" || key === "ourBaseline") {
        strokeOpacity = 0.95;
      } else if (key === "competitorPrice") {
        strokeOpacity = 0.9;
      } else {
        strokeOpacity = showAllCompetitors ? 0.45 : 0.9;
      }
    }

    const onEnter = () => setHoveredLineKey(key);
    const onLeave = () => setHoveredLineKey(null);

    return {
      stroke: baseColor,
      strokeWidth,
      strokeOpacity,
      dot: hasDots
        ? <ChartDot isHoveredLine={isHovered} baseColor={baseColor} baseWidth={baseWidth} onEnter={onEnter} onLeave={onLeave} />
        : false,
      activeDot: hasDots
        ? <ChartActiveDot isHoveredLine={isHovered} baseColor={baseColor} baseWidth={baseWidth} onEnter={onEnter} onLeave={onLeave} />
        : false,
    };
  };

  const getBarProps = (key: string, baseColor: string) => {
    const isHovered = hoveredLineKey === key;
    const isAnyHovered = hoveredLineKey !== null;

    let fillOpacity = 1;

    if (isAnyHovered) {
      if (isHovered) {
        fillOpacity = 1.0;
      } else {
        fillOpacity = 0.15;
      }
    } else {
      if (key === "ourPrice" || key === "ourBaseline") {
        fillOpacity = 0.95;
      } else if (key === "competitorPrice") {
        fillOpacity = 0.8;
      } else {
        fillOpacity = showAllCompetitors ? 0.65 : 0.9;
      }
    }

    // Note: onMouseEnter/onMouseLeave are NOT spread onto <Bar> because Recharts
    // does not support them as root-level props on Bar — doing so breaks the chart.
    // Hover state is managed via the interactive legend instead.
    return {
      fill: baseColor,
      fillOpacity,
    };
  };


  const { chartData, chartConfig, competitorSeries, productSeries, isProductMode } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], chartConfig: {}, competitorSeries: [], productSeries: [], isProductMode: false };
    }

    const isProductMode = !!competitorId && !showAllCompetitors;

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

    // In product mode, we filter the data to only include entries for this competitor,
    // and the series are the products of this competitor.
    const productSeries = isProductMode
      ? Array.from(
          new Map(
            data
              .filter((entry) => resolveCompetitorId(entry) === competitorId)
              .map((entry) => {
                const name = entry.product_name || `Product #${entry.product_id}`;
                const key = `product_${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
                return [
                  name,
                  {
                    id: name,
                    key,
                    name,
                  },
                ];
              }),
          ).values(),
        ).sort((a, b) => a.name.localeCompare(b.name))
      : [];

    const activeSeriesList = isProductMode ? productSeries : competitorSeries;

    // Group entries by date
    const grouped = new Map<
      string,
      {
        ourPrices: number[];
        competitorPrices: number[];
        individualSeries: Map<string, number[]>;
      }
    >();

    // We only process entries for the focused competitor if in product mode
    const entriesToProcess = isProductMode
      ? data.filter((entry) => resolveCompetitorId(entry) === competitorId)
      : data;

    entriesToProcess.forEach((entry) => {
      const dateObj = parseEntryDate(entry.created_at);
      if (!dateObj) return;

      let dateKey = "";
      if (granularity === "daily") {
        dateKey = `${dateObj.getFullYear()}-${String(
          dateObj.getMonth() + 1,
        ).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
      } else if (granularity === "weekly") {
        const d = new Date(dateObj);
        const day = d.getDay();
        const diff = d.getDate() - day;
        const startOfWeek = new Date(d.setDate(diff));
        dateKey = `${startOfWeek.getFullYear()}-${String(
          startOfWeek.getMonth() + 1,
        ).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
      } else if (granularity === "monthly") {
        dateKey = `${dateObj.getFullYear()}-${String(
          dateObj.getMonth() + 1,
        ).padStart(2, "0")}-01`;
      } else {
        // yearly
        dateKey = `${dateObj.getFullYear()}-01-01`;
      }

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, {
          ourPrices: [],
          competitorPrices: [],
          individualSeries: new Map(),
        });
      }
      const dateMap = grouped.get(dateKey)!;

      const price = Number(entry.price);
      const isValidPrice = Number.isFinite(price);

      // Collect competitor price for average
      if (isValidPrice) {
        dateMap.competitorPrices.push(price);
      }

      // Collect price individually based on mode (product key vs competitor key)
      const seriesKey = isProductMode
        ? `product_${(entry.product_name || `Product #${entry.product_id}`).replace(/[^a-zA-Z0-9]/g, "_")}`
        : getCompetitorKey(resolveCompetitorId(entry));

      if (!dateMap.individualSeries.has(seriesKey)) {
        dateMap.individualSeries.set(seriesKey, []);
      }
      if (isValidPrice) {
        dateMap.individualSeries.get(seriesKey)!.push(price);
      }

      // Collect our price if available
      const ourPrice = Number(entry.our_price);
      if (Number.isFinite(ourPrice)) {
        dateMap.ourPrices.push(ourPrice);
      }
    });

    // Fill in missing intervals within the date filter range
    let dateRangeStart: Date | null = null;
    let dateRangeEnd: Date | null = null;

    if (dateFrom) {
      dateRangeStart = new Date(dateFrom);
    }
    if (dateTo) {
      dateRangeEnd = new Date(dateTo);
    }

    if (entriesToProcess && entriesToProcess.length > 0) {
      const parsedDates = entriesToProcess
        .map((entry) => parseEntryDate(entry.created_at))
        .filter((d): d is Date => d !== null);

      if (parsedDates.length > 0) {
        if (!dateRangeStart) {
          dateRangeStart = new Date(Math.min(...parsedDates.map((d) => d.getTime())));
        }
        if (!dateRangeEnd) {
          dateRangeEnd = new Date(Math.max(...parsedDates.map((d) => d.getTime())));
        }
      }
    }

    if (dateRangeStart && dateRangeEnd) {
      if (granularity === "daily") {
        const start = new Date(dateRangeStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateRangeEnd);
        end.setHours(0, 0, 0, 0);

        const current = new Date(start);
        let limit = 0;
        while (current <= end && limit < 366) {
          const dateKey = `${current.getFullYear()}-${String(
            current.getMonth() + 1,
          ).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;

          if (!grouped.has(dateKey)) {
            grouped.set(dateKey, {
              ourPrices: [],
              competitorPrices: [],
              individualSeries: new Map(),
            });
          }
          current.setDate(current.getDate() + 1);
          limit++;
        }
      } else if (granularity === "weekly") {
        const start = new Date(dateRangeStart);
        const startDay = start.getDay();
        const startDiff = start.getDate() - startDay;
        const weekStartBound = new Date(start.setDate(startDiff));
        weekStartBound.setHours(0, 0, 0, 0);

        const end = new Date(dateRangeEnd);
        end.setHours(0, 0, 0, 0);

        const current = new Date(weekStartBound);
        let limit = 0;
        while (current <= end && limit < 53) {
          const dateKey = `${current.getFullYear()}-${String(
            current.getMonth() + 1,
          ).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;

          if (!grouped.has(dateKey)) {
            grouped.set(dateKey, {
              ourPrices: [],
              competitorPrices: [],
              individualSeries: new Map(),
            });
          }
          current.setDate(current.getDate() + 7);
          limit++;
        }
      } else if (granularity === "monthly") {
        const start = new Date(dateRangeStart.getFullYear(), dateRangeStart.getMonth(), 1);
        const end = new Date(dateRangeEnd.getFullYear(), dateRangeEnd.getMonth(), 1);

        const current = new Date(start);
        let limit = 0;
        while (current <= end && limit < 24) {
          const dateKey = `${current.getFullYear()}-${String(
            current.getMonth() + 1,
          ).padStart(2, "0")}-01`;

          if (!grouped.has(dateKey)) {
            grouped.set(dateKey, {
              ourPrices: [],
              competitorPrices: [],
              individualSeries: new Map(),
            });
          }
          current.setMonth(current.getMonth() + 1);
          limit++;
        }
      } else if (granularity === "yearly") {
        const start = new Date(dateRangeStart.getFullYear(), 0, 1);
        const end = new Date(dateRangeEnd.getFullYear(), 0, 1);

        const current = new Date(start);
        let limit = 0;
        while (current <= end && limit < 10) {
          const dateKey = `${current.getFullYear()}-01-01`;

          if (!grouped.has(dateKey)) {
            grouped.set(dateKey, {
              ourPrices: [],
              competitorPrices: [],
              individualSeries: new Map(),
            });
          }
          current.setFullYear(current.getFullYear() + 1);
          limit++;
        }
      }
    }

    const sortedDates = Array.from(grouped.keys()).sort();

    // ─── Base Computations ───
    const baseData = sortedDates.map((dateKey) => {
      const dateObj = parseEntryDate(dateKey) || new Date(dateKey);
      let formattedDate = "";
      if (granularity === "daily") {
        formattedDate = dateObj.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
        });
      } else if (granularity === "weekly") {
        const weekStart = new Date(dateObj);
        const weekEnd = new Date(dateObj);
        weekEnd.setDate(weekStart.getDate() + 6);

        const startMonth = weekStart.toLocaleString("en-US", { month: "short" });
        const startDay = weekStart.getDate();
        const endMonth = weekEnd.toLocaleString("en-US", { month: "short" });
        const endDay = weekEnd.getDate();

        if (startMonth === endMonth) {
          formattedDate = `${startMonth} ${startDay} - ${endDay}`;
        } else {
          formattedDate = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
        }
      } else if (granularity === "monthly") {
        formattedDate = dateObj.toLocaleString("en-US", {
          month: "short",
          year: "numeric",
        });
      } else {
        // yearly
        formattedDate = dateObj.toLocaleString("en-US", {
          year: "numeric",
        });
      }
      const { ourPrices, competitorPrices, individualSeries } =
        grouped.get(dateKey)!;

      const row: Record<string, string | number | boolean | undefined> = {
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

      individualSeries.forEach((prices, key) => {
        row[key] = prices.reduce((a, b) => a + b, 0) / prices.length;
      });

      return row;
    });

    // Interpolate missing values for each key in baseData to render continuous lines/dots
    const keysToInterpolate = ["ourPrice", "competitorPrice", "minPrice", "maxPrice", "rangeDiff"];
    activeSeriesList.forEach((series) => keysToInterpolate.push(series.key));

    keysToInterpolate.forEach((key) => {
      const validIndices: number[] = [];
      baseData.forEach((row, idx) => {
        if (row[key] !== undefined && row[key] !== null && !isNaN(Number(row[key]))) {
          validIndices.push(idx);
        }
      });

      if (validIndices.length === 0) {
        return;
      }

      baseData.forEach((row, idx) => {
        const hasVal = row[key] !== undefined && row[key] !== null && !isNaN(Number(row[key]));
        if (!hasVal) {
          row[`${key}_isFake`] = true;

          const nextIdx = validIndices.find((i) => i > idx);
          const prevIdx = [...validIndices].reverse().find((i) => i < idx);

          if (prevIdx !== undefined && nextIdx !== undefined) {
            const prevVal = Number(baseData[prevIdx][key]);
            const nextVal = Number(baseData[nextIdx][key]);
            const ratio = (idx - prevIdx) / (nextIdx - prevIdx);
            row[key] = Number((prevVal + ratio * (nextVal - prevVal)).toFixed(2));
          } else if (prevIdx !== undefined) {
            row[key] = Number(Number(baseData[prevIdx][key]).toFixed(2));
          } else if (nextIdx !== undefined) {
            row[key] = Number(Number(baseData[nextIdx][key]).toFixed(2));
          }
        }
      });
    });

    // ─── View Transformation ───
    let transformedData: Record<string, string | number | boolean | undefined>[] = [];

    if (
      analyticsView === "comparison" ||
      analyticsView === "range" ||
      analyticsView === "snapshot"
    ) {
      transformedData = baseData.map((row) => {
        const newRow: Record<string, string | number | boolean | undefined> = {
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

        activeSeriesList.forEach((series) => {
          if (row[series.key] !== undefined) {
            newRow[series.key] = Number(Number(row[series.key]).toFixed(2));
          }
        });

        // Copy all fake flags
        Object.keys(row).forEach((k) => {
          if (k.endsWith("_isFake")) {
            newRow[k] = row[k];
          }
        });

        return newRow;
      });
    } else if (analyticsView === "spread") {
      transformedData = baseData
        .map((row) => {
          const newRow: Record<string, string | number | boolean | undefined> = {
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

          activeSeriesList.forEach((series) => {
            if (row[series.key] !== undefined) {
              newRow[series.key] = Number(
                (
                  (row[series.key] as number) - (row.ourPrice as number)
                ).toFixed(2),
              );
            }
          });

          // Copy all fake flags
          Object.keys(row).forEach((k) => {
            if (k.endsWith("_isFake")) {
              newRow[k] = row[k];
            }
          });

          return newRow;
        })
        .filter((row) => Object.keys(row).length > 1);
    } else if (analyticsView === "indexed") {
      let baseOur: number | null = null;
      let baseComp: number | null = null;
      const baseSeries: Record<string, number> = {};

      for (const row of baseData) {
        if (baseOur === null && row.ourPrice !== undefined) {
          const val = Number(row.ourPrice);
          if (Number.isFinite(val) && val > 0) baseOur = val;
        }
        if (baseComp === null && row.competitorPrice !== undefined) {
          const val = Number(row.competitorPrice);
          if (Number.isFinite(val) && val > 0) baseComp = val;
        }
        activeSeriesList.forEach((series) => {
          if (
            baseSeries[series.key] === undefined &&
            row[series.key] !== undefined
          ) {
            const val = Number(row[series.key]);
            if (Number.isFinite(val) && val > 0)
              baseSeries[series.key] = val;
          }
        });
      }

      transformedData = baseData.map((row) => {
        const newRow: Record<string, string | number | boolean | undefined> = {
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

        activeSeriesList.forEach((series) => {
          const baseVal = baseSeries[series.key];
          if (baseVal !== undefined && row[series.key] !== undefined) {
            const val = Number(row[series.key]);
            const indexed = (val / baseVal) * 100;
            if (Number.isFinite(indexed)) {
              newRow[series.key] = Number(indexed.toFixed(2));
            }
          }
        });

        // Copy all fake flags
        Object.keys(row).forEach((k) => {
          if (k.endsWith("_isFake")) {
            newRow[k] = row[k];
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

    if (isProductMode) {
      productSeries.forEach((series, index) => {
        chartConfig[series.key] = {
          label: series.name,
          color: getCompetitorColor(index),
        };
      });
    } else if (showAllCompetitors) {
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

    return { chartData: transformedData, chartConfig, competitorSeries, productSeries, isProductMode };
  }, [data, competitorId, showAllCompetitors, analyticsView, granularity, dateFrom, dateTo]);

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

  const dynamicBarSize = useMemo(() => {
    const numBars = isProductMode
      ? productSeries.length
      : (showAllCompetitors ? competitorSeries.length + 1 : (activeCompetitor ? 3 : 2));
    const numDates = chartData.length || 1;
    if (numDates <= 3) {
      return Math.max(24, Math.min(80, 360 / (numBars * numDates)));
    }
    return Math.max(12, Math.min(48, 180 / numBars));
  }, [showAllCompetitors, competitorSeries.length, productSeries.length, isProductMode, activeCompetitor, chartData.length]);

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
        <CardHeader className="flex flex-col lg:flex-row items-start lg:items-center justify-between pb-4 gap-4">
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

          <div className="flex flex-col gap-2 w-full lg:w-auto">
            {/* Row 1: Views */}
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
                  disabled={!showAllCompetitors}
                  title={!showAllCompetitors ? "Enable 'All Competitors' to use Range view" : "Band / Range Chart"}
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
            </div>

            {/* Row 2: Bar Mode & Sort Order & Disabled Competitor Toggle */}
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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

              {/* Sort toggle
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
              </Button> */}

              {/* Competitor Toggle (Disabled in Snapshot mode) */}
              <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs opacity-50 cursor-not-allowed">
                <Button
                  variant={!showAllCompetitors ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium pointer-events-none"
                  disabled
                  title="Not available in Snapshot mode"
                >
                  {competitorId ? "Product Trends" : "Market Avg"}
                </Button>
                <Button
                  variant={showAllCompetitors ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium pointer-events-none"
                  disabled
                  title="Not available in Snapshot mode"
                >
                  All Competitors
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SnapshotBarChart
            data={data}
            barMode={barMode}
            sortOrder={sortOrder}
            competitorName={competitorName}
            isProductMode={isProductMode}
            competitorId={competitorId}
          />

          {/* Legend pills */}
          <div className="flex flex-wrap gap-5 mt-3 pt-3 border-t justify-center">
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

  const renderInteractiveLegend = () => {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t">
        {/* Product Mode Series Pills */}
        {isProductMode &&
          productSeries.map((series, index) => {
            const color = getCompetitorColor(index);
            const isHovered = hoveredLineKey === series.key;
            return (
              <div
                key={series.id}
                className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all duration-200 ${
                  isHovered ? "scale-105" : "hover:bg-muted"
                }`}
                style={{
                  backgroundColor: isHovered ? `${color}15` : undefined
                }}
                onMouseEnter={() => setHoveredLineKey(series.key)}
                onMouseLeave={() => setHoveredLineKey(null)}
              >
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <span
                  className="text-xs font-medium transition-all"
                  style={{
                    color: isHovered ? color : "hsl(var(--muted-foreground))",
                    fontWeight: isHovered ? "bold" : "medium"
                  }}
                >
                  {series.name}
                </span>
              </div>
            );
          })}

        {/* Our Price Legend Pill */}
        {(!isProductMode || analyticsView === "comparison" || analyticsView === "indexed") && analyticsView !== "spread" && (
          <div
            className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all duration-200 ${
              hoveredLineKey === "ourPrice" ? "bg-primary/10 scale-105" : "hover:bg-muted"
            }`}
            onMouseEnter={() => setHoveredLineKey("ourPrice")}
            onMouseLeave={() => setHoveredLineKey(null)}
          >
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className={`text-xs font-medium transition-all ${
              hoveredLineKey === "ourPrice" ? "text-primary font-bold animate-pulse" : "text-muted-foreground"
            }`}>
              Our Price
            </span>
          </div>
        )}

        {!isProductMode && analyticsView === "spread" && (
          <div
            className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all duration-200 ${
              hoveredLineKey === "ourBaseline" ? "bg-primary/10 scale-105" : "hover:bg-muted"
            }`}
            onMouseEnter={() => setHoveredLineKey("ourBaseline")}
            onMouseLeave={() => setHoveredLineKey(null)}
          >
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className={`text-xs font-medium transition-all ${
              hoveredLineKey === "ourBaseline" ? "text-primary font-bold animate-pulse" : "text-muted-foreground"
            }`}>
              Our Price (Baseline)
            </span>
          </div>
        )}

        {/* Market Average Legend Pill */}
        {!isProductMode && !showAllCompetitors && (
          <div
            className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all duration-200 ${
              hoveredLineKey === "competitorPrice" ? "bg-muted-foreground/10 scale-105" : "hover:bg-muted"
            }`}
            onMouseEnter={() => setHoveredLineKey("competitorPrice")}
            onMouseLeave={() => setHoveredLineKey(null)}
          >
            <div className="h-3 w-3 rounded-full bg-muted-foreground" />
            <span className={`text-xs font-medium transition-all ${
              hoveredLineKey === "competitorPrice" ? "text-muted-foreground font-bold" : "text-muted-foreground"
            }`}>
              Market Average
            </span>
          </div>
        )}

        {/* Active Competitor Pill */}
        {!isProductMode && !showAllCompetitors && activeCompetitor && (
          <div
            className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all duration-200 ${
              hoveredLineKey === activeCompetitor.key ? "scale-105" : "hover:bg-muted"
            }`}
            style={{
              backgroundColor: hoveredLineKey === activeCompetitor.key ? `${competitorColor}15` : undefined
            }}
            onMouseEnter={() => setHoveredLineKey(activeCompetitor.key)}
            onMouseLeave={() => setHoveredLineKey(null)}
          >
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: competitorColor }} />
            <span
              className="text-xs font-medium transition-all"
              style={{
                color: hoveredLineKey === activeCompetitor.key ? competitorColor : "hsl(var(--muted-foreground))",
                fontWeight: hoveredLineKey === activeCompetitor.key ? "bold" : "medium"
              }}
            >
              {activeCompetitor.name}
            </span>
          </div>
        )}

        {/* All Competitors Pills */}
        {!isProductMode && showAllCompetitors &&
          competitorSeries.map((series, index) => {
            const color = getCompetitorColor(index);
            const isHovered = hoveredLineKey === series.key;
            return (
              <div
                key={series.id}
                className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all duration-200 ${
                  isHovered ? "scale-105" : "hover:bg-muted"
                }`}
                style={{
                  backgroundColor: isHovered ? `${color}15` : undefined
                }}
                onMouseEnter={() => setHoveredLineKey(series.key)}
                onMouseLeave={() => setHoveredLineKey(null)}
              >
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <span
                  className="text-xs font-medium transition-all"
                  style={{
                    color: isHovered ? color : "hsl(var(--muted-foreground))",
                    fontWeight: isHovered ? "bold" : "medium"
                  }}
                >
                  {series.name}
                </span>
              </div>
            );
          })}
      </div>
    );
  };

  const renderChartContent = () => {
    switch (analyticsView) {
      case "spread":
        return (
          <ComposedChart
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
                <CustomLineTooltip
                  analyticsView={analyticsView}
                  showAllCompetitors={showAllCompetitors}
                  activeCompetitor={activeCompetitor}
                  competitorSeries={competitorSeries}
                  productSeries={productSeries}
                  isProductMode={isProductMode}
                  chartConfig={chartConfig}
                  hoveredLineKey={hoveredLineKey}
                  setHoveredLineKey={setHoveredLineKey}
                  chartData={chartData}
                />
              }
            />

            {/* Baseline reference line — always visible */}
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

            {/* LINE MODE — spread series */}
            {chartType === "line" && isProductMode &&
              productSeries.map((series, index) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.key}
                  connectNulls
                  name={series.name}
                  strokeDasharray="3 3"
                  onMouseEnter={() => setHoveredLineKey(series.key)}
                  onMouseLeave={() => setHoveredLineKey(null)}
                  {...getLineProps(series.key, getCompetitorColor(index), 1.5, true)}
                />
              ))}

            {chartType === "line" && !isProductMode && showAllCompetitors &&
              competitorSeries.map((series, index) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.key}
                  connectNulls
                  name={series.name}
                  strokeDasharray="3 3"
                  onMouseEnter={() => setHoveredLineKey(series.key)}
                  onMouseLeave={() => setHoveredLineKey(null)}
                  {...getLineProps(series.key, getCompetitorColor(index), 1.5, true)}
                />
              ))}

            {chartType === "line" && !isProductMode && (
              <Line
                type="monotone"
                dataKey="ourBaseline"
                strokeDasharray="3 3"
                connectNulls
                name="Our Price (Baseline)"
                onMouseEnter={() => setHoveredLineKey("ourBaseline")}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps("ourBaseline", "hsl(var(--primary))", 2, false)}
              />
            )}

            {chartType === "line" && !isProductMode && !showAllCompetitors && (
              <Line
                type="monotone"
                dataKey="competitorPrice"
                strokeDasharray="6 4"
                connectNulls
                name="Market Average"
                onMouseEnter={() => setHoveredLineKey("competitorPrice")}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps("competitorPrice", "hsl(var(--muted-foreground))", 2, true)}
              />
            )}

            {chartType === "line" && !isProductMode && !showAllCompetitors && activeCompetitor && (
              <Line
                key={activeCompetitor.id}
                type="monotone"
                dataKey={activeCompetitor.key}
                connectNulls
                name={activeCompetitor.name}
                onMouseEnter={() => setHoveredLineKey(activeCompetitor.key)}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps(activeCompetitor.key, competitorColor, 2, true)}
              />
            )}

            {/* BAR MODE — spread series */}
            {chartType === "bar" && isProductMode &&
              productSeries.map((series, index) => (
                <Bar
                  key={series.id}
                  dataKey={series.key}
                  name={series.name}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={dynamicBarSize}
                  {...getBarProps(series.key, getCompetitorColor(index))}
                />
              ))}

            {chartType === "bar" && !isProductMode && showAllCompetitors &&
              competitorSeries.map((series, index) => (
                <Bar
                  key={series.id}
                  dataKey={series.key}
                  name={series.name}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={dynamicBarSize}
                  {...getBarProps(series.key, getCompetitorColor(index))}
                />
              ))}

            {chartType === "bar" && !isProductMode && !showAllCompetitors && (
              <Bar
                dataKey="competitorPrice"
                name="Market Average"
                radius={[4, 4, 0, 0]}
                maxBarSize={dynamicBarSize}
                {...getBarProps("competitorPrice", "hsl(var(--muted-foreground))")}
              />
            )}

            {chartType === "bar" && !isProductMode && !showAllCompetitors && activeCompetitor && (
              <Bar
                key={activeCompetitor.id}
                dataKey={activeCompetitor.key}
                name={activeCompetitor.name}
                radius={[4, 4, 0, 0]}
                maxBarSize={dynamicBarSize}
                {...getBarProps(activeCompetitor.key, competitorColor)}
              />
            )}
          </ComposedChart>
        );
      case "indexed":
        return (
          <ComposedChart
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
              tickFormatter={(value) => `₱${value}`}
            />
            <ChartTooltip
              cursor={{
                stroke: "hsl(var(--muted-foreground))",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={
                <CustomLineTooltip
                  analyticsView={analyticsView}
                  showAllCompetitors={showAllCompetitors}
                  activeCompetitor={activeCompetitor}
                  competitorSeries={competitorSeries}
                  productSeries={productSeries}
                  isProductMode={isProductMode}
                  chartConfig={chartConfig}
                  hoveredLineKey={hoveredLineKey}
                  setHoveredLineKey={setHoveredLineKey}
                  chartData={chartData}
                />
              }
            />

            {/* LINE MODE — product series */}
            {chartType === "line" && isProductMode &&
              productSeries.map((series, index) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.key}
                  connectNulls
                  name={series.name}
                  onMouseEnter={() => setHoveredLineKey(series.key)}
                  onMouseLeave={() => setHoveredLineKey(null)}
                  {...getLineProps(series.key, getCompetitorColor(index), 1.5, true)}
                />
              ))}

            {/* LINE MODE — indexed series */}
            {chartType === "line" && !isProductMode && showAllCompetitors &&
              competitorSeries.map((series, index) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.key}
                  connectNulls
                  name={series.name}
                  strokeDasharray="3 3"
                  onMouseEnter={() => setHoveredLineKey(series.key)}
                  onMouseLeave={() => setHoveredLineKey(null)}
                  {...getLineProps(series.key, getCompetitorColor(index), 1.5, true)}
                />
              ))}

            {chartType === "line" && (
              <Line
                type="monotone"
                dataKey="ourPrice"
                connectNulls
                name="Our Price"
                onMouseEnter={() => setHoveredLineKey("ourPrice")}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps("ourPrice", "hsl(var(--primary))", showAllCompetitors ? 2.5 : 2.2, true)}
              />
            )}

            {chartType === "line" && !isProductMode && !showAllCompetitors && (
              <Line
                type="monotone"
                dataKey="competitorPrice"
                strokeDasharray="6 4"
                connectNulls
                name="Market Average"
                onMouseEnter={() => setHoveredLineKey("competitorPrice")}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps("competitorPrice", "hsl(var(--muted-foreground))", 2, true)}
              />
            )}

            {chartType === "line" && !isProductMode && !showAllCompetitors && activeCompetitor && (
              <Line
                key={activeCompetitor.id}
                type="monotone"
                dataKey={activeCompetitor.key}
                connectNulls
                name={activeCompetitor.name}
                onMouseEnter={() => setHoveredLineKey(activeCompetitor.key)}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps(activeCompetitor.key, competitorColor, 2, true)}
              />
            )}

            {/* BAR MODE — product series */}
            {chartType === "bar" && isProductMode &&
              productSeries.map((series, index) => (
                <Bar
                  key={series.id}
                  dataKey={series.key}
                  name={series.name}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={dynamicBarSize}
                  {...getBarProps(series.key, getCompetitorColor(index))}
                />
              ))}

            {/* BAR MODE — indexed series */}
            {chartType === "bar" && !isProductMode && showAllCompetitors &&
              competitorSeries.map((series, index) => (
                <Bar
                  key={series.id}
                  dataKey={series.key}
                  name={series.name}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={dynamicBarSize}
                  {...getBarProps(series.key, getCompetitorColor(index))}
                />
              ))}

            {chartType === "bar" && (
              <Bar
                dataKey="ourPrice"
                name="Our Price"
                radius={[4, 4, 0, 0]}
                maxBarSize={dynamicBarSize}
                {...getBarProps("ourPrice", "hsl(var(--primary))")}
              />
            )}

            {chartType === "bar" && !isProductMode && !showAllCompetitors && (
              <Bar
                dataKey="competitorPrice"
                name="Market Average"
                radius={[4, 4, 0, 0]}
                maxBarSize={dynamicBarSize}
                {...getBarProps("competitorPrice", "hsl(var(--muted-foreground))")}
              />
            )}

            {chartType === "bar" && !isProductMode && !showAllCompetitors && activeCompetitor && (
              <Bar
                key={activeCompetitor.id}
                dataKey={activeCompetitor.key}
                name={activeCompetitor.name}
                radius={[4, 4, 0, 0]}
                maxBarSize={dynamicBarSize}
                {...getBarProps(activeCompetitor.key, competitorColor)}
              />
            )}
          </ComposedChart>
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
                <CustomLineTooltip
                  analyticsView={analyticsView}
                  showAllCompetitors={showAllCompetitors}
                  activeCompetitor={activeCompetitor}
                  competitorSeries={competitorSeries}
                  productSeries={productSeries}
                  isProductMode={isProductMode}
                  chartConfig={chartConfig}
                  hoveredLineKey={hoveredLineKey}
                  setHoveredLineKey={setHoveredLineKey}
                  chartData={chartData}
                />
              }
            />

            {/* Stacked Range Area (show only when competitor is focused or All Competitors) */}
            {!isProductMode && (showAllCompetitors || !!activeCompetitor) && (
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
            )}
            {!isProductMode && (showAllCompetitors || !!activeCompetitor) && (
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
            )}

            {!isProductMode && activeCompetitor && (
              <Line
                type="monotone"
                dataKey={activeCompetitor.key}
                connectNulls
                name={activeCompetitor.name}
                onMouseEnter={() => setHoveredLineKey(activeCompetitor.key)}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps(activeCompetitor.key, competitorColor, 2, true)}
              />
            )}

            {/* Our Price Line */}
            {!isProductMode && (
              <Line
                type="monotone"
                dataKey="ourPrice"
                connectNulls
                name="Our Price"
                onMouseEnter={() => setHoveredLineKey("ourPrice")}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps("ourPrice", "hsl(var(--primary))", 2.5, true)}
              />
            )}

            {/* Market Average Line */}
            {!isProductMode && (
              <Line
                type="monotone"
                dataKey="competitorPrice"
                strokeDasharray="6 4"
                connectNulls
                name="Market Average"
                onMouseEnter={() => setHoveredLineKey("competitorPrice")}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps("competitorPrice", "hsl(var(--muted-foreground))", 2, true)}
              />
            )}
          </ComposedChart>
        );
      case "comparison":
      default:
        return (
          <ComposedChart
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
                <CustomLineTooltip
                  analyticsView={analyticsView}
                  showAllCompetitors={showAllCompetitors}
                  activeCompetitor={activeCompetitor}
                  competitorSeries={competitorSeries}
                  productSeries={productSeries}
                  isProductMode={isProductMode}
                  chartConfig={chartConfig}
                  hoveredLineKey={hoveredLineKey}
                  setHoveredLineKey={setHoveredLineKey}
                  chartData={chartData}
                />
              }
            />

            {/* LINE MODE — product series */}
            {chartType === "line" && isProductMode &&
              productSeries.map((series, index) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.key}
                  connectNulls
                  name={series.name}
                  onMouseEnter={() => setHoveredLineKey(series.key)}
                  onMouseLeave={() => setHoveredLineKey(null)}
                  {...getLineProps(series.key, getCompetitorColor(index), 1.5, true)}
                />
              ))}

            {/* LINE MODE — comparison series */}
            {chartType === "line" && !isProductMode && showAllCompetitors &&
              competitorSeries.map((series, index) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.key}
                  connectNulls
                  name={series.name}
                  strokeDasharray="3 3"
                  onMouseEnter={() => setHoveredLineKey(series.key)}
                  onMouseLeave={() => setHoveredLineKey(null)}
                  {...getLineProps(series.key, getCompetitorColor(index), 1.5, true)}
                />
              ))}

            {/* Our Price Line */}
            {chartType === "line" && (
              <Line
                type="monotone"
                dataKey="ourPrice"
                connectNulls
                name="Our Price"
                onMouseEnter={() => setHoveredLineKey("ourPrice")}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps("ourPrice", "hsl(var(--primary))", showAllCompetitors ? 2.5 : 2.2, true)}
              />
            )}

            {chartType === "line" && !isProductMode && !showAllCompetitors && (
              <Line
                type="monotone"
                dataKey="competitorPrice"
                strokeDasharray="6 4"
                connectNulls
                name="Market Average"
                onMouseEnter={() => setHoveredLineKey("competitorPrice")}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps("competitorPrice", "hsl(var(--muted-foreground))", 2, true)}
              />
            )}

            {chartType === "line" && !isProductMode && !showAllCompetitors && activeCompetitor && (
              <Line
                key={activeCompetitor.id}
                type="monotone"
                dataKey={activeCompetitor.key}
                connectNulls
                name={activeCompetitor.name}
                onMouseEnter={() => setHoveredLineKey(activeCompetitor.key)}
                onMouseLeave={() => setHoveredLineKey(null)}
                {...getLineProps(activeCompetitor.key, competitorColor, 2, true)}
              />
            )}

            {/* BAR MODE — product series */}
            {chartType === "bar" && isProductMode &&
              productSeries.map((series, index) => (
                <Bar
                  key={series.id}
                  dataKey={series.key}
                  name={series.name}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={dynamicBarSize}
                  {...getBarProps(series.key, getCompetitorColor(index))}
                />
              ))}

            {/* BAR MODE — comparison series */}
            {chartType === "bar" && !isProductMode && showAllCompetitors &&
              competitorSeries.map((series, index) => (
                <Bar
                  key={series.id}
                  dataKey={series.key}
                  name={series.name}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={dynamicBarSize}
                  {...getBarProps(series.key, getCompetitorColor(index))}
                />
              ))}

            {/* Our Price Bar */}
            {chartType === "bar" && (
              <Bar
                dataKey="ourPrice"
                name="Our Price"
                radius={[4, 4, 0, 0]}
                maxBarSize={dynamicBarSize}
                {...getBarProps("ourPrice", "hsl(var(--primary))")}
              />
            )}

            {chartType === "bar" && !isProductMode && !showAllCompetitors && (
              <Bar
                dataKey="competitorPrice"
                name="Market Average"
                radius={[4, 4, 0, 0]}
                maxBarSize={dynamicBarSize}
                {...getBarProps("competitorPrice", "hsl(var(--muted-foreground))")}
              />
            )}

            {chartType === "bar" && !isProductMode && !showAllCompetitors && activeCompetitor && (
              <Bar
                key={activeCompetitor.id}
                dataKey={activeCompetitor.key}
                name={activeCompetitor.name}
                radius={[4, 4, 0, 0]}
                maxBarSize={dynamicBarSize}
                {...getBarProps(activeCompetitor.key, competitorColor)}
              />
            )}
          </ComposedChart>
        );
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col lg:flex-row items-start lg:items-center justify-between pb-4 gap-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold">Market Position</CardTitle>
        <CardDescription>
            {analyticsView === "comparison"
              ? focusMode === "product"
                ? `All competitors' prices for the selected product vs our price`
                : competitorName
                  ? `Comparison: Our Price vs ${competitorName}`
                  : "Compare OUR Price vs competitors and market average"
              : analyticsView === "spread"
                ? "Price gap: Competitor Price − Our Price (Above 0 means competitor is more expensive)"
                : analyticsView === "indexed"
                  ? "Normalized trends starting at 100 (removes category/size distortion)"
                  : "Market Volatility: Competitor price range (max/min) vs Our Price"}
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 w-full lg:w-auto">
          {/* Row 1: Views & Chart Type */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
                disabled={!showAllCompetitors}
                title={!showAllCompetitors ? "Enable 'All Competitors' to use Range view" : "Band / Range Chart"}
              >
                Range
              </Button>
              <Separator orientation="vertical" className="data-[orientation=vertical]:h-4 font-black" />
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

            {/* Chart Type Toggle (Line vs Bar) */}
            {(analyticsView === "comparison" || analyticsView === "spread" || analyticsView === "indexed") && (
              <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs">
                <Button
                  variant={chartType === "line" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium gap-1"
                  onClick={() => setChartType("line")}
                  title="Line Chart View"
                >
                  <LineChartIcon className="h-3.5 w-3.5" />
                  Line
                </Button>
                <Button
                  variant={chartType === "bar" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium gap-1"
                  onClick={() => setChartType("bar")}
                  title="Bar Chart View"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Bar
                </Button>
              </div>
            )}
          </div>

          {/* Row 2: Granularity & Competitors Mode */}
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs">
              <Button
                variant={granularity === "daily" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setGranularity("daily")}
                title="Daily View"
              >
                Daily
              </Button>
              <Button
                variant={granularity === "weekly" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setGranularity("weekly")}
                title="Weekly View"
              >
                Weekly
              </Button>
              <Button
                variant={granularity === "monthly" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setGranularity("monthly")}
                title="Monthly View"
              >
                Monthly
              </Button>
              <Button
                variant={granularity === "yearly" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setGranularity("yearly")}
                title="Yearly View"
              >
                Yearly
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
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          {renderChartContent()}
        </ChartContainer>
        {renderInteractiveLegend()}
      </CardContent>
    </Card>
  );
}
