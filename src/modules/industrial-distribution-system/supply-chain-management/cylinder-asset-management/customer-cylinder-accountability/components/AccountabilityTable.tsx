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
import { ChevronLeft, ChevronRight, Eye, AlertCircle, Building2, Layers, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useCustomerCylinderAccountability } from "../hooks/useCustomerCylinderAccountability";

type SortField =
  | "customer"
  | "branch"
  | "opening"
  | "issued"
  | "returned"
  | "held"
  | "limit"
  | "variance"
 
type SortDirection = "asc" | "desc";

function SortIndicator({
  field,
  currentField,
  direction,
}: {
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
}) {
  if (field !== currentField) {
    return <ArrowUpDown className="h-3 w-3 text-muted-foreground/30 opacity-40 group-hover/col:opacity-100 transition shrink-0" />;
  }
  return direction === "asc" ? (
    <ArrowUp className="h-3 w-3 text-primary shrink-0" />
  ) : (
    <ArrowDown className="h-3 w-3 text-primary shrink-0" />
  );
}

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

  // Sorting state (default: highest custody held first)
  const [sortField, setSortField] = React.useState<SortField>("held");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(
        field === "customer" || field === "branch"   ? "asc" : "desc"
      );
    }
  };

  // Sort rows before pagination
  const sortedRows = React.useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortField) {
        case "customer":
          aVal = (a.customerName || a.customerCode).toLowerCase();
          bVal = (b.customerName || b.customerCode).toLowerCase();
          break;
        case "branch":
          aVal = (a.siteName || a.branchName || "").toLowerCase();
          bVal = (b.siteName || b.branchName || "").toLowerCase();
          break;
        case "opening":
          aVal = a.opening ?? a.openingBase ?? 0;
          bVal = b.opening ?? b.openingBase ?? 0;
          break;
        case "issued":
          aVal = a.issued ?? a.periodDeposits ?? 0;
          bVal = b.issued ?? b.periodDeposits ?? 0;
          break;
        case "returned":
          aVal = a.returned ?? a.periodPullOuts ?? 0;
          bVal = b.returned ?? b.periodPullOuts ?? 0;
          break;
        case "held":
          aVal = a.held ?? a.closingBase ?? 0;
          bVal = b.held ?? b.closingBase ?? 0;
          break;
        case "limit":
          aVal = a.authorizedLimit ?? 0;
          bVal = b.authorizedLimit ?? 0;
          break;
        case "variance":
          aVal = a.variance ?? 0;
          bVal = b.variance ?? 0;
          break;
 
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredRows, sortField, sortDirection]);

  // Pagination calculation
  const totalRows = sortedRows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = React.useMemo(() => {
    return sortedRows.slice(startIndex, startIndex + pageSize);
  }, [sortedRows, startIndex, pageSize]);

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
  if (sortedRows.length === 0) {
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
              {/* 1. Customer */}
              {/* AG-COMMENT: Customer Name primary with sub Customer Code, badge removed */}
              <th
                className="py-3 px-4 cursor-pointer select-none transition hover:bg-muted/70 group/col"
                title="Customer name and customer code. Click to sort by ascending/descending."
                onClick={() => handleSort("customer")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Customer</span>
                  <SortIndicator field="customer" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 2. Branch */}
              <th
                className="py-3 px-3 cursor-pointer select-none transition hover:bg-muted/70 group/col"
                title="Customer operating branch or site location. Click to sort by ascending/descending."
                onClick={() => handleSort("branch")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Branch</span>
                  <SortIndicator field="branch" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 3. Opening */}
              <th
                className="py-3 px-3 text-right cursor-pointer select-none transition hover:bg-muted/70 group/col"
                title="Beginning cylinder custody holdings at the start of the reporting period. Click to sort by ascending/descending."
                onClick={() => handleSort("opening")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Opening</span>
                  <SortIndicator field="opening" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 4. Issued (+) */}
              <th
                className="py-3 px-3 text-right cursor-pointer select-none transition hover:bg-muted/70 group/col"
                title="Physical cylinders issued or deposited to the customer within the reporting period. Click to sort by ascending/descending."
                onClick={() => handleSort("issued")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Issued (+)</span>
                  <SortIndicator field="issued" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 5. Returned (-) */}
              <th
                className="py-3 px-3 text-right cursor-pointer select-none transition hover:bg-muted/70 group/col"
                title="Physical cylinders returned or pulled out from the customer within the reporting period. Click to sort by ascending/descending."
                onClick={() => handleSort("returned")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Returned (-)</span>
                  <SortIndicator field="returned" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 6. Held (=) */}
              <th
                className="py-3 px-3 text-right font-bold text-foreground cursor-pointer select-none transition hover:bg-muted/70 group/col"
                title="Current cylinders held in customer custody (= Opening + Issued - Returned). Click to sort by ascending/descending."
                onClick={() => handleSort("held")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Held (=)</span>
                  <SortIndicator field="held" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 7. Limit */}
              <th
                className="py-3 px-3 text-right cursor-pointer select-none transition hover:bg-muted/70 group/col"
                title="Customer authorized cylinder holding quota ceiling. Click to sort by ascending/descending."
                onClick={() => handleSort("limit")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Limit</span>
                  <SortIndicator field="limit" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 8. Variance */}
              <th
                className="py-3 px-3 text-right cursor-pointer select-none transition hover:bg-muted/70 group/col"
                title="Custody variance against quota: Held minus Limit. Negative = Safe headroom; Positive = Over quota. Click to sort by ascending/descending."
                onClick={() => handleSort("variance")}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Variance</span>
                  <SortIndicator field="variance" currentField={sortField} direction={sortDirection} />
                </div>
              </th>
 

              {/* 10. Actions */}
              <th className="py-3 px-4 text-right" title="Drilldown actions into customer transaction ledger">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginatedRows.map((row) => {
              const opening = row.opening ?? row.openingBase;
              const issued = row.issued ?? row.periodDeposits;
              const returned = row.returned ?? row.periodPullOuts;
              const held = row.held ?? row.closingBase;
              const limit = row.authorizedLimit;
              const variance = row.variance ?? (held - limit);
              const siteName = row.siteName || row.branchName;

              return (
                <tr
                  key={row.customerCode}
                  className="transition hover:bg-muted/30 cursor-pointer group"
                  onClick={() => openCustomerDetail(row.customerCode)}
                >
                  {/* 1. Customer Details (SNET Spec §11: Customer) */}
                  {/* AG-COMMENT: Customer Name as primary label with Customer Code sub-line */}
                  <td className="py-3 px-4">
                    <div className="font-semibold text-foreground leading-snug">
                      {row.customerName}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {row.customerCode}
                    </div>
                  </td>

                  {/* 2. Site / Branch (SNET Spec §11: Site) */}
                  <td className="py-3 px-3 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                      <span className="truncate" title={siteName}>
                        {siteName}
                      </span>
                    </div>
                  </td>

                  {/* 3. Opening Holdings (SNET Spec §11: Opening) */}
                  <td className="py-3 px-3 text-right font-mono font-medium text-muted-foreground">
                    {opening.toLocaleString()}
                  </td>

                  {/* 4. Issued / Deposits (SNET Spec §11: Issued) */}
                  <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {issued > 0 ? `+${issued.toLocaleString()}` : "0"}
                  </td>

                  {/* 5. Returned / Pull-outs (SNET Spec §11: Returned) */}
                  <td className="py-3 px-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                    {returned > 0 ? `-${returned.toLocaleString()}` : "0"}
                  </td>

                  {/* 6. Current Held (SNET Spec §11: Held) */}
                  <td className="py-3 px-3 text-right font-mono font-bold text-sm text-foreground">
                    {held.toLocaleString()}
                  </td>

                  {/* 7. Authorized Limit (SNET Spec §11: Limit) */}
                  <td className="py-3 px-3 text-right font-mono text-muted-foreground font-medium">
                    {limit.toLocaleString()}
                  </td>

                  {/* 8. Variance (SNET Spec §10 & §11: Variance = Held - Limit) */}
                  <td className="py-3 px-3 text-right">
                    {variance > 0 ? (
                      <span
                        className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                        title={`Exceeding authorized holding limit by ${variance.toLocaleString()} cylinders`}
                      >
                        +{variance.toLocaleString()} Over
                      </span>
                    ) : variance === 0 ? (
                      <span className="inline-flex items-center rounded-md border border-slate-500/20 bg-slate-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 dark:text-slate-400">
                        0 Balanced
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
                        title={`Within authorized quota by ${Math.abs(variance).toLocaleString()} cylinders`}
                      >
                        {variance.toLocaleString()}
                      </span>
                    )}
                  </td>
 

                  {/* 10. Actions */}
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
              );
            })}
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
