// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceTable.tsx
// ==============================================================================
// Results Table for Stock Movement and Variance Report (spec §11).
// One line per product per branch: opening, in, out, expected, counted, variance.
// A row opens the supporting-record panel. The Branch column only appears when
// the applied scope actually spans more than one branch, so a single-branch read
// keeps its width for the figures.
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, SearchX, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";
import {
  filterRows,
  formatPhDateTime,
  formatQty,
  formatSigned,
} from "../services/stock-movement-variance.calc";
import { ExceptionBadgeGroup } from "./ExceptionBadge";

interface ColumnDef {
  key: string;
  label: string;
  align: "left" | "right";
  width?: string;
}

/** Column definitions kept in one array so header and body can never drift. */
function buildColumns(showBranch: boolean): ColumnDef[] {
  return [
    { key: "product", label: "Product", align: "left", width: "min-w-[210px]" },
    ...(showBranch
      ? [{ key: "branch", label: "Branch", align: "left" as const, width: "min-w-[130px]" }]
      : []),
    { key: "category", label: "Category", align: "left", width: "min-w-[110px]" },
    { key: "opening", label: "Opening", align: "right" },
    { key: "in", label: "In", align: "right" },
    { key: "out", label: "Out", align: "right" },
    { key: "expected", label: "Expected", align: "right" },
    { key: "counted", label: "Counted", align: "right" },
    { key: "variance", label: "Variance", align: "right" },
    { key: "variancePct", label: "Var %", align: "right" },
    { key: "count", label: "Count document", align: "left", width: "min-w-[150px]" },
    { key: "exceptions", label: "Exceptions", align: "left", width: "min-w-[170px]" },
  ];
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

  // The branch column is only informative once the scope really spans branches.
  const showBranch = React.useMemo(
    () => new Set((report?.rows ?? []).map((row) => row.branchId)).size > 1,
    [report]
  );

  const columns = React.useMemo(() => buildColumns(showBranch), [showBranch]);

  /** Resolves a cell's classes by column key so header and body cannot drift. */
  const cell = React.useCallback(
    (key: string, extra?: string) => {
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
              : `No product in ${
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
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "whitespace-nowrap border-b px-3 py-2 text-[11px] font-semibold text-muted-foreground",
                      column.align === "right" ? "text-right" : "text-left",
                      column.width
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
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
                      "cursor-pointer border-b border-border/60 outline-none transition-colors",
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
                      {row.variancePercent === null
                        ? "—"
                        : `${Math.round(row.variancePercent * 10) / 10}%`}
                    </td>

                    <td className={cell("count")}>
                      {row.countDocNo ? (
                        <div>
                          <div className="font-medium">{row.countDocNo}</div>
                          <div className="text-[10px] text-muted-foreground">
                            cutoff {formatPhDateTime(row.countCutoffDate)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">No committed count</span>
                      )}
                    </td>

                    <td className={cell("exceptions")}>
                      <ExceptionBadgeGroup codes={row.exceptionCodes} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </motion.section>
  );
}
