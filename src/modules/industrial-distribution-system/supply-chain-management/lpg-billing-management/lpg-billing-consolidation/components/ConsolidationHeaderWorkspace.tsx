"use client";

// ─── ConsolidationHeaderWorkspace.tsx ───────────────────────────────────────
// Full-page, grid-based card workspace for selecting a billing consolidation header (Step 1).
// Modeled after the premium stepper designs in the wiwo-billing module.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import {
  CalendarRange,
  Loader2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  ReceiptText,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseBillingConsolidationReturn } from "../hooks/useBillingConsolidation";
import type { HeaderStatus, ConsolidationHeaderListParams } from "../types/billing-consolidation.types";

interface ConsolidationHeaderWorkspaceProps {
  hook: UseBillingConsolidationReturn;
  onSelect: (headerId: number) => void;
}

const STATUS_OPTS: { label: string; value: HeaderStatus | "ALL" }[] = [
  { label: "All Headers", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Posted", value: "POSTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function StatusBadge({ status }: { status: HeaderStatus }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    DRAFT: {
      icon: <Clock className="h-2.5 w-2.5" />,
      cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    },
    POSTED: {
      icon: <CheckCircle2 className="h-2.5 w-2.5" />,
      cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    },
    CANCELLED: {
      icon: <AlertCircle className="h-2.5 w-2.5" />,
      cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    },
  };
  const cfg = map[status] ?? {
    icon: null,
    cls: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${cfg.cls}`}
    >
      {cfg.icon}
      {status}
    </span>
  );
}

const formatDateShort = (iso?: string | null) => {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function ConsolidationHeaderWorkspace({ hook, onSelect }: ConsolidationHeaderWorkspaceProps) {
  const {
    headers,
    totalHeaders,
    isLoadingHeaders,
    headerError,
    headerParams,
    setHeaderParams,
    loadHeaders,
    selectedHeaderId,
  } = hook;

  // Local search input
  const [searchInput, setSearchInput] = useState(headerParams.search ?? "");

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setHeaderParams({ search: searchInput, page: 1 });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, setHeaderParams]);

  // Load headers on parameters change
  useEffect(() => {
    loadHeaders();
  }, [loadHeaders, headerParams]);

  // Sorting state handler
  const toggleSort = (field: Exclude<ConsolidationHeaderListParams["sortField"], undefined>) => {
    if (headerParams.sortField === field) {
      setHeaderParams({
        sortDir: headerParams.sortDir === "asc" ? "desc" : "asc",
        page: 1,
      });
    } else {
      setHeaderParams({
        sortField: field,
        sortDir: "asc",
        page: 1,
      });
    }
  };

  const renderSortIcon = (field: Exclude<ConsolidationHeaderListParams["sortField"], undefined>) => {
    if (headerParams.sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-70 transition-opacity" />;
    }
    return headerParams.sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary" />
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col bg-card/80 backdrop-blur-md rounded-3xl shadow-md border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 my-4">
      {/* ── Header ── */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-transparent shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">
              LPG Billing Consolidation
            </p>
            <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-black border border-primary/20 dark:bg-primary/20 dark:text-primary-foreground/90 dark:border-primary/30 shrink-0">
                1
              </span>
              <span className="truncate">Select Billing Header</span>
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">
              Choose a consolidated billing period header to review and approve transactions.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadHeaders()}
              disabled={isLoadingHeaders}
              title="Refresh headers list"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors shrink-0"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground", isLoadingHeaders && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border space-y-2.5 shrink-0">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search headers, customer codes or site names..."
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {STATUS_OPTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHeaderParams({ status: opt.value, page: 1 })}
                className={cn(
                  "text-xs font-bold px-3 py-1.5 rounded-xl border transition-all duration-250 whitespace-nowrap",
                  headerParams.status === opt.value
                    ? "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground/90 dark:border-primary/30 shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Billing Mode Filter Tabs Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2.5 border-t border-border/50">
          {/* Billing Mode segmented tabs */}
          <div className="flex p-1 bg-muted/60 dark:bg-zinc-800/40 rounded-xl border border-border/80 max-w-md w-full">
            {[
              { label: "All Sites", value: "ALL" as const },
              { label: "Metered-WIWO", value: "BOTH" as const },
              { label: "Kilo Only", value: "KILO" as const },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setHeaderParams({ billing_mode: tab.value, page: 1 })}
                className={cn(
                  "flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all",
                  headerParams.billing_mode === tab.value
                    ? "bg-card text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Count Indicator */}
        <p className="text-xs text-muted-foreground">
          {isLoadingHeaders
            ? "Loading billing headers..."
            : `${totalHeaders} header${totalHeaders !== 1 ? "s" : ""} found`}
        </p>
      </div>

      {/* ── Table List ── */}
      <div className="flex-1 sm:flex-initial overflow-auto custom-scrollbar sm:max-h-[500px]" style={{ minHeight: 250 }}>
        {headerError && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-rose-500 border border-dashed border-rose-200 rounded-2xl bg-rose-50/50 dark:bg-rose-950/15 m-4">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm font-bold">Failed to load headers</p>
            <p className="text-xs text-muted-foreground mt-1">{headerError}</p>
          </div>
        )}

        {isLoadingHeaders && headers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <span className="text-sm animate-pulse">Loading headers...</span>
          </div>
        ) : !isLoadingHeaders && headers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground text-center">
            <ReceiptText className="h-10 w-10 opacity-20 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">No billing headers found</p>
              <p className="text-xs mt-0.5">Try adjusting your filters, search criteria, or billing mode options.</p>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            {/* Sticky column headers */}
            <thead className="sticky top-0 z-10 bg-card border-b border-border">
              <tr>
                {/* Period */}
                <th className="text-left px-4 py-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("period_from")}
                    className="group inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    Period
                    {renderSortIcon("period_from")}
                  </button>
                </th>

                {/* Site */}
                <th className="text-left px-4 py-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("site")}
                    className="group inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    Site
                    {renderSortIcon("site")}
                  </button>
                </th>

                {/* Customer */}
                <th className="text-left px-4 py-2.5 hidden md:table-cell whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("customer")}
                    className="group inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    Customer
                    {renderSortIcon("customer")}
                  </button>
                </th>

                {/* Mode */}
                <th className="text-left px-4 py-2.5 hidden sm:table-cell whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("billing_mode")}
                    className="group inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    Mode
                    {renderSortIcon("billing_mode")}
                  </button>
                </th>

                {/* Status */}
                <th className="text-left px-4 py-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort("status")}
                    className="group inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    Status
                    {renderSortIcon("status")}
                  </button>
                </th>

                {/* Header No */}
                <th className="text-left px-4 py-2.5 hidden lg:table-cell whitespace-nowrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground whitespace-nowrap">Header #</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {headers.map((header) => {
                const customerName = header.customer?.customer_name || header.customer_id;
                const isSelected = selectedHeaderId === header.header_id;
                const billingMode = header.site?.billing_mode;
                const isBilled = header.is_billed === 1;

                return (
                  <tr
                    key={header.header_id}
                    onClick={() => onSelect(header.header_id)}
                    className={cn(
                      "group cursor-pointer transition-all duration-150",
                      isSelected
                        ? "bg-primary/8 border-l-2 border-l-primary"
                        : "hover:bg-accent/50 border-l-2 border-l-transparent"
                    )}
                  >
                    {/* Period Date */}
                    <td className="px-4 py-3 whitespace-nowrap min-w-[200px]">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all",
                        isSelected
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "bg-muted/40 border-border/40 text-foreground"
                      )}>
                        <CalendarRange className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                        <span>{formatDateShort(header.period_from)}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-0.5">to</span>
                        <span>{formatDateShort(header.period_to)}</span>
                      </div>
                    </td>

                    {/* Site Name */}
                    <td className="px-4 py-3 whitespace-nowrap min-w-[120px]">
                      <p className={cn(
                        "text-xs font-bold leading-tight truncate max-w-[150px] transition-colors duration-150",
                        isSelected ? "text-primary" : "text-foreground"
                      )}>
                        {header.site?.site_name || `Site #${header.customer_site_id}`}
                      </p>
                    </td>

                    {/* Customer ID */}
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap min-w-[120px]">
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {customerName}
                      </p>
                    </td>

                    {/* Billing Mode Badge */}
                    <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap min-w-[90px]">
                      {billingMode ? (
                        <span className={cn(
                          "inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap border shrink-0",
                          billingMode === "KILO"
                            ? "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200/50 dark:border-cyan-800/30 text-cyan-700 dark:text-cyan-400"
                            : "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200/50 dark:border-indigo-800/30 text-indigo-700 dark:text-indigo-400"
                        )}>
                          {billingMode === "BOTH" ? "Metered-WIWO" : billingMode}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap min-w-[90px]">
                      <div className="inline-flex items-center gap-1.5">
                        {isBilled && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            Billed
                          </span>
                        )}
                        <StatusBadge status={header.status} />
                      </div>
                    </td>

                    {/* Header No */}
                    <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap min-w-[100px]">
                      <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {header.header_no || `#${header.header_id}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalHeaders > 0 && (
        <div className="px-4 py-3 border-t border-border bg-muted/20 dark:bg-zinc-900/10 flex flex-col items-center justify-center gap-3 shrink-0">
          {/* Info */}
          <div className="text-xs text-muted-foreground text-center">
            Showing <span className="font-semibold text-foreground">{Math.min(totalHeaders, ((headerParams.page ?? 1) - 1) * (headerParams.limit ?? 15) + 1)}</span> to{" "}
            <span className="font-semibold text-foreground">{Math.min(totalHeaders, (headerParams.page ?? 1) * (headerParams.limit ?? 15))}</span> of{" "}
            <span className="font-semibold text-foreground">{totalHeaders}</span> headers
          </div>

          <div className="flex items-center gap-4">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Show</span>
              <select
                value={headerParams.limit ?? 15}
                onChange={(e) => {
                  setHeaderParams({ limit: Number(e.target.value), page: 1 });
                }}
                className="h-8 px-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer font-bold"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>entries</span>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={(headerParams.page ?? 1) <= 1 || isLoadingHeaders}
                onClick={() => setHeaderParams({ page: Math.max(1, (headerParams.page ?? 1) - 1) })}
                className="h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted-foreground transition-all duration-150"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              {/* Compact Page indicators */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.max(1, Math.ceil(totalHeaders / (headerParams.limit ?? 15))) }, (_, i) => i + 1)
                  .filter((p, _, arr) => p === 1 || p === arr.length || Math.abs(p - (headerParams.page ?? 1)) <= 1)
                  .map((p, idx, arr) => {
                    const isAct = p === (headerParams.page ?? 1);
                    const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;

                    return (
                      <div key={p} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-xs text-muted-foreground">...</span>}
                        <button
                          type="button"
                          onClick={() => setHeaderParams({ page: p })}
                          className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-all duration-150 ${
                            isAct
                              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                              : "border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
                          }`}
                        >
                          {p}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={(headerParams.page ?? 1) >= Math.max(1, Math.ceil(totalHeaders / (headerParams.limit ?? 15))) || isLoadingHeaders}
                onClick={() => setHeaderParams({ page: Math.min(Math.max(1, Math.ceil(totalHeaders / (headerParams.limit ?? 15))), (headerParams.page ?? 1) + 1) })}
                className="h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted-foreground transition-all duration-150"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
