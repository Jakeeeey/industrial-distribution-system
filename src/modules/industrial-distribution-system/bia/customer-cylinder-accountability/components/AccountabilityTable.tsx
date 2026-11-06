// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/components/AccountabilityTable.tsx
// ==============================================================================
// Primary Reconciliation Grid for Customer Cylinder Accountability Report
// Proposed columns per spec: Customer, Date, Deposit Qty, Swap Qty, Ownership, Running Base, Reference.
//
// Complies with VoSync Design System standards:
// - Hardware-accelerated transitions
// - Comprehensive loading skeletons & contextual empty state prompts
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Eye, AlertCircle, Building2, Layers } from "lucide-react";
import { useCustomerCylinderAccountability } from "../hooks/useCustomerCylinderAccountability";
import { OwnershipBadge } from "./OwnershipBadge";
import { StatusBadge } from "./StatusBadge";

export function AccountabilityTable() {
  const {
    filteredRows,
    isLoading,
    openCustomerDetail,
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    resetFilters,
  } = useCustomerCylinderAccountability();

  // Pagination calculation
  const totalRows = filteredRows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = React.useMemo(() => {
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, startIndex, pageSize]);

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card shadow-2xs overflow-hidden">
        <div className="p-4 border-b">
          <div className="h-4 w-48 rounded bg-muted animate-pulse" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-64 rounded bg-muted" />
              </div>
              <div className="flex gap-4">
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state prompt
  if (filteredRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 text-center shadow-2xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-3">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No matching customer records</h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          No cylinder accountability records match your search query or selected branch cutoff.
        </p>
        <button
          type="button"
          onClick={resetFilters}
          className="mt-4 rounded-lg bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
        >
          Reset Filter Parameters
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-2xs overflow-hidden">
      {/* ── Table Header / Counter ────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/20">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Customer Cylinder Balances ({totalRows.toLocaleString()} accounts)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* ── Main Data Table ───────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-3">Branch</th>
              <th className="py-3 px-3 text-right">Opening Base</th>
              <th className="py-3 px-3 text-right">Deposit Qty (+)</th>
              <th className="py-3 px-3 text-right">Swap Qty</th>
              <th className="py-3 px-3 text-right font-bold text-foreground">Running Base (=)</th>
              <th className="py-3 px-3 text-center">Ownership</th>
              <th className="py-3 px-3">Last Transaction</th>
              <th className="py-3 px-3">Reference</th>
              <th className="py-3 px-3 text-center">Audit Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginatedRows.map((row) => (
              <tr
                key={row.customerCode}
                className="transition hover:bg-muted/30 cursor-pointer group"
                onClick={() => openCustomerDetail(row.customerCode)}
              >
                {/* 1. Customer Details */}
                <td className="py-3 px-4">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="font-mono text-primary font-bold">
                      {row.customerCode}
                    </span>
                    <span>• {row.customerName}</span>
                  </div>
                  {row.storeName && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Store: {row.storeName}
                    </div>
                  )}
                </td>

                {/* 2. Branch */}
                <td className="py-3 px-3 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-muted-foreground/70" />
                    <span>{row.branchName}</span>
                  </div>
                </td>

                {/* 3. Opening Base */}
                <td className="py-3 px-3 text-right font-mono font-medium text-muted-foreground">
                  {row.openingBase.toLocaleString()}
                </td>

                {/* 4. Deposit Qty */}
                <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {row.periodDeposits > 0 ? `+${row.periodDeposits.toLocaleString()}` : "0"}
                </td>

                {/* 5. Swap Qty */}
                <td className="py-3 px-3 text-right font-mono text-primary font-medium">
                  {row.periodSwaps.toLocaleString()}
                </td>

                {/* 6. Running Base */}
                <td className="py-3 px-3 text-right font-mono font-bold text-sm text-foreground">
                  {row.closingBase.toLocaleString()}
                </td>

                {/* 7. Ownership */}
                <td className="py-3 px-3 text-center">
                  <OwnershipBadge ownership={row.ownership} />
                </td>

                {/* 8. Last Transaction Date */}
                <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                  {row.lastTransactionDate || "—"}
                </td>

                {/* 9. Reference */}
                <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground truncate max-w-[140px]" title={row.lastReferenceNo || "—"}>
                  {row.lastReferenceNo || "—"}
                </td>

                {/* 10. Audit Status */}
                <td className="py-3 px-3 text-center">
                  <StatusBadge
                    isVerified={row.verifiedTransactionsCount > 0}
                    exceptionCount={row.exceptionCount}
                  />
                </td>

                {/* 11. Actions */}
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCustomerDetail(row.customerCode);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-2xs transition hover:bg-muted group-hover:border-primary/40 group-hover:text-primary"
                  >
                    <Eye className="h-3 w-3" />
                    <span>View Ledger</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Table Footer / Pagination ─────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/10 text-xs text-muted-foreground">
        <div>
          Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
          <span className="font-semibold text-foreground">
            {Math.min(startIndex + pageSize, totalRows)}
          </span>{" "}
          of <span className="font-semibold text-foreground">{totalRows.toLocaleString()}</span> accounts
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
