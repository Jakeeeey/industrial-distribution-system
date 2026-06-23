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
import type { ViewPriceMonitoringRow } from "../types";
import {
  formatCurrency,
  formatPct,
  movementBadgeClass,
} from "../utils/matrixUtils";
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
  selectedYear: number;
  loading: boolean;
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

const PAGE_SIZE = 50;

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
 */
export function AuditDetailGrid({
  rows,
  selectedYear,
  loading,
}: AuditDetailGridProps) {
  const [sort, setSort] = React.useState<{ key: SortKey; dir: SortDir }>({
    key: "priceChangeDatetime",
    dir: "asc",
  });
  const [page, setPage] = React.useState(1);
  const [selectedRow, setSelectedRow] = React.useState<ViewPriceMonitoringRow | null>(null);

  // Filter to selected year
  const yearRows = React.useMemo(
    () =>
      rows.filter((r) => {
        const dt = r.priceChangeDatetime ?? r.approvedAt;
        if (!dt) return false;
        return new Date(dt).getFullYear() === selectedYear;
      }),
    [rows, selectedYear],
  );

  // Sort
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
          valA = a.priceTypeName ?? "";
          valB = b.priceTypeName ?? "";
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
    setPage(1);
  };

  // Reset page when year changes
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
      {/* Record count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {(page - 1) * PAGE_SIZE + 1}–
          {Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length.toLocaleString()} record
          {sorted.length !== 1 ? "s" : ""}
        </span>
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

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
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
                  onClick={() => setSelectedRow(row)}
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
                        {row.supplierShortcut ?? row.supplierName ?? (row.supplierId !== null && row.supplierId !== undefined && String(row.supplierId) !== "null" && String(row.supplierId) !== "" ? `Supplier #${row.supplierId}` : "Unspecified Supplier")}
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
                  <td className="px-3 py-2.5 font-medium">{row.priceTypeName ?? "—"}</td>

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

      {/* Radix / Shadcn Slide-out Drawer */}
      <Sheet open={selectedRow !== null} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent className="sm:max-w-2xl w-full sm:w-[650px] overflow-y-auto p-6">
          <SheetHeader className="p-0 border-b pb-3 mb-4">
            <SheetTitle className="text-lg font-bold">Price Change Details</SheetTitle>
            <SheetDescription>
              Approved price change event details and audit history.
            </SheetDescription>
          </SheetHeader>
          
          {selectedRow && (
            <div className="space-y-5 text-sm">
              {/* Reference and Status Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/50 p-4 rounded-xl border border-muted shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-lg text-primary shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                      Reference No
                    </span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {selectedRow.referenceNo || "—"}
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

              {selectedRow.supplierProductValidation === "SUPPLIER NOT MAPPED TO PRODUCT" && (
                <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Validation Notice</span>
                    <span className="text-[11px] text-amber-600 dark:text-amber-500 leading-snug">
                      Supplier is not mapped to this product in the supplier database.
                    </span>
                  </div>
                </div>
              )}

              {/* Two-Column Grid for Entities and Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Entities Involved */}
                <div className="flex flex-col justify-between border p-4 rounded-xl bg-background shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Package className="h-4 w-4 text-indigo-500" />
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                      Entities Involved
                    </h4>
                  </div>
                  
                  {/* Product Info */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Product</span>
                    <div className="flex items-start gap-2.5">
                      <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-2 h-9 w-9 flex items-center justify-center shrink-0 border border-primary/20">
                        <Package className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        {selectedRow.productCode && (
                          <span className="font-mono font-bold text-primary text-xs bg-primary/5 dark:bg-primary/15 px-1.5 py-0.5 rounded border border-primary/10 w-fit">
                            {selectedRow.productCode}
                          </span>
                        )}
                        <span className="text-foreground font-medium text-xs leading-snug mt-1 break-words">
                          {selectedRow.productName || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator className="border-dashed my-1" />

                  {/* Supplier Info */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Supplier</span>
                    <div className="flex items-start gap-2.5">
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2 h-9 w-9 flex items-center justify-center shrink-0 border border-emerald-600/10">
                        <Building2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        {selectedRow.supplierShortcut || selectedRow.supplierName ? (
                          <>
                            {selectedRow.supplierShortcut && (
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-600/15 w-fit">
                                {selectedRow.supplierShortcut}
                              </span>
                            )}
                            <span className="text-foreground font-medium text-xs leading-snug mt-1 break-words">
                              {selectedRow.supplierName || "—"}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-500 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded border border-amber-200 dark:border-amber-900/50 w-fit">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Unmapped Supplier {selectedRow.supplierId !== null && selectedRow.supplierId !== undefined && String(selectedRow.supplierId) !== "null" && String(selectedRow.supplierId) !== "" ? `(ID: ${selectedRow.supplierId})` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing Info */}
                <div className="flex flex-col justify-between border p-4 rounded-xl bg-background shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-indigo-500" />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                        Pricing Info
                      </h4>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5">
                      {selectedRow.priceTypeName ?? "—"}
                    </Badge>
                  </div>

                  {/* Price Transition Visual */}
                  <div className="bg-muted/30 p-2.5 rounded-lg border border-dashed flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase">Old Price</span>
                      <span className="font-mono font-bold text-muted-foreground text-xs line-through mt-0.5">
                        {formatCurrency(selectedRow.oldPrice)}
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex flex-col text-right">
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase">New Price</span>
                      <span className="font-mono font-extrabold text-foreground text-sm mt-0.5">
                        {formatCurrency(selectedRow.newPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase">Difference</span>
                      <span className={cn(
                        "font-bold text-xs font-mono mt-0.5 flex items-center gap-1",
                        selectedRow.priceDifference !== null && selectedRow.priceDifference > 0 && "text-red-600 dark:text-red-400",
                        selectedRow.priceDifference !== null && selectedRow.priceDifference < 0 && "text-emerald-600 dark:text-emerald-400",
                      )}>
                        {selectedRow.priceDifference !== null ? (
                          <>
                            {selectedRow.priceDifference > 0 ? "▲ +" : "▼ "}
                            {formatCurrency(selectedRow.priceDifference)}
                          </>
                        ) : "—"}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase">Movement</span>
                      {selectedRow.priceMovement ? (
                        <span className={cn(
                          "font-extrabold text-[10px] uppercase tracking-wide mt-0.5 flex items-center gap-1",
                          selectedRow.priceMovement === "INCREASE" && "text-red-600 dark:text-red-400",
                          selectedRow.priceMovement === "DECREASE" && "text-emerald-600 dark:text-emerald-400",
                          selectedRow.priceMovement === "NEW PRICE" && "text-blue-600 dark:text-blue-400",
                          selectedRow.priceMovement === "NO CHANGE" && "text-slate-500",
                        )}>
                          {selectedRow.priceMovement === "INCREASE" && <TrendingUp className="h-3 w-3" />}
                          {selectedRow.priceMovement === "DECREASE" && <TrendingDown className="h-3 w-3" />}
                          {selectedRow.priceMovement}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground mt-0.5">—</span>
                      )}
                    </div>
                  </div>

                  {/* Current Live Price */}
                  <div className="pt-2 border-t flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase">Current Live Price</span>
                      <span className="font-bold text-sm font-mono text-foreground mt-0.5">
                        {formatCurrency(selectedRow.currentLivePrice)}
                      </span>
                    </div>
                    <span className="text-[9px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded border self-end">
                      Active Value
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline Workflow */}
              <div className="space-y-4 border p-4 rounded-xl bg-background shadow-2xs">
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
                        <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Requested By</span>
                        <span className="font-semibold text-foreground text-xs mt-0.5">{selectedRow.requestedByName ?? "—"}</span>
                      </div>
                      <span className="text-muted-foreground text-[10px] bg-muted/50 px-2 py-0.5 rounded border border-muted/65 w-fit">
                        {formatDate(selectedRow.requestedAt)}
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
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Approved By</span>
                        <span className="font-semibold text-foreground text-xs mt-0.5">{selectedRow.approvedByName ?? "—"}</span>
                      </div>
                      <span className="text-muted-foreground text-[10px] bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-600/10 w-fit">
                        {formatDate(selectedRow.approvedAt ?? selectedRow.priceChangeDatetime)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div className="flex flex-col gap-2 border p-4 rounded-xl bg-muted/30 border-muted">
                <div className="flex items-center gap-2 border-b pb-2 mb-1">
                  <MessageSquareText className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">Remarks</span>
                </div>
                <p className={cn(
                  "text-xs leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-indigo-500/30",
                  selectedRow.headerRemarks ? "text-foreground font-medium" : "text-muted-foreground italic"
                )}>
                  {selectedRow.headerRemarks || "No remarks provided by the approver."}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
