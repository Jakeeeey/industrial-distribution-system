// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceTable.tsx
// ==============================================================================
// Results Table for Stock Movement and Variance Report (spec §11).
// One line per product/branch: opening, in, out, expected, counted, variance.
// A row opens the supporting-record panel; local search and the exceptions-only
// switch narrow the loaded dataset without another ledger round trip.
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, Inbox, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";
import { filterRows, formatQty, formatSigned } from "../services/stock-movement-variance.calc";
import { ExceptionBadgeGroup } from "./ExceptionBadge";

/** Column definitions kept in one array so header and body can never drift. */
const COLUMNS = [
  { key: "product", label: "Product", align: "left", width: "min-w-[220px]" },
  { key: "category", label: "Category", align: "left", width: "min-w-[120px]" },
  { key: "opening", label: "Opening", align: "right" },
  { key: "in", label: "In", align: "right" },
  { key: "out", label: "Out", align: "right" },
  { key: "expected", label: "Expected", align: "right" },
  { key: "counted", label: "Counted", align: "right" },
  { key: "variance", label: "Variance", align: "right" },
  { key: "variancePct", label: "Var %", align: "right" },
  { key: "count", label: "Count document", align: "left", width: "min-w-[150px]" },
  { key: "exceptions", label: "Exceptions", align: "left", width: "min-w-[180px]" },
] as const;

export function StockMovementVarianceTable() {
  const {
    report,
    filters,
    isLoading,
    searchQuery,
    onlyExceptions,
    openRowDetail,
    selectedRow,
  } = useStockMovementVarianceReport();

  const rows = React.useMemo(() => {
    if (!report) return [];
    return filterRows(report.rows, searchQuery, onlyExceptions);
  }, [report, searchQuery, onlyExceptions]);

  if (isLoading && !report) {
    return (
      <div className="space-y-2 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowRightLeft className="h-3.5 w-3.5 animate-pulse" />
          <span>Reading the posted movement ledger and reconciling against counts…</span>
        </div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-9 animate-pulse rounded-md bg-muted/50" />
        ))}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center shadow-xs">
        <Inbox className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-xs font-medium">No report loaded</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {filters.branchId
            ? "Select a reporting period and refresh to reconcile stock."
            : "Choose a branch first — the movement ledger is scoped per branch."}
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center shadow-xs">
        <Table2 className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-xs font-medium">Nothing matches the current parameters</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {report.rows.length > 0
            ? `${report.rows.length} reconciled lines are hidden by the search or the exceptions filter.`
            : "No product in this branch had posted movement or a committed count in the selected period."}
        </p>
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-xl border bg-card shadow-xs"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Table2 className="h-3.5 w-3.5 text-primary" />
          <span>Variance reconciliation</span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          {rows.length} of {report.rows.length} lines · click a line for supporting records
        </span>
      </div>

      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap border-b px-3 py-2 text-[11px] font-semibold text-muted-foreground",
                    column.align === "right" ? "text-right" : "text-left",
                    "width" in column ? column.width : ""
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isSelected = selectedRow?.productId === row.productId;
              const shortage = row.variance !== null && row.variance < 0;
              const overage = row.variance !== null && row.variance > 0;

              return (
                <tr
                  key={`${row.productId}-${row.branchId}`}
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
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.productName}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {row.productCode ?? `ID ${row.productId}`} · {row.branchName || "—"}
                    </div>
                  </td>

                  <td className="px-3 py-2 text-muted-foreground">{row.categoryName ?? "—"}</td>

                  <td className="px-3 py-2 text-right tabular-nums">{formatQty(row.openingBalance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatQty(row.periodIn)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-orange-700 dark:text-orange-400">
                    {formatQty(row.periodOut)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatQty(row.expectedClosing)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatQty(row.countedClosing)}
                  </td>

                  <td
                    className={cn(
                      "px-3 py-2 text-right font-semibold tabular-nums",
                      shortage && "text-red-600 dark:text-red-400",
                      overage && "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {formatSigned(row.variance)}
                  </td>

                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {row.variancePercent === null ? "—" : `${Math.round(row.variancePercent * 10) / 10}%`}
                  </td>

                  <td className="px-3 py-2">
                    {row.countDocNo ? (
                      <div>
                        <div className="font-medium">{row.countDocNo}</div>
                        <div className="text-[10px] text-muted-foreground">
                          cutoff {row.countCutoffDate ?? "—"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">No committed count</span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <ExceptionBadgeGroup codes={row.exceptionCodes} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}
