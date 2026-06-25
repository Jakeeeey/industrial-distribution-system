"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { MonthlyMatrixEntry, ViewPriceMonitoringRow } from "../types";
import {
  formatCurrency,
  getPriceTypeColor,
  MONTH_LABELS,
} from "../utils/matrixUtils";
import { mapPriceTypeName } from "../../product-pricing/utils/constants";


// Breakpoint hook is imported from @/hooks/use-mobile

/**
 * Props
 */
export interface MonthlyMatrixTableProps {
  matrixEntries: MonthlyMatrixEntry[];
  selectedYear: number;
  loading: boolean;
  onSelectRow?: (rows: ViewPriceMonitoringRow[]) => void;
}

/**
 * MOBILE VIEW (Month slicer + cards)
 */
function MobileMonthlyMatrix({
  matrixEntries,
  onSelectRow,
}: {
  matrixEntries: MonthlyMatrixEntry[];
  onSelectRow?: (rows: ViewPriceMonitoringRow[]) => void;
}) {
  const [activeMonth, setActiveMonth] = React.useState<number>(
    new Date().getMonth(),
  );

  return (
    <div className="space-y-3">
      {/* Month selector */}
      <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-thin">
        {MONTH_LABELS.map((m, idx) => (
          <button
            key={m}
            onClick={() => setActiveMonth(idx)}
            className={cn(
              "px-3 py-1.5 text-[11px] font-semibold rounded-md border whitespace-nowrap transition-all duration-200",
              activeMonth === idx
                ? "bg-primary text-primary-foreground border-primary shadow-xs scale-105"
                : "bg-muted/60 text-muted-foreground hover:bg-muted border-transparent hover:text-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-2 animate-in fade-in duration-200">
        {matrixEntries.map((entry) => {
          const color = getPriceTypeColor(entry.priceTypeSort);
          const price = entry.monthlyPrices[activeMonth];
          const changed = entry.changedMonths[activeMonth];
          const events = entry.changeEvents?.[activeMonth];

          return (
            <div
              key={entry.priceTypeId}
              className={cn(
                "border rounded-lg p-3 bg-background transition-all duration-200 hover:shadow-xs",
                changed && "border-l-4",
              )}
              style={changed ? { borderLeftColor: color } : undefined}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-semibold text-sm">
                    {mapPriceTypeName(entry.priceTypeName)}
                  </span>
                </div>

                <span className="font-mono text-sm font-bold">
                  {price !== null ? formatCurrency(price) : "—"}
                </span>
              </div>

              {changed && events ? (
                <button
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline hover:scale-102 active:scale-98 transition-all"
                  onClick={() => onSelectRow?.(events)}
                >
                  View price change details →
                </button>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">
                  No price change this month
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * DESKTOP/TABLET MATRIX VIEW (your original system)
 */
function DesktopMatrix({
  matrixEntries,
  onSelectRow,
}: MonthlyMatrixTableProps) {
  return (
    <div className="rounded-lg border overflow-hidden">
      {/* scroll hint */}
      <div className="sm:hidden flex items-center justify-center gap-1.5 px-3 py-1.5 bg-muted/40 border-b text-[11px] text-muted-foreground">
        <span>←</span>
        <span>Scroll sideways to see all months</span>
        <span>→</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[720px]">
          <thead>
            <tr className="bg-muted/60 border-b">
              <th className="sticky left-0 z-10 bg-muted/60 text-left px-3 py-2.5 font-semibold text-muted-foreground min-w-[110px]">
                Price Type
              </th>

              {MONTH_LABELS.map((m) => (
                <th
                  key={m}
                  className="px-2 py-2.5 text-center font-semibold text-muted-foreground min-w-[68px]"
                >
                  {m}
                </th>
              ))}

              <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground border-l min-w-[90px]">
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
                    "border-b transition",
                    rowIdx % 2 === 0 ? "bg-background" : "bg-muted/20",
                    "hover:bg-muted/40",
                  )}
                >
                  {/* Sticky label */}
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium border-r">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate max-w-[120px]">
                        {mapPriceTypeName(entry.priceTypeName)}
                      </span>
                    </div>
                  </td>

                  {/* Months */}
                  {entry.monthlyPrices.map((price, idx) => {
                    const changed = entry.changedMonths[idx];
                    const events = entry.changeEvents?.[idx];
                    const clickable = changed && events?.length;

                    return (
                      <td
                        key={idx}
                        className={cn(
                          "px-2 py-2 text-center font-mono tabular-nums",
                          changed && "font-semibold",
                        )}
                      >
                        {price !== null ? (
                          <span
                            className={cn(
                              "inline-block px-2 py-0.5 rounded text-[11px] font-semibold transition-all duration-200 ease-in-out",
                              changed && "text-white shadow-xs",
                              clickable &&
                              "cursor-pointer hover:scale-110 active:scale-95 hover:brightness-110 hover:shadow-md",
                            )}
                            style={
                              changed ? { backgroundColor: color } : undefined
                            }
                            onClick={() =>
                              clickable && onSelectRow?.(events!)
                            }
                          >
                            {formatCurrency(price)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Current */}
                  <td className="px-3 py-2 text-center border-l font-mono">
                    {entry.currentLivePrice !== null ? (
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{
                          borderColor: color,
                          color,
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
      </div>

      {/* Legend */}
      <div className="px-3 py-2 bg-muted/30 border-t text-xs text-muted-foreground flex flex-wrap gap-3">
        <span className="font-medium">Legend:</span>
        <span>Highlighted = changed price</span>
        <span>— = no prior price</span>
        <span className="ml-auto hidden sm:inline">
          Tap highlighted cells for history
        </span>
      </div>
    </div>
  );
}

/**
 * MAIN COMPONENT (adaptive renderer)
 */
export function MonthlyMatrixTable({
  matrixEntries,
  selectedYear,
  loading,
  onSelectRow,
}: MonthlyMatrixTableProps) {
  const isMobile = useIsMobile();

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

  if (!matrixEntries.length) {
    return (
      <div className="border rounded-lg h-24 flex items-center justify-center text-sm text-muted-foreground">
        No price data for {selectedYear}.
      </div>
    );
  }

  return isMobile ? (
    <MobileMonthlyMatrix
      matrixEntries={matrixEntries}
      onSelectRow={onSelectRow}
    />
  ) : (
    <DesktopMatrix
      matrixEntries={matrixEntries}
      selectedYear={selectedYear}
      loading={loading}
      onSelectRow={onSelectRow}
    />
  );
}