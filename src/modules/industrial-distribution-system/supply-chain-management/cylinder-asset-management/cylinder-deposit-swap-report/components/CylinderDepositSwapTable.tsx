// src/modules/industrial-distribution-system/supply-chain-management/cylinder-asset-management/cylinder-deposit-swap-report/components/CylinderDepositSwapTable.tsx
// ==============================================================================
// Master Results Table for Cylinder Deposit and Swap Report.
// Columns:
// Customer, Date, Deposit Qty, Swap Qty, Running Base, Reference, Action.
// Features:
// - Interactive column sorting with asc/desc indicators on all data columns
// - Informative hover tooltips (titles) detailing metric calculation basis
// - Debounced, flicker-free search bar preventing transient empty flashes
// - Expandable product line-item breakdown with Framer Motion accordions
// - Audit drawer slide-over trigger
// - Ownership column removed per user instruction
// ==============================================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Search,
  Layers,
  ArrowRightCircle,
  Package,
  Calendar,
  FileText,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
} from "lucide-react";
import { useCylinderDepositSwapReport } from "../hooks/useCylinderDepositSwapReport";
import { filterReportRows } from "../services/cylinder-deposit-swap.calc";

type SortField =
  | "customer"
  | "date"
  | "depositQty"
  | "swapQty"
  | "runningBase"
  | "reference";

type SortDirection = "asc" | "desc";

function SortIcon({
  field,
  currentField,
  direction,
}: {
  field: SortField;
  currentField: SortField | null;
  direction: SortDirection;
}) {
  if (currentField !== field) {
    return (
      <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity ml-1 inline-block shrink-0" />
    );
  }
  return direction === "asc" ? (
    <ArrowUp className="h-3 w-3 text-primary ml-1 inline-block shrink-0" />
  ) : (
    <ArrowDown className="h-3 w-3 text-primary ml-1 inline-block shrink-0" />
  );
}

export function CylinderDepositSwapTable() {
  const {
    report,
    isLoading,
    searchQuery,
    setSearchQuery,
    openCustomerDetail,
    selectedCustomerCode,
  } = useCylinderDepositSwapReport();

  // State to track expanded customer rows (Set of customer codes)
  const [expandedCodes, setExpandedCodes] = React.useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);

  // Column sorting state - defaults to highest running base volume descending
  const [sortField, setSortField] = React.useState<SortField | null>("runningBase");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

  // Local search draft state for instant, non-flickering typing
  const [searchInput, setSearchInput] = React.useState(searchQuery);

  // Synchronize local search input if external query updates (e.g., reset)
  React.useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // AG-COMMENT: Debounce search filter updates by 150ms to eliminate table flickering
  // and prevent the transient empty state flash when typing rapidly.
  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchQuery) {
        setSearchQuery(searchInput);
        setCurrentPage(1);
      }
    }, 150);
    return () => clearTimeout(handler);
  }, [searchInput, searchQuery, setSearchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Alphabetical and reference columns default to ascending; numeric metrics default to descending
      setSortDirection(
        field === "customer" || field === "reference" ? "asc" : "desc"
      );
    }
    setCurrentPage(1);
  };

  const toggleExpand = (code: string) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!report) return;
    setExpandedCodes(new Set(report.rows.map((r) => r.customerCode)));
  };

  const collapseAll = () => {
    setExpandedCodes(new Set());
  };

  const reportRows = report?.rows;

  // Filter rows based on debounced search query
  const filteredRows = React.useMemo(
    () => (reportRows ? filterReportRows(reportRows, searchQuery) : []),
    [reportRows, searchQuery]
  );

  // AG-COMMENT: Multi-column sorting applied across filtered dataset
  const sortedRows = React.useMemo(() => {
    if (!sortField) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      let comp = 0;
      switch (sortField) {
        case "customer":
          comp = a.customerName.localeCompare(b.customerName);
          break;
        case "date": {
          const dateA = a.date || a.lastTransactionDate || "";
          const dateB = b.date || b.lastTransactionDate || "";
          comp = dateA.localeCompare(dateB);
          break;
        }
        case "depositQty":
          comp = a.depositQty - b.depositQty;
          break;
        case "swapQty":
          comp = a.swapQty - b.swapQty;
          break;
        case "runningBase":
          comp = a.runningBase - b.runningBase;
          break;
        case "reference": {
          const refA = a.reference || "";
          const refB = b.reference || "";
          comp = refA.localeCompare(refB);
          break;
        }
      }
      return sortDirection === "asc" ? comp : -comp;
    });
  }, [filteredRows, sortField, sortDirection]);

  // Paginated rows
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  return (
    <div className="rounded-xl border bg-card shadow-2xs text-card-foreground">
      {/* ── Table Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customer name, code, store, reference, or product..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-8 py-1.5 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Collapse All
          </button>
          <span className="text-xs text-muted-foreground ml-2">
            Showing {sortedRows.length} customers
          </span>
        </div>
      </div>

      {/* ── Table: Exact Columns with Sortable Headers & Tooltips (Ownership removed) ───────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 font-medium text-muted-foreground uppercase border-b text-[11px]">
            <tr>
              <th className="py-3 px-3 w-10"></th>

              {/* 1. Customer */}
              <th
                onClick={() => handleSort("customer")}
                className="py-3 px-4 cursor-pointer select-none group hover:text-foreground transition-colors"
                title="Customer Account Name, Store Branch, and Account Code. Click to sort."
              >
                <div className="flex items-center gap-1">
                  <span>Customer</span>
                  <SortIcon field="customer" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 2. Date */}
              <th
                onClick={() => handleSort("date")}
                className="py-3 px-3 cursor-pointer select-none group hover:text-foreground transition-colors"
                title="Date of the latest recorded cylinder movement (delivery, refill swap, or return). Click to sort."
              >
                <div className="flex items-center gap-1">
                  <span>Date</span>
                  <SortIcon field="date" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 3. Deposit Qty */}
              <th
                onClick={() => handleSort("depositQty")}
                className="py-3 px-3 text-right cursor-pointer select-none group hover:text-foreground transition-colors"
                title="Total new physical cylinder container deposits issued to the customer in this period. Directly expands the customer's active custody balance (+). Click to sort."
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Deposit Qty</span>
                  <SortIcon field="depositQty" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 4. Swap Qty */}
              <th
                onClick={() => handleSort("swapQty")}
                className="py-3 px-3 text-right cursor-pointer select-none group hover:text-foreground transition-colors"
                title="Total routine 1-to-1 refill cylinder exchanges (empty cylinders received back in exchange for refilled cylinders). Net zero custody change. Click to sort."
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Swap Qty</span>
                  <SortIcon field="swapQty" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 5. Running Base */}
              <th
                onClick={() => handleSort("runningBase")}
                className="py-3 px-3 text-right font-bold text-foreground cursor-pointer select-none group hover:text-foreground transition-colors"
                title="Current total physical cylinders actively held in custody by the customer (Opening Base + Deposits - Pull-outs + Net Variance). Click to sort."
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Running Base</span>
                  <SortIcon field="runningBase" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* 6. Reference */}
              <th
                onClick={() => handleSort("reference")}
                className="py-3 px-4 cursor-pointer select-none group hover:text-foreground transition-colors"
                title="Document reference number of the latest movement transaction (WIWO, Sales Order, or Return). Click to sort."
              >
                <div className="flex items-center gap-1">
                  <span>Reference</span>
                  <SortIcon field="reference" currentField={sortField} direction={sortDirection} />
                </div>
              </th>

              {/* Action */}
              <th
                className="py-3 px-4 text-center"
                title="Drill down into customer physical serials, cash deposits, and complete movement audit history."
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* AG-COMMENT: Replaced laggy AnimatePresence mode="wait" on the parent tbody
                with direct conditional rendering. Eliminates search bar flickering and empty-state blink. */}
            {isLoading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse">
                  <td colSpan={8} className="py-3.5 px-4">
                    <div className="h-4 w-full bg-muted rounded-xs" />
                  </td>
                </tr>
              ))
            ) : paginatedRows.length === 0 ? (
              <tr key="empty-state">
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Layers className="h-8 w-8 text-muted-foreground/50" />
                    <p className="font-medium">No cylinder records match the selected criteria.</p>
                    <p className="text-xs">Adjust your date range, branch, or search term above.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => {
                const isExpanded = expandedCodes.has(row.customerCode);
                const isSelected = selectedCustomerCode === row.customerCode;

                return (
                  <React.Fragment key={row.customerCode}>
                    {/* Parent Customer Row */}
                    <tr
                      className={`transition-colors hover:bg-muted/40 ${
                        isSelected ? "bg-primary/5 font-medium" : ""
                      }`}
                    >
                      {/* Expand Toggle */}
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => toggleExpand(row.customerCode)}
                          className="rounded-md p-1 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                          title={isExpanded ? "Collapse Products" : "Expand Products"}
                        >
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.18, ease: "easeInOut" }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </motion.div>
                        </button>
                      </td>

                      {/* 1. Customer */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{row.customerName}</span>
                          {row.products.length > 1 && (
                            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
                              {row.products.length} products
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span className="font-mono">{row.customerCode}</span>
                          {row.storeName && <span>• {row.storeName}</span>}
                          {row.branchName && (
                            <span className="text-[10px] text-muted-foreground/80">({row.branchName})</span>
                          )}
                        </div>
                      </td>

                      {/* 2. Date */}
                      <td className="py-3 px-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Calendar className="h-3 w-3 text-muted-foreground/60" />
                          <span>{row.date || row.lastTransactionDate || "—"}</span>
                        </div>
                      </td>

                      {/* 3. Deposit Qty */}
                      <td className="py-3 px-3 text-right font-medium">
                        <span
                          className={
                            row.depositQty > 0
                              ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {row.depositQty > 0 ? `+${row.depositQty.toLocaleString()}` : "0"}
                        </span>
                      </td>

                      {/* 4. Swap Qty */}
                      <td className="py-3 px-3 text-right font-medium text-indigo-600 dark:text-indigo-400">
                        {row.swapQty > 0 ? row.swapQty.toLocaleString() : "0"}
                      </td>

                      {/* 5. Running Base */}
                      <td className="py-3 px-3 text-right font-bold text-foreground text-sm">
                        {row.runningBase.toLocaleString()}
                      </td>

                      {/* 6. Reference */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                          <FileText className="h-3 w-3 text-primary/70 shrink-0" />
                          <span className="truncate max-w-[140px]" title={row.reference || ""}>
                            {row.reference || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Action: Audit Drawer */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => openCustomerDetail(row.customerCode)}
                          className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors shadow-2xs cursor-pointer"
                        >
                          <span>Audit</span>
                          <ArrowRightCircle className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* AG-COMMENT: Expandable Product Line Items with full reconciliation details */}
                    <AnimatePresence>
                      {isExpanded &&
                        row.products.map((prod) => (
                          <motion.tr
                            key={`${row.customerCode}-${prod.productId}`}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.16, ease: "easeOut" }}
                            className="bg-muted/20 text-muted-foreground hover:bg-muted/30"
                          >
                            <td className="py-2.5 px-3 text-center">
                              <span className="text-muted-foreground/40 text-[10px]">└</span>
                            </td>
                            <td className="py-2.5 px-4 pl-6" colSpan={2}>
                              <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5 text-primary/70" />
                                <span className="font-medium text-foreground">
                                  {prod.productName}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  ({prod.productCode})
                                </span>
                                <span className="rounded-xs bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground ml-1">
                                  {prod.circulatingQty} active
                                </span>
                              </div>
                            </td>

                            {/* Product Deposit Qty */}
                            <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                              {prod.depositsDelivered > 0 ? `+${prod.depositsDelivered}` : "0"}
                            </td>

                            {/* Product Swap Qty */}
                            <td className="py-2.5 px-3 text-right">
                              {prod.swapsInbound.toLocaleString()} in / {prod.swapsOutbound.toLocaleString()} out
                            </td>

                            {/* Product Running Base */}
                            <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                              {prod.closingBase.toLocaleString()}
                            </td>

                            {/* Reconciliation Formula Breakdown */}
                            <td className="py-2.5 px-4 text-[10px] text-muted-foreground font-mono" colSpan={2}>
                              Open: {prod.openingBase} | Ret: -{prod.depositsPulledOut} | NetΔ:{" "}
                              {prod.netSwapVariance > 0 ? `+${prod.netSwapVariance}` : prod.netSwapVariance}
                            </td>
                          </motion.tr>
                        ))}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Bar ─────────────────────────────────────────────────── */}
      {!isLoading && sortedRows.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-md border bg-background px-3 py-1 font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border bg-background px-3 py-1 font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}