"use client";

// =============================================================================
// Price Monitoring — AuditDetailGrid Component
// Layer  : components (UI only)
// Spec   : §8.3 Audit Detail Grid
//          Columns: Date | Supplier | Type | Old | New | Movement | Users
//          SUPPLIER NOT MAPPED rows → amber warning badge (not hidden)
// =============================================================================

import * as React from "react";
import {
  ChevronUp,
  ChevronDown,
  FileText,
  Package,
  Building2,
  DollarSign,
  User,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
  AlertTriangle,
  MessageSquareText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ViewPriceMonitoringRow } from "../types";
import {
  formatCurrency,
  formatPct,
  movementBadgeClass,
  getPriceTypeColor,
} from "../utils/matrixUtils";
import { mapPriceTypeName } from "../../product-pricing/utils/constants";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AuditDetailGridProps {
  rows: ViewPriceMonitoringRow[];
  allRows?: ViewPriceMonitoringRow[];
  selectedYear: number;
  loading: boolean;
  selectedRow: ViewPriceMonitoringRow | ViewPriceMonitoringRow[] | null;
  onSelectedRowChange: (row: ViewPriceMonitoringRow | ViewPriceMonitoringRow[] | null) => void;
}

// ---------------------------------------------------------------------------
// Sort state
// ---------------------------------------------------------------------------

type SortKey = "priceChangeDatetime" | "priceTypeName" | "newPrice" | "priceMovement";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dt: string | null | undefined): string {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dt;
  }
}

// ---------------------------------------------------------------------------
// Column header with sort indicator
// ---------------------------------------------------------------------------

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = currentSort.key === sortKey;
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap",
        "hover:text-foreground transition-colors",
        active && "text-foreground",
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          currentSort.dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronDown className="h-3.5 w-3.5 opacity-20" />
        )}
      </span>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full audit detail table for all price change events in the selected year.
 *
 * Spec §8.3:
 * - Rows with SUPPLIER NOT MAPPED TO PRODUCT get an amber warning badge — NOT hidden.
 * - Default sort: priceChangeDatetime ASC (chronological).
 * - Pagination: 50 rows per page (client-side).
 * - Mobile: card-based layout; Desktop: full table.
 */
export function AuditDetailGrid({
  rows,
  allRows,
  selectedYear,
  loading,
  selectedRow: parentSelectedRow,
  onSelectedRowChange,
}: AuditDetailGridProps) {
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({
    key: "priceChangeDatetime",
    dir: "desc",
  });
  const [page, setPage] = React.useState(1);
  
  // Responsive page size: default to 10 for desktop, 5 for mobile
  // Added as per user request to use 5 on mobile and 10 on desktop.
  const isMobile = useIsMobile();
  const [pageSize, setPageSize] = React.useState(10);

  React.useEffect(() => {
    setPageSize(isMobile ? 5 : 10);
  }, [isMobile]);

  const useCalculation = true;

  // 1. Calculate previous prices for ALL rows if calculation is enabled
  const computedRows = React.useMemo(() => {
    const historyPool = allRows || rows;

    const groupsMap = new Map<string, ViewPriceMonitoringRow[]>();
    for (const r of historyPool) {
      if (r.requestStatus !== "APPROVED") continue;
      const key = `${r.supplierId}-${r.priceTypeId}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(r);
    }

    for (const list of groupsMap.values()) {
      list.sort((a, b) => {
        const tA = new Date(a.priceChangeDatetime ?? a.approvedAt ?? 0).getTime();
        const tB = new Date(b.priceChangeDatetime ?? b.approvedAt ?? 0).getTime();
        if (tA !== tB) return tA - tB;
        return a.requestId - b.requestId;
      });
    }

    return rows.map((row) => {
      if (!useCalculation) return row;

      const key = `${row.supplierId}-${row.priceTypeId}`;
      const groupList = groupsMap.get(key) || [];
      const idx = groupList.findIndex((item) => item.requestId === row.requestId);

      let calculatedOldPrice: number | null = null;
      let calculatedDifference: number | null = null;
      let calculatedMovement: "INCREASE" | "DECREASE" | "NEW PRICE" | "NO CHANGE" | null = null;
      let calculatedPercentage: number | null = null;

      if (idx > 0) {
        const prevRow = groupList[idx - 1];
        calculatedOldPrice = prevRow.newPrice;

        if (row.newPrice !== null && calculatedOldPrice !== null) {
          calculatedDifference = row.newPrice - calculatedOldPrice;

          if (calculatedDifference > 0) {
            calculatedMovement = "INCREASE";
          } else if (calculatedDifference < 0) {
            calculatedMovement = "DECREASE";
          } else {
            calculatedMovement = "NO CHANGE";
          }

          if (calculatedOldPrice > 0) {
            calculatedPercentage = (calculatedDifference / calculatedOldPrice) * 100;
          } else {
            calculatedPercentage = 0;
          }
        } else if (row.newPrice !== null) {
          calculatedMovement = "NEW PRICE";
        }
      } else {
        calculatedOldPrice = null;
        calculatedDifference = null;
        calculatedMovement = "NEW PRICE";
        calculatedPercentage = null;
      }

      return {
        ...row,
        oldPrice: calculatedOldPrice,
        priceDifference: calculatedDifference,
        priceMovement: calculatedMovement,
        priceChangePercentage: calculatedPercentage,
      };
    });
  }, [rows, allRows, useCalculation]);

  const [activeDetailIndex, setActiveDetailIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveDetailIndex(0);
  }, [parentSelectedRow]);

  const selectedRows = React.useMemo<ViewPriceMonitoringRow[]>(() => {
    if (!parentSelectedRow) return [];
    const items = Array.isArray(parentSelectedRow) ? parentSelectedRow : [parentSelectedRow];
    return items.map((item) => {
      return computedRows.find((r) => r.requestId === item.requestId) || item;
    });
  }, [parentSelectedRow, computedRows]);

  const activeDetailRow = React.useMemo(() => {
    return selectedRows[activeDetailIndex] || null;
  }, [selectedRows, activeDetailIndex]);

  const yearRows = React.useMemo(
    () =>
      computedRows.filter((r) => {
        const dt = r.priceChangeDatetime ?? r.approvedAt;
        if (!dt) return false;
        return new Date(dt).getFullYear() === selectedYear;
      }),
    [computedRows, selectedYear],
  );

  const sorted = React.useMemo(() => {
    return [...yearRows].sort((a, b) => {
      let valA: string | number | null;
      let valB: string | number | null;

      switch (sort.key) {
        case "priceChangeDatetime":
          valA = a.priceChangeDatetime ?? a.approvedAt ?? "";
          valB = b.priceChangeDatetime ?? b.approvedAt ?? "";
          break;
        case "priceTypeName":
          valA = mapPriceTypeName(a.priceTypeName);
          valB = mapPriceTypeName(b.priceTypeName);
          break;
        case "newPrice":
          valA = a.newPrice ?? -Infinity;
          valB = b.newPrice ?? -Infinity;
          break;
        case "priceMovement":
          valA = a.priceMovement ?? "";
          valB = b.priceMovement ?? "";
          break;
        default:
          return 0;
      }

      if (valA === valB) return 0;
      const cmp = valA < valB ? -1 : 1;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [yearRows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
    setPage(1);
  };

  React.useEffect(() => {
    setPage(1);
  }, [selectedYear]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (yearRows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed flex items-center justify-center h-24 text-sm text-muted-foreground">
        No audit records for {selectedYear}.
      </div>
    );
  }

  return (
    <div className="space-y-2">

      {/* ── MOBILE: Card list (visible below md) ──────────────────────── */}
      <div className="md:hidden space-y-2">
        {paged.map((row, idx) => {
          const isMapped =
            row.supplierProductValidation !== "SUPPLIER NOT MAPPED TO PRODUCT";
          const color = getPriceTypeColor(row.priceTypeSort);

          return (
            <div
              key={`card-${row.requestId}-${idx}`}
              onClick={() => onSelectedRowChange(row)}
              className={cn(
                "rounded-lg border p-3 cursor-pointer transition-colors bg-background",
                "hover:bg-muted/40 active:bg-muted/60",
                !isMapped && "border-amber-300 dark:border-amber-700",
              )}
            >
              {/* Row 1: Date + Movement badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[11px] text-muted-foreground leading-tight">
                  {formatDate(row.priceChangeDatetime ?? row.approvedAt)}
                </span>
                {row.priceMovement && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
                      movementBadgeClass(row.priceMovement),
                    )}
                  >
                    {row.priceMovement}
                  </span>
                )}
              </div>

              {/* Row 2: Supplier name + Price type badge */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">
                    {row.supplierShortcut ??
                      row.supplierName ??
                      (row.supplierId !== null &&
                        row.supplierId !== undefined &&
                        String(row.supplierId) !== "null" &&
                        String(row.supplierId) !== ""
                        ? `Supplier #${row.supplierId}`
                        : "Unspecified Supplier")}
                  </p>
                  {row.supplierShortcut && row.supplierName ? (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {row.supplierName}
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold">
                      Unmapped Supplier
                    </p>
                  )}
                </div>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase border whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: `${color}10`,
                    color,
                    borderColor: `${color}30`,
                  }}
                >
                  {mapPriceTypeName(row.priceTypeName) || "—"}
                </span>
              </div>

              {/* Row 3: Price transition */}
              <div className="flex items-center gap-1.5 bg-muted/30 rounded-md px-2.5 py-1.5 mb-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground line-through font-mono tabular-nums">
                  {formatCurrency(row.oldPrice)}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-bold font-mono tabular-nums text-foreground">
                  {formatCurrency(row.newPrice)}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[11px] font-mono tabular-nums",
                      row.priceDifference !== null && row.priceDifference > 0 &&
                        "text-red-600 dark:text-red-400",
                      row.priceDifference !== null && row.priceDifference < 0 &&
                        "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {row.priceDifference !== null
                      ? (row.priceDifference > 0 ? "+" : "") +
                        formatCurrency(row.priceDifference)
                      : "—"}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-mono tabular-nums",
                      row.priceDifference !== null && row.priceDifference > 0 &&
                        "text-red-600 dark:text-red-400",
                      row.priceDifference !== null && row.priceDifference < 0 &&
                        "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {formatPct(row.priceChangePercentage)}
                  </span>
                </div>
              </div>

              {/* Row 4: Requested by + Validation */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground truncate">
                  {row.requestedByName ? (
                    <>
                      By{" "}
                      <span className="font-medium text-foreground">
                        {row.requestedByName}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                {isMapped ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <span className="text-[10px]">🟢</span>
                    <span className="text-[10px] font-medium">Valid</span>
                  </span>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 gap-1 shrink-0"
                    title="SUPPLIER NOT MAPPED TO PRODUCT"
                  >
                    <span className="text-[10px]">⚠</span>
                    Not Mapped
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP: Table (visible at md and above) ────────────────── */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-muted/60 border-b">
              <SortableHeader
                label="Date"
                sortKey="priceChangeDatetime"
                currentSort={sort}
                onSort={handleSort}
                className="min-w-[160px]"
              />
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[140px]">
                Supplier
              </th>
              <SortableHeader
                label="Price Type"
                sortKey="priceTypeName"
                currentSort={sort}
                onSort={handleSort}
                className="min-w-[90px]"
              />
              <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground min-w-[90px]">
                Old Price
              </th>
              <SortableHeader
                label="New Price"
                sortKey="newPrice"
                currentSort={sort}
                onSort={handleSort}
                className="text-right min-w-[90px]"
              />
              <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground min-w-[80px]">
                Difference
              </th>
              <SortableHeader
                label="Movement"
                sortKey="priceMovement"
                currentSort={sort}
                onSort={handleSort}
                className="min-w-[100px]"
              />
              <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground min-w-[70px]">
                % Change
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[140px]">
                Requested By
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[140px]">
                Approved By
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[80px]">
                Validation
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row, idx) => {
              const isMapped =
                row.supplierProductValidation !== "SUPPLIER NOT MAPPED TO PRODUCT";

              return (
                <tr
                  key={`${row.requestId}-${idx}`}
                  onClick={() => onSelectedRowChange(row)}
                  className={cn(
                    "border-b last:border-b-0 transition-colors cursor-pointer",
                    idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                    "hover:bg-muted/40",
                  )}
                >
                  {/* Date */}
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatDate(row.priceChangeDatetime ?? row.approvedAt)}
                  </td>

                  {/* Supplier */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {row.supplierShortcut ??
                          row.supplierName ??
                          (row.supplierId !== null &&
                            row.supplierId !== undefined &&
                            String(row.supplierId) !== "null" &&
                            String(row.supplierId) !== ""
                            ? `Supplier #${row.supplierId}`
                            : "Unspecified Supplier")}
                      </span>
                      {row.supplierShortcut && row.supplierName ? (
                        <span className="text-muted-foreground text-[10px] truncate max-w-[130px]">
                          {row.supplierName}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-500 text-[10px] font-semibold">
                          Unmapped Supplier
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Price Type */}
                  <td className="px-3 py-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase border whitespace-nowrap"
                      style={{
                        backgroundColor: `${getPriceTypeColor(row.priceTypeSort)}10`,
                        color: getPriceTypeColor(row.priceTypeSort),
                        borderColor: `${getPriceTypeColor(row.priceTypeSort)}30`,
                      }}
                    >
                      {mapPriceTypeName(row.priceTypeName) || "—"}
                    </span>
                  </td>

                  {/* Old Price */}
                  <td className="px-3 py-2.5 text-right tabular-nums font-mono text-muted-foreground">
                    {formatCurrency(row.oldPrice)}
                  </td>

                  {/* New Price */}
                  <td className="px-3 py-2.5 text-right tabular-nums font-mono font-semibold">
                    {formatCurrency(row.newPrice)}
                  </td>

                  {/* Difference */}
                  <td className="px-3 py-2.5 text-right tabular-nums font-mono">
                    {row.priceDifference !== null
                      ? (row.priceDifference > 0 ? "+" : "") +
                        formatCurrency(row.priceDifference)
                      : "—"}
                  </td>

                  {/* Movement badge */}
                  <td className="px-3 py-2.5">
                    {row.priceMovement ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          movementBadgeClass(row.priceMovement),
                        )}
                      >
                        {row.priceMovement}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* % Change */}
                  <td className="px-3 py-2.5 text-right tabular-nums font-mono">
                    {formatPct(row.priceChangePercentage)}
                  </td>

                  {/* Requested By */}
                  <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[140px]">
                    {row.requestedByName ?? "—"}
                  </td>

                  {/* Approved By */}
                  <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[140px]">
                    {row.approvedByName ?? "—"}
                  </td>

                  {/* Supplier-Product Validation — always show, never hide */}
                  <td className="px-3 py-2.5">
                    {isMapped ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span className="text-[10px] mr-0.5">🟢</span>
                        <span className="text-[10px] font-medium">Valid</span>
                      </span>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 gap-1"
                        title="SUPPLIER NOT MAPPED TO PRODUCT"
                      >
                        <span className="text-[10px]">⚠</span>
                        Supplier Not Mapped
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Controls & Record count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 border-l pl-4 border-muted">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-7 px-1.5 border border-input bg-background rounded-md text-xs font-semibold text-foreground/80 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={40}>40</option>
              <option value={50}>50</option>
            </select>
          </div>
          <span>
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, sorted.length)} of{" "}
            {sorted.length.toLocaleString()} record
            {sorted.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Pagination controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="h-7 px-2 text-xs"
          >
            ← Prev
          </Button>
          <span className="px-2 tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="h-7 px-2 text-xs"
          >
            Next →
          </Button>
        </div>
      </div>

      {/* Radix / Shadcn Slide-out Drawer */}
      <Sheet
        open={selectedRows.length > 0}
        onOpenChange={(open) => !open && onSelectedRowChange(null)}
      >
        <SheetContent className="sm:max-w-2xl w-full sm:w-[650px] overflow-y-auto p-4 sm:p-6">
          {(() => {
            const isFromMatrix = Array.isArray(parentSelectedRow);
            const firstDateStr =
              selectedRows[0]?.priceChangeDatetime ?? selectedRows[0]?.approvedAt;
            const monthYearLabel = firstDateStr
              ? new Date(firstDateStr).toLocaleDateString("en-PH", {
                  month: "long",
                  year: "numeric",
                })
              : "";

            return (
              <>
                <SheetHeader className="p-0 border-b pb-3 mb-4">
                  <SheetTitle className="text-base sm:text-lg font-bold">
                    {isFromMatrix
                      ? `Monthly Price Changes${monthYearLabel ? ` — ${monthYearLabel}` : ""}`
                      : "Price Change Details"}
                  </SheetTitle>
                  <SheetDescription>
                    {isFromMatrix
                      ? `All approved price changes for ${mapPriceTypeName(selectedRows[0]?.priceTypeName) || "this price type"} in ${monthYearLabel || "this month"}.`
                      : "Approved price change event details and audit history."}
                  </SheetDescription>
                </SheetHeader>

                {activeDetailRow && (
                  <div className="space-y-4 sm:space-y-5 text-sm">
                    {/* Selector tabs when multiple changes exist in a month */}
                    {selectedRows.length > 1 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                          Multiple Changes Recorded in {monthYearLabel || "this month"}
                        </span>
                        <div className="flex flex-col xs:flex-row flex-wrap gap-1.5 p-1 bg-muted/60 rounded-xl border border-muted shadow-2xs">
                          {selectedRows.map((row, idx) => {
                            const isActive = idx === activeDetailIndex;
                            const dtStr = row.priceChangeDatetime ?? row.approvedAt;
                            const formattedTime = dtStr
                              ? new Date(dtStr).toLocaleTimeString("en-PH", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : `Change #${idx + 1}`;

                            const color = getPriceTypeColor(row.priceTypeSort);

                            return (
                              <Button
                                key={`${row.requestId}-${idx}`}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "h-8 text-xs font-semibold px-3 py-1.5 rounded-lg grow justify-between gap-3 text-muted-foreground transition-all hover:text-foreground",
                                  isActive &&
                                    "bg-background text-foreground shadow-xs border border-muted-foreground/10",
                                )}
                                onClick={() => setActiveDetailIndex(idx)}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-1.5 w-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span>{formattedTime}</span>
                                </div>
                                <span className="font-mono font-bold text-[10px] tabular-nums text-foreground">
                                  {formatCurrency(row.newPrice)}
                                </span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Reference and Status Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/50 p-3 sm:p-4 rounded-xl border border-muted shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-lg text-primary shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                            Reference No
                          </span>
                          <span className="font-mono font-bold text-foreground text-sm">
                            {activeDetailRow.referenceNo || "—"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                            Header Status
                          </span>
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
                            APPROVED
                          </span>
                        </div>
                      </div>
                    </div>

                    {activeDetailRow.supplierProductValidation ===
                      "SUPPLIER NOT MAPPED TO PRODUCT" && (
                      <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                            Validation Notice
                          </span>
                          <span className="text-[11px] text-amber-600 dark:text-amber-500 leading-snug">
                            Supplier is not mapped to this product in the supplier database.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Two-Column Grid for Entities and Pricing */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {/* Entities Involved */}
                      <div className="flex flex-col justify-between border p-3 sm:p-4 rounded-xl bg-background shadow-2xs space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <Package className="h-4 w-4 text-indigo-500" />
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                            Entities Involved
                          </h4>
                        </div>

                        {/* Product Info */}
                        <div className="space-y-2">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                            Product
                          </span>
                          <div className="flex items-start gap-2.5">
                            <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-2 h-9 w-9 flex items-center justify-center shrink-0 border border-primary/20">
                              <Package className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              {activeDetailRow.productCode && (
                                <span className="font-mono font-bold text-primary text-xs bg-primary/5 dark:bg-primary/15 px-1.5 py-0.5 rounded border border-primary/10 w-fit">
                                  {activeDetailRow.productCode}
                                </span>
                              )}
                              <span className="text-foreground font-medium text-xs leading-snug mt-1 break-words">
                                {activeDetailRow.productName || "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Separator className="border-dashed my-1" />

                        {/* Supplier Info */}
                        <div className="space-y-2">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                            Supplier
                          </span>
                          <div className="flex items-start gap-2.5">
                            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2 h-9 w-9 flex items-center justify-center shrink-0 border border-emerald-600/10">
                              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              {activeDetailRow.supplierShortcut ||
                              activeDetailRow.supplierName ? (
                                <>
                                  {activeDetailRow.supplierShortcut && (
                                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-600/15 w-fit">
                                      {activeDetailRow.supplierShortcut}
                                    </span>
                                  )}
                                  <span className="text-foreground font-medium text-xs leading-snug mt-1 break-words">
                                    {activeDetailRow.supplierName || "—"}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs font-semibold text-amber-600 dark:text-amber-500 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded border border-amber-200 dark:border-amber-900/50 w-fit">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Unmapped Supplier{" "}
                                  {activeDetailRow.supplierId !== null &&
                                    activeDetailRow.supplierId !== undefined &&
                                    String(activeDetailRow.supplierId) !== "null" &&
                                    String(activeDetailRow.supplierId) !== ""
                                    ? `(ID: ${activeDetailRow.supplierId})`
                                    : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pricing Info */}
                      <div className="flex flex-col justify-between border p-3 sm:p-4 rounded-xl bg-background shadow-2xs space-y-3 sm:space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-indigo-500" />
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                              Pricing Info
                            </h4>
                          </div>
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase border whitespace-nowrap"
                            style={{
                              backgroundColor: `${getPriceTypeColor(activeDetailRow.priceTypeSort)}10`,
                              color: getPriceTypeColor(activeDetailRow.priceTypeSort),
                              borderColor: `${getPriceTypeColor(activeDetailRow.priceTypeSort)}30`,
                            }}
                          >
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor: getPriceTypeColor(
                                  activeDetailRow.priceTypeSort,
                                ),
                              }}
                            />
                            {mapPriceTypeName(activeDetailRow.priceTypeName) || "—"}
                          </span>
                        </div>

                        {/* Price Transition Visual */}
                        <div className="bg-muted/30 p-2.5 rounded-lg border border-dashed flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase">
                              Old Price
                            </span>
                            <span className="font-mono font-bold text-muted-foreground text-xs line-through mt-0.5">
                              {formatCurrency(activeDetailRow.oldPrice)}
                            </span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex flex-col text-right">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase">
                              New Price
                            </span>
                            <span className="font-mono font-extrabold text-foreground text-sm mt-0.5">
                              {formatCurrency(activeDetailRow.newPrice)}
                            </span>
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase">
                              Difference
                            </span>
                            <span
                              className={cn(
                                "font-bold text-xs font-mono mt-0.5 flex items-center gap-1",
                                activeDetailRow.priceDifference !== null &&
                                  activeDetailRow.priceDifference > 0 &&
                                  "text-red-600 dark:text-red-400",
                                activeDetailRow.priceDifference !== null &&
                                  activeDetailRow.priceDifference < 0 &&
                                  "text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {activeDetailRow.priceDifference !== null ? (
                                <>
                                  {activeDetailRow.priceDifference > 0 ? "▲ +" : "▼ "}
                                  {formatCurrency(activeDetailRow.priceDifference)}
                                </>
                              ) : (
                                "—"
                              )}
                            </span>
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase">
                              Movement
                            </span>
                            {activeDetailRow.priceMovement ? (
                              <span
                                className={cn(
                                  "font-extrabold text-[10px] uppercase tracking-wide mt-0.5 flex items-center gap-1",
                                  activeDetailRow.priceMovement === "INCREASE" &&
                                    "text-red-600 dark:text-red-400",
                                  activeDetailRow.priceMovement === "DECREASE" &&
                                    "text-emerald-600 dark:text-emerald-400",
                                  activeDetailRow.priceMovement === "NEW PRICE" &&
                                    "text-blue-600 dark:text-blue-400",
                                  activeDetailRow.priceMovement === "NO CHANGE" &&
                                    "text-slate-500",
                                )}
                              >
                                {activeDetailRow.priceMovement === "INCREASE" && (
                                  <TrendingUp className="h-3 w-3" />
                                )}
                                {activeDetailRow.priceMovement === "DECREASE" && (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {activeDetailRow.priceMovement}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground mt-0.5">—</span>
                            )}
                          </div>
                        </div>

                        {/* Current Live Price */}
                        <div className="pt-2 border-t flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase">
                              Current Live Price
                            </span>
                            <span className="font-bold text-sm font-mono text-foreground mt-0.5">
                              {formatCurrency(activeDetailRow.currentLivePrice)}
                            </span>
                          </div>
                          <span className="text-[9px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded border self-end">
                            Active Value
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Workflow */}
                    <div className="space-y-4 border p-3 sm:p-4 rounded-xl bg-background shadow-2xs">
                      <div className="flex items-center gap-2 border-b pb-2 mb-3">
                        <Clock className="h-4 w-4 text-indigo-500" />
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                          Workflow & Audit Trail
                        </h4>
                      </div>

                      <div className="relative pl-6 border-l-2 border-muted/80 ml-3 space-y-6">
                        {/* Step 1: Requested */}
                        <div className="relative">
                          <div className="absolute -left-[35px] top-0.5 bg-muted rounded-full p-1.5 border-2 border-background shadow-xs shrink-0 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                                Requested By
                              </span>
                              <span className="font-semibold text-foreground text-xs mt-0.5">
                                {activeDetailRow.requestedByName ?? "—"}
                              </span>
                            </div>
                            <span className="text-muted-foreground text-[10px] bg-muted/50 px-2 py-0.5 rounded border border-muted/65 w-fit">
                              {formatDate(activeDetailRow.requestedAt)}
                            </span>
                          </div>
                        </div>
                        {/* Step 2: Approved */}
                        <div className="relative">
                          <div className="absolute -left-[35px] top-0.5 bg-emerald-100 dark:bg-emerald-950/50 rounded-full p-1.5 border-2 border-background shadow-xs shrink-0 flex items-center justify-center">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                                Approved By
                              </span>
                              <span className="font-semibold text-foreground text-xs mt-0.5">
                                {activeDetailRow.approvedByName ?? "—"}
                              </span>
                            </div>
                            <span className="text-muted-foreground text-[10px] bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-600/10 w-fit">
                              {formatDate(
                                activeDetailRow.approvedAt ??
                                  activeDetailRow.priceChangeDatetime,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Remarks */}
                    <div className="flex flex-col gap-2 border p-3 sm:p-4 rounded-xl bg-muted/30 border-muted">
                      <div className="flex items-center gap-2 border-b pb-2 mb-1">
                        <MessageSquareText className="h-4 w-4 text-indigo-500" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                          Remarks
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-xs leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-indigo-500/30",
                          activeDetailRow.headerRemarks
                            ? "text-foreground font-medium"
                            : "text-muted-foreground italic",
                        )}
                      >
                        {activeDetailRow.headerRemarks ||
                          "No remarks provided by the approver."}
                      </p>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}