// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceTable.tsx
// ==============================================================================
// Results Table for Stock Movement and Variance Report (spec §11).
// One line per product per branch: opening, in, out, expected, counted, variance.
// A row opens the supporting-record panel. Every column header sorts the
// filtered set, and one page of lines shows at a time; with no column picked the
// BFF's widest-variance order stands. The Branch column only appears when
// the applied scope actually spans more than one branch, so a single-branch read
// keeps its width for the figures.
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRightLeft, ArrowUp, ClipboardList, SearchX, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";
import {
  filterRows,
  formatQty,
  formatSigned,
  formatVariancePercent,
} from "../services/stock-movement-variance.calc";
import type { StockMovementVarianceRow } from "../types/stock-movement-variance.types";

/** Every results column is sortable, so header and body can never drift apart. */
type SortKey =
  | "product"
  | "branch"
  | "category"
  | "opening"
  | "in"
  | "out"
  | "expected"
  | "counted"
  | "variance"
  | "variancePct";

interface ColumnDef {
  key: SortKey;
  label: string;
  align: "left" | "right";
  width?: string;
  /** Text reads A→Z first; magnitudes read largest first. */
  numeric: boolean;
}

/** Column definitions kept in one array so header and body can never drift. */
function buildColumns(showBranch: boolean): ColumnDef[] {
  return [
    { key: "product", label: "Product", align: "left", width: "min-w-[210px]", numeric: false },
    ...(showBranch
      ? [
          {
            key: "branch" as const,
            label: "Branch",
            align: "left" as const,
            width: "min-w-[130px]",
            numeric: false,
          },
        ]
      : []),
    { key: "category", label: "Category", align: "left", width: "min-w-[110px]", numeric: false },
    { key: "opening", label: "Opening", align: "right", numeric: true },
    { key: "in", label: "In", align: "right", numeric: true },
    { key: "out", label: "Out", align: "right", numeric: true },
    { key: "expected", label: "Expected", align: "right", numeric: true },
    { key: "counted", label: "Counted", align: "right", numeric: true },
    { key: "variance", label: "Variance", align: "right", numeric: true },
    { key: "variancePct", label: "Var %", align: "right", numeric: true },
  ];
}

/** Reads the value a column sorts on; null is a line with no figure for it. */
function sortValue(row: StockMovementVarianceRow, key: SortKey): number | string | null {
  switch (key) {
    case "product":
      return row.productName;
    case "branch":
      return row.branchName;
    case "category":
      return row.categoryName;
    case "opening":
      return row.openingBalance;
    case "in":
      return row.periodIn;
    case "out":
      return row.periodOut;
    case "expected":
      return row.expectedClosing;
    case "counted":
      return row.countedClosing;
    case "variance":
      return row.variance;
    case "variancePct":
      return row.variancePercent;
  }
}

/**
 * Compares two lines for the active column. A line with no figure for it (an
 * uncounted variance, a missing category) always settles below the measured
 * ones, whichever way the column is reading.
 */
function compareRows(
  a: StockMovementVarianceRow,
  b: StockMovementVarianceRow,
  key: SortKey,
  direction: "asc" | "desc"
): number {
  const left = sortValue(a, key);
  const right = sortValue(b, key);
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  const order =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right));
  return direction === "asc" ? order : -order;
}

/** Shared cell padding/alignment for a column. */
function cellClass(column: ColumnDef): string {
  return cn(
    "px-3 py-2",
    column.align === "right" ? "text-right" : "text-left"
  );
}

export function StockMovementVarianceTable() {
  const {
    report,
    appliedFilters,
    isLoading,
    searchQuery,
    setSearchQuery,
    openRowDetail,
    selectedRow,
  } = useStockMovementVarianceReport();

  const rows = React.useMemo(() => {
    if (!report) return [];
    return filterRows(report.rows, searchQuery);
  }, [report, searchQuery]);

  // ── Pagination ──────────────────────────────────────────────────────────────
  // A display concern only: the BFF still reconciles the whole scope, and the
  // exports and KPI figures keep covering every line rather than this page.
  const [pageSize, setPageSize] = React.useState(15);
  const [currentPage, setCurrentPage] = React.useState(1);

  // A new dataset or a narrowed search invalidates the page position.
  React.useEffect(() => {
    setCurrentPage(1);
  }, [report, searchQuery]);

  // ── Sorting ─────────────────────────────────────────────────────────────────
  // No column picked means the line order the BFF sent stands: widest variance
  // first. Sorting narrows the whole filtered set, then the page slices from it.
  const [sort, setSort] = React.useState<{
    key: SortKey;
    direction: "asc" | "desc";
  } | null>(null);

  const sortedRows = React.useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => compareRows(a, b, sort.key, sort.direction));
  }, [rows, sort]);

  /** Re-pressing a column flips it; a newly picked column starts readable. */
  const toggleSort = React.useCallback((column: ColumnDef) => {
    setSort((current) =>
      current?.key === column.key
        ? {
            key: column.key,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { key: column.key, direction: column.numeric ? "desc" : "asc" }
    );
    setCurrentPage(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  // Clamped, so a narrowing search can never leave the table on an empty page.
  const page = Math.min(currentPage, totalPages);
  const pageRows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  // The branch column is only informative once the scope really spans branches.
  const showBranch = React.useMemo(
    () => new Set((report?.rows ?? []).map((row) => row.branchId)).size > 1,
    [report]
  );

  const columns = React.useMemo(() => buildColumns(showBranch), [showBranch]);

  /** Resolves a cell's classes by column key so header and body cannot drift. */
  const cell = React.useCallback(
    (key: SortKey, extra?: string) => {
      const column = columns.find((item) => item.key === key);
      return cn(column ? cellClass(column) : "px-3 py-2", extra);
    },
    [columns]
  );

  const isEmptySearch = Boolean(report) && rows.length === 0 && report!.rows.length > 0;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-xl border bg-card shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Table2 className="h-3.5 w-3.5 text-primary" />
          <span>Variance reconciliation</span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          {report
            ? `${rows.length} of ${report.rows.length} lines · click a line for supporting records`
            : "Awaiting Apply"}
        </span>
      </div>

      {/* ── Reading the ledger for the first time ──────────────────────────── */}
      {isLoading && !report ? (
        <div className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowRightLeft className="h-3.5 w-3.5 animate-pulse" />
            <span>Reading the posted movement ledger and reconciling against counts…</span>
          </div>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-9 animate-pulse rounded-md bg-muted/50" />
          ))}
        </div>
      ) : null}

      {/* ── Nothing applied yet ────────────────────────────────────────────── */}
      {!isLoading && !report ? (
        <div className="px-6 py-12 text-center">
          <Table2 className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-xs font-medium">No report loaded</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
            Set the period and branch scope above, then press Apply. Nothing is read from the
            movement ledger until you do.
          </p>
        </div>
      ) : null}

      {/* ── Applied, but nothing came back (or the filter hid it) ──────────── */}
      {report && rows.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <SearchX className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-xs font-medium">
            {isEmptySearch ? "No line matches the filter" : "Nothing to reconcile in this scope"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
            {isEmptySearch
              ? `${report.rows.length} reconciled lines are hidden by "${searchQuery}".`
              : `No serialized product in ${
                  report.branchName ?? "these branches"
                } had posted movement or a committed count between ${
                  appliedFilters?.startDate ?? "—"
                } and ${appliedFilters?.endDate ?? "—"}.`}
          </p>
          {isEmptySearch ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 h-7 text-[11px]"
              onClick={() => setSearchQuery("")}
            >
              <span>Clear filter</span>
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {report && rows.length > 0 ? (
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <tr>
                {columns.map((column) => {
                  const isActive = sort?.key === column.key;
                  return (
                    <th
                      key={column.key}
                      aria-sort={
                        isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
                      }
                      className={cn(
                        "whitespace-nowrap border-b px-3 py-2 text-[11px] font-semibold text-muted-foreground",
                        column.align === "right" ? "text-right" : "text-left",
                        column.width
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        title={`Sort by ${column.label}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground",
                          column.align === "right" && "flex-row-reverse",
                          isActive && "text-foreground"
                        )}
                      >
                        <span>{column.label}</span>
                        {isActive ? (
                          sort.direction === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    </th>
                  );
                })}
                {/* The row itself is the control, so this trailing column is the
                    visible affordance for it rather than a sortable data column. */}
                <th className="whitespace-nowrap border-b px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground min-w-[96px]">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {pageRows.map((row) => {
                const isSelected =
                  selectedRow?.productId === row.productId &&
                  selectedRow?.branchId === row.branchId;
                const shortage = row.variance !== null && row.variance < 0;
                const overage = row.variance !== null && row.variance > 0;

                return (
                  <tr
                    key={`${row.branchId}-${row.productId}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open supporting records for ${row.productName}`}
                    onClick={() => openRowDetail(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRowDetail(row);
                      }
                    }}
                    className={cn(
                      "group cursor-pointer border-b border-border/60 outline-none transition-colors",
                      "hover:bg-accent/60 focus-visible:bg-accent",
                      isSelected && "bg-primary/5"
                    )}
                  >
                    <td className={cell("product")}>
                      <div className="font-medium">{row.productName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {row.productCode ?? `ID ${row.productId}`}
                        {!showBranch ? ` · ${row.branchName || "—"}` : null}
                      </div>
                    </td>

                    {showBranch ? (
                      <td className={cell("branch", "text-muted-foreground")}>
                        {row.branchName || `Branch #${row.branchId}`}
                      </td>
                    ) : null}

                    <td className={cell("category", "text-muted-foreground")}>
                      {row.categoryName ?? "—"}
                    </td>

                    <td className={cell("opening", "tabular-nums")}>
                      {formatQty(row.openingBalance)}
                    </td>
                    <td className={cell("in", "tabular-nums text-emerald-700 dark:text-emerald-400")}>
                      {formatQty(row.periodIn)}
                    </td>
                    <td className={cell("out", "tabular-nums text-orange-700 dark:text-orange-400")}>
                      {formatQty(row.periodOut)}
                    </td>
                    <td className={cell("expected", "font-medium tabular-nums")}>
                      {formatQty(row.expectedClosing)}
                    </td>
                    <td className={cell("counted", "tabular-nums")}>
                      {formatQty(row.countedClosing)}
                    </td>

                    <td
                      className={cell(
                        "variance",
                        cn(
                          "font-semibold tabular-nums",
                          shortage && "text-red-600 dark:text-red-400",
                          overage && "text-amber-600 dark:text-amber-400"
                        )
                      )}
                    >
                      {formatSigned(row.variance)}
                    </td>

                    <td className={cell("variancePct", "tabular-nums text-muted-foreground")}>
                      {formatVariancePercent(row)}
                    </td>

                    <td className="px-3 py-2 text-left">
                      <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-foreground">
                        <ClipboardList className="h-3 w-3" />
                        <span>Records</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* ── Page controls: only once the lines really overflow one page ────── */}
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5" htmlFor="smv-page-size">
              <span>Lines per page</span>
              <select
                id="smv-page-size"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <span>Page {page} of {totalPages}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              disabled={page <= 1}
              onClick={() => setCurrentPage(Math.max(1, page - 1))}
            >
              <span>Previous</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              disabled={page >= totalPages}
              onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
            >
              <span>Next</span>
            </Button>
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}
