// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/components/CylinderDepositSwapTable.tsx
// ==============================================================================
// Master Results Table for Cylinder Deposit and Swap Report.
// Customer-level aggregation with expandable product sub-rows and audit drawer trigger.
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
} from "lucide-react";
import { useCylinderDepositSwapReport } from "../hooks/useCylinderDepositSwapReport";
import { filterReportRows } from "../services/cylinder-deposit-swap.calc";

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
  const filteredRows = React.useMemo(
    () => (reportRows ? filterReportRows(reportRows, searchQuery) : []),
    [reportRows, searchQuery]
  );

  // Paginated rows
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  return (
    <div className="rounded-xl border bg-card shadow-2xs text-card-foreground">
      {/* ── Table Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customer name, code, store, or product..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-1.5 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Collapse All
          </button>
          <span className="text-xs text-muted-foreground ml-2">
            Showing {filteredRows.length} customers
          </span>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 font-medium text-muted-foreground uppercase border-b">
            <tr>
              <th className="py-3 px-4 w-10"></th>
              <th className="py-3 px-4">Customer Details</th>
              <th className="py-3 px-4">Branch</th>
              <th className="py-3 px-4 text-right">Opening Base</th>
              <th className="py-3 px-4 text-right">Deposits (+)</th>
              <th className="py-3 px-4 text-right">Swaps In (Empty)</th>
              <th className="py-3 px-4 text-right">Swaps Out (Full)</th>
              <th className="py-3 px-4 text-right">Returns (-)</th>
              <th className="py-3 px-4 text-right">Net Delta</th>
              <th className="py-3 px-4 text-right">Closing Base</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <AnimatePresence mode="wait">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <motion.tr
                    key={`skeleton-${idx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="animate-pulse"
                  >
                    <td colSpan={11} className="py-3.5 px-4">
                      <div className="h-4 w-full bg-muted rounded-xs" />
                    </td>
                  </motion.tr>
                ))
              ) : paginatedRows.length === 0 ? (
                <motion.tr
                  key="empty-state"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="h-8 w-8 text-muted-foreground/50" />
                      <p className="font-medium">No cylinder records match the selected criteria.</p>
                      <p className="text-xs">Adjust your date range, branch, or search term above.</p>
                    </div>
                  </td>
                </motion.tr>
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
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleExpand(row.customerCode)}
                            className="rounded-md p-1 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                            title={isExpanded ? "Collapse Products" : "Expand Products"}
                          >
                            {/* AG-COMMENT: Framer Motion rotating chevron for smooth open/collapse visual feedback */}
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.18, ease: "easeInOut" }}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </motion.div>
                          </button>
                        </td>

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
                          </div>
                        </td>

                        <td className="py-3 px-4 text-muted-foreground">
                          {row.branchName || "—"}
                        </td>

                        <td className="py-3 px-4 text-right font-medium">
                          {row.totalOpeningBase.toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                          {row.totalDepositsDelivered > 0 ? `+${row.totalDepositsDelivered}` : "0"}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {row.totalSwapsInbound.toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {row.totalSwapsOutbound.toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">
                          {row.totalDepositsPulledOut > 0 ? `-${row.totalDepositsPulledOut}` : "0"}
                        </td>

                        <td className="py-3 px-4 text-right font-semibold">
                          <span
                            className={
                              row.totalNetVariance > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : row.totalNetVariance < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground"
                            }
                          >
                            {row.totalNetVariance > 0 ? `+${row.totalNetVariance}` : row.totalNetVariance}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-foreground">
                          {row.totalClosingBase.toLocaleString()}
                        </td>

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

                      {/* AG-COMMENT: Expandable Child Rows for Products with Framer Motion slide & fade */}
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
                              <td className="py-2.5 px-4 text-center">
                                <span className="text-muted-foreground/40 text-[10px]">└</span>
                              </td>
                              <td className="py-2.5 px-4 pl-8" colSpan={2}>
                                <div className="flex items-center gap-2">
                                  <Package className="h-3.5 w-3.5 text-primary/70" />
                                  <span className="font-medium text-foreground">
                                    {prod.productName}
                                  </span>
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    ({prod.productCode})
                                  </span>
                                </div>
                              </td>

                              <td className="py-2.5 px-4 text-right">
                                {prod.openingBase.toLocaleString()}
                              </td>

                              <td className="py-2.5 px-4 text-right text-emerald-600 dark:text-emerald-400">
                                {prod.depositsDelivered > 0 ? `+${prod.depositsDelivered}` : "0"}
                              </td>

                              <td className="py-2.5 px-4 text-right">
                                {prod.swapsInbound.toLocaleString()}
                              </td>

                              <td className="py-2.5 px-4 text-right">
                                {prod.swapsOutbound.toLocaleString()}
                              </td>

                              <td className="py-2.5 px-4 text-right text-rose-600 dark:text-rose-400">
                                {prod.depositsPulledOut > 0 ? `-${prod.depositsPulledOut}` : "0"}
                              </td>

                              <td className="py-2.5 px-4 text-right font-medium">
                                <span
                                  className={
                                    prod.netSwapVariance > 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : prod.netSwapVariance < 0
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {prod.netSwapVariance > 0 ? `+${prod.netSwapVariance}` : prod.netSwapVariance}
                                </span>
                              </td>

                              <td className="py-2.5 px-4 text-right font-semibold text-foreground">
                                {prod.closingBase.toLocaleString()}
                              </td>

                              <td className="py-2.5 px-4 text-center text-[10px] text-muted-foreground">
                                {prod.circulatingQty} active / {prod.idleQty} idle
                              </td>
                            </motion.tr>
                          ))}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* ── Pagination Bar ─────────────────────────────────────────────────── */}
      {!isLoading && filteredRows.length > 0 && (
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
              className="rounded-md border bg-background px-3 py-1 font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border bg-background px-3 py-1 font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
