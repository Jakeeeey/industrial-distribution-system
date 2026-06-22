"use client";

// =============================================================================
// Price Monitoring — MonthlyMatrixTable Component
// Layer  : components (UI only)
// Spec   : §8.2 Rows: Price Types | Columns: Jan–Dec | Values: carry-forward newPrice
// =============================================================================

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MonthlyMatrixEntry } from "../types";
import {
  formatCurrency,
  getPriceTypeColor,
  MONTH_LABELS,
} from "../utils/matrixUtils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MonthlyMatrixTableProps {
  /** One entry per price type, pre-computed by buildMonthlyMatrix. */
  matrixEntries: MonthlyMatrixEntry[];
  selectedYear: number;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Monthly Price Matrix:
 * - Rows: price types sorted by priceTypeSort
 * - Columns: Jan–Dec + Current (live price)
 * - Cell value: carry-forward effective price; "—" when no prior price exists
 * - Changed months: highlighted with a color accent
 *
 * Spec §8.2:
 * "When a month has no price change, carry forward the last effective price."
 * "Show a dash only when no prior effective price exists for that pricing tier."
 * "Use currentLivePrice for the Current Price card/side panel only."
 */
export function MonthlyMatrixTable({
  matrixEntries,
  selectedYear,
  loading,
}: MonthlyMatrixTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (matrixEntries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed flex items-center justify-center h-24 text-sm text-muted-foreground">
        No price data for {selectedYear}.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs min-w-[720px]">
        <thead>
          <tr className="bg-muted/60 border-b">
            {/* Price Type label column */}
            <th className="sticky left-0 z-10 bg-muted/60 text-left px-3 py-2.5 font-semibold text-muted-foreground min-w-[110px]">
              Price Type
            </th>
            {/* Month columns */}
            {MONTH_LABELS.map((month) => (
              <th
                key={month}
                className="px-2 py-2.5 font-semibold text-muted-foreground text-center min-w-[68px]"
              >
                {month}
              </th>
            ))}
            {/* Current live price column */}
            <th className="px-3 py-2.5 font-semibold text-muted-foreground text-center min-w-[90px] border-l">
              Current
            </th>
          </tr>
        </thead>
        <tbody>
          {matrixEntries.map((entry, rowIdx) => {
            const color = getPriceTypeColor(entry.priceTypeSort);
            return (
              <tr
                key={entry.priceTypeId}
                className={cn(
                  "border-b last:border-b-0 transition-colors",
                  rowIdx % 2 === 0 ? "bg-background" : "bg-muted/20",
                  "hover:bg-muted/40",
                )}
              >
                {/* Price type label */}
                <td className="sticky left-0 z-10 px-3 py-2 font-medium bg-inherit border-r">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span>{entry.priceTypeName}</span>
                  </div>
                </td>

                {/* Monthly price cells */}
                {entry.monthlyPrices.map((price, monthIdx) => {
                  const changed = entry.changedMonths[monthIdx];
                  return (
                    <td
                      key={monthIdx}
                      className={cn(
                        "px-2 py-2 text-center tabular-nums font-mono",
                        changed && "font-semibold",
                      )}
                    >
                      {price !== null ? (
                        <span
                          className={cn(
                            "inline-block px-1.5 py-0.5 rounded",
                            changed &&
                              "text-white text-[10px]",
                          )}
                          style={
                            changed
                              ? { backgroundColor: color }
                              : undefined
                          }
                          title={changed ? "Price changed this month" : undefined}
                        >
                          {formatCurrency(price)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                  );
                })}

                {/* Current live price */}
                <td className="px-3 py-2 text-center tabular-nums font-mono border-l">
                  {entry.currentLivePrice !== null ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono tabular-nums"
                      style={{
                        borderColor: color,
                        color: color,
                      }}
                    >
                      {formatCurrency(entry.currentLivePrice)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="px-3 py-2 bg-muted/30 border-t text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
        <span className="font-medium">Legend:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-5 rounded-sm bg-indigo-500/80" />
          Highlighted cell = price changed this month
        </span>
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground/50">—</span>
          = no prior price exists
        </span>
        <span className="ml-auto">
          Outlines = current live price (may differ from history)
        </span>
      </div>
    </div>
  );
}
