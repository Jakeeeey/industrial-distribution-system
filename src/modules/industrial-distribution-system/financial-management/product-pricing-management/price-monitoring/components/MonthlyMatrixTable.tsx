"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MonthlyMatrixEntry, ViewPriceMonitoringRow } from "../types";
import {
  formatCurrency,
  getPriceTypeColor,
  MONTH_LABELS,
} from "../utils/matrixUtils";
import { mapPriceTypeName } from "../../product-pricing/utils/constants";
import { Button } from "@/components/ui/button";

/**
 * Breakpoint hook (no dependency)
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

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
      <div className="flex gap-1 overflow-x-auto pb-1">
        {MONTH_LABELS.map((m, idx) => (
          <button
            key={m}
            onClick={() => setActiveMonth(idx)}
            className={cn(
              "px-2 py-1 text-[10px] rounded border whitespace-nowrap transition",
              activeMonth === idx
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {matrixEntries.map((entry) => {
          const color = getPriceTypeColor(entry.priceTypeSort);
          const price = entry.monthlyPrices[activeMonth];
          const changed = entry.changedMonths[activeMonth];
          const events = entry.changeEvents?.[activeMonth];

          return (
            <div
              key={entry.priceTypeId}
              className="border rounded-lg p-3 bg-background"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium text-sm">
                    {mapPriceTypeName(entry.priceTypeName)}
                  </span>
                </div>

                <span className="font-mono text-sm">
                  {price !== null ? formatCurrency(price) : "—"}
                </span>
              </div>

              {changed && events ? (
                <button
                  className="mt-2 text-xs text-primary underline "
                  onClick={() => onSelectRow?.(events)}
                >
                  View price change details
                </button>
              ) : (
                <span className="mt-2 text-xs text-muted-foreground">
                  No price change this month
                </span>
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
                              "inline-block px-1.5 py-0.5 rounded",
                              changed && "text-white",
                              clickable &&
                              "cursor-pointer hover:scale-105 transition",
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