"use client";

// =============================================================================
// Price Monitoring — Right Sidebar Summary Panel
// Matches: MarketSnapshotPanel.tsx pattern from competitor-price-list
// Layer  : components (UI only)
// =============================================================================

import React from "react";
import {
  BarChart3,
  Tag,
  Package,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ViewPriceMonitoringRow, PriceTypeGroup } from "../types";
import { formatCurrency, getPriceTypeColor } from "../utils/matrixUtils";
import { mapPriceTypeName } from "../../product-pricing/utils/constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PriceHistorySidePanelProps {
  rows: ViewPriceMonitoringRow[];
  groups: PriceTypeGroup[];
  selectedYear: number | null;
  productLabel: string | null | undefined;
  productCode: string | null | undefined;
  supplierLabel: string | null | undefined;
}

// ---------------------------------------------------------------------------
// Reusable stat row (mirrors MarketSnapshotPanel StatRow)
// ---------------------------------------------------------------------------

function StatRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums", className)}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Movement breakdown bar (mirrors PositioningBar)
// ---------------------------------------------------------------------------

function MovementBar({
  increase,
  decrease,
  newPrice,
  noChange,
  total,
}: {
  increase: number;
  decrease: number;
  newPrice: number;
  noChange: number;
  total: number;
}) {
  if (total === 0) return <div className="h-2 rounded-full bg-muted w-full" />;

  const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`;

  return (
    <div className="w-full h-2.5 rounded-full overflow-hidden flex">
      {increase > 0 && (
        <div
          className="bg-rose-500 transition-all"
          style={{ width: pct(increase) }}
          title={`Increase: ${increase}`}
        />
      )}
      {noChange > 0 && (
        <div
          className="bg-slate-400 transition-all"
          style={{ width: pct(noChange) }}
          title={`No Change: ${noChange}`}
        />
      )}
      {newPrice > 0 && (
        <div
          className="bg-blue-500 transition-all"
          style={{ width: pct(newPrice) }}
          title={`New Price: ${newPrice}`}
        />
      )}
      {decrease > 0 && (
        <div
          className="bg-emerald-500 transition-all"
          style={{ width: pct(decrease) }}
          title={`Decrease: ${decrease}`}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PriceHistorySidePanel({
  rows,
  groups,
  selectedYear,
  productLabel,
  productCode,
  supplierLabel,
}: PriceHistorySidePanelProps) {
  // Compute stats for the selected year
  const yearRows = React.useMemo(() => {
    if (!selectedYear) return rows;
    return rows.filter((r) => {
      const dt = r.priceChangeDatetime ?? r.approvedAt;
      return dt ? new Date(dt).getFullYear() === selectedYear : false;
    });
  }, [rows, selectedYear]);

  // Price stats
  const prices = yearRows
    .map((r) => r.newPrice)
    .filter((p): p is number => p !== null && Number.isFinite(p));

  const highestPrice = prices.length ? Math.max(...prices) : null;
  const lowestPrice = prices.length ? Math.min(...prices) : null;
  const avgPrice = prices.length
    ? prices.reduce((a, b) => a + b, 0) / prices.length
    : null;

  // Movement breakdown
  const movementCounts = React.useMemo(() => {
    const counts = { increase: 0, decrease: 0, newPrice: 0, noChange: 0 };
    for (const r of yearRows) {
      if (r.priceMovement === "INCREASE") counts.increase++;
      else if (r.priceMovement === "DECREASE") counts.decrease++;
      else if (r.priceMovement === "NEW PRICE") counts.newPrice++;
      else counts.noChange++;
    }
    return counts;
  }, [yearRows]);

  // Supplier validation warning count
  const unmappedCount = yearRows.filter(
    (r) => r.supplierProductValidation === "SUPPLIER NOT MAPPED TO PRODUCT",
  ).length;

  const total = yearRows.length;
  const pct = (n: number) =>
    total > 0 ? `${((n / total) * 100).toFixed(0)}%` : "0%";

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="border shadow-sm">
          <CardContent className="px-4 py-6 text-center text-xs text-muted-foreground">
            Select a product and click Apply to view the price history summary.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Product Info ──────────────────────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Product
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {productCode && (
            <div className="text-[10px] font-mono text-muted-foreground mb-0.5">
              {productCode}
            </div>
          )}
          <p className="text-xs font-semibold text-foreground leading-tight mb-2">
            {productLabel
              ? productLabel.replace(`${productCode} — `, "")
              : "—"}
          </p>
          <Separator className="my-1" />
          <StatRow label="Supplier" value={supplierLabel ?? "All Suppliers"} />
          <StatRow
            label="Total Events"
            value={rows.length.toLocaleString()}
          />
          <StatRow
            label={`Events in ${selectedYear ?? "—"}`}
            value={yearRows.length.toLocaleString()}
          />
        </CardContent>
      </Card>

      {/* ── Annual Summary ───────────────────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Annual Summary {selectedYear && `(${selectedYear})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          {yearRows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              No data for {selectedYear}.
            </p>
          ) : (
            <>
              {/* Pricing Stats */}
              <div className="space-y-1">
                <StatRow
                  label="Current Price"
                  value={formatCurrency(
                    yearRows.length > 0 ? yearRows[yearRows.length - 1].newPrice : null
                  )}
                  className="text-blue-600 dark:text-blue-400"
                />
                <StatRow
                  label="Highest Price"
                  value={formatCurrency(highestPrice)}
                  className="text-rose-600 dark:text-rose-400"
                />
                <StatRow
                  label="Lowest Price"
                  value={formatCurrency(lowestPrice)}
                  className="text-emerald-600 dark:text-emerald-400"
                />
                <StatRow
                  label="Average Price"
                  value={formatCurrency(avgPrice)}
                  className="text-foreground"
                />
              </div>

              <Separator />

              {/* Movement Breakdown counts */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Movement Breakdown
                </h4>
                <MovementBar
                  increase={movementCounts.increase}
                  decrease={movementCounts.decrease}
                  newPrice={movementCounts.newPrice}
                  noChange={movementCounts.noChange}
                  total={total}
                />
                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="text-rose-500 font-bold">▲</span> Increase
                    </span>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      {movementCounts.increase} <span className="text-muted-foreground font-normal">({pct(movementCounts.increase)})</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="text-emerald-500 font-bold">▼</span> Decrease
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {movementCounts.decrease} <span className="text-muted-foreground font-normal">({pct(movementCounts.decrease)})</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="text-slate-400 font-bold">■</span> No Change / New Price
                    </span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {movementCounts.noChange + movementCounts.newPrice} <span className="text-muted-foreground font-normal">({pct(movementCounts.noChange + movementCounts.newPrice)})</span>
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Price Type Legend ─────────────────────────────────────────── */}
      {groups.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Price Types
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-col gap-2">
              {groups.map((group) => {
                const color = getPriceTypeColor(group.priceTypeSort);
                const typeRows = yearRows.filter(
                  (r) => r.priceTypeId === group.priceTypeId,
                );
                const latestRow = typeRows[typeRows.length - 1] ?? null;
                const livePrice = latestRow?.currentLivePrice ?? null;

                return (
                  <div key={group.priceTypeId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {mapPriceTypeName(group.priceTypeName)}
                      </span>
                    </div>
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color }}
                    >
                      {formatCurrency(livePrice)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Supplier Validation Warning ──────────────────────────────── */}
      {unmappedCount > 0 && (
        <Card className="border border-amber-300 dark:border-amber-700 shadow-sm bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                {unmappedCount} Unmapped Supplier{unmappedCount > 1 ? "s" : ""}
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 leading-snug">
                Some records reference suppliers not mapped to this product. They remain visible in all views.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Validation OK ─────────────────────────────────────────────── */}
      {unmappedCount === 0 && rows.length > 0 && (
        <Card className="border border-emerald-300 dark:border-emerald-800 shadow-sm bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="px-4 py-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              All suppliers are mapped to this product.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
