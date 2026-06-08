"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, PlusCircle, Gauge, Weight, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import type { UnifiedBillingTransaction, BillingMode } from "../types";

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onNew: () => void;
  listKey?: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40",
  POSTED: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40",
  CANCELLED: "text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40",
};

const BILLING_MODE_BADGE: Record<BillingMode, { label: string; cls: string }> = {
  BOTH: { label: "Metered + Physical", cls: "text-violet-600 bg-violet-50 dark:bg-violet-900/20 border-violet-200" },
  KILO: { label: "Physical Only", cls: "text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200" },
};

export function UnifiedBillingList({ selectedId, onSelect, onNew, listKey }: Props) {
  const [items, setItems] = useState<UnifiedBillingTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modeFilter, setModeFilter] = useState<BillingMode | "">("");
  const [loading, setLoading] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(modeFilter ? { billingMode: modeFilter } : {}),
      });
      const res = await fetch(`/api/ids/scm/lpg-billing-management/unified-billing?${qs}`);
      const json = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, modeFilter]);

  useEffect(() => {
    load();
  }, [load, listKey]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="w-80 shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-900/20">
      {/* Header */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800/60 space-y-2">
        <button
          id="unified-billing-new-btn"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          New Transaction
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            id="unified-billing-search"
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Filters row */}
        <div className="flex gap-1.5">
          <select
            id="unified-billing-status-filter"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="flex-1 text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            id="unified-billing-mode-filter"
            value={modeFilter}
            onChange={(e) => { setModeFilter(e.target.value as BillingMode | ""); setPage(1); }}
            className="flex-1 text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          >
            <option value="">All Tracks</option>
            <option value="BOTH">Metered+Physical</option>
            <option value="KILO">Physical Only</option>
          </select>
          <button
            id="unified-billing-refresh-btn"
            onClick={load}
            className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No transactions found.</div>
        ) : (
          items.map((tx) => {
            const mode = (tx.site?.billing_mode ?? tx.billing_mode) as BillingMode | undefined;
            const modeBadge = mode ? BILLING_MODE_BADGE[mode] : null;
            const statusCls = STATUS_COLORS[tx.status] ?? STATUS_COLORS.DRAFT;
            const isSelected = tx.id === selectedId;

            return (
              <button
                key={tx.id}
                id={`unified-tx-row-${tx.id}`}
                onClick={() => onSelect(tx.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800/40 transition-colors ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800/40"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                    {tx.transaction_no ?? `TX-${tx.id}`}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${statusCls}`}>
                    {tx.status}
                  </span>
                </div>

                <div className="text-[11px] text-muted-foreground truncate">
                  {tx.customer?.customer_name ?? tx.customer_code}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {modeBadge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${modeBadge.cls}`}>
                      {mode === "BOTH" ? <Gauge className="h-2.5 w-2.5" /> : <Weight className="h-2.5 w-2.5" />}
                      {modeBadge.label}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {tx.billable_kg?.toFixed(2)} kg
                  </span>
                </div>

                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {tx.transaction_date}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between">
          <button
            id="unified-billing-prev-page"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            id="unified-billing-next-page"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
