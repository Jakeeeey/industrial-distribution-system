// RULE DEV: WiWO Billing Summary List component
// Left-panel sidebar showing paginated, filterable list of WiWO billing transactions.
// Mirrors the design of metered-billing-summary/components/SummaryList.tsx

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Scale } from "lucide-react";
import { useWiwoSummaryList } from "../hooks/useWiwoSummary";
import { format } from "date-fns";

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

// Status badge map
const STATUS_BADGE: Record<string, React.ReactNode> = {
  DRAFT: (
    <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
      Draft
    </Badge>
  ),
  POSTED: (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none text-[10px] font-bold uppercase tracking-wider">
      Posted
    </Badge>
  ),
  CANCELLED: (
    <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider">
      Cancelled
    </Badge>
  ),
};

// Transaction type badge map
const TX_TYPE_BADGE: Record<string, React.ReactNode> = {
  ONBOARDING_BASELINE: (
    <Badge className="bg-amber-100 text-amber-700 border-none text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider">
      Onboarding
    </Badge>
  ),
  REGULAR_BILLING: (
    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-none text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider">
      Regular
    </Badge>
  ),
};

type StatusFilter = "ALL" | "DRAFT" | "POSTED" | "CANCELLED";
type TypeFilter = "ALL" | "REGULAR_BILLING" | "ONBOARDING_BASELINE";

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: "ALL", label: "All Types" },
  { key: "REGULAR_BILLING", label: "Regular" },
  { key: "ONBOARDING_BASELINE", label: "Onboarding" },
];

export function WiwoSummaryList({ selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const { rows, total, loading, params, setParams, refresh } = useWiwoSummaryList({
    transactionType: "ALL",
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    setParams((p) => ({ ...p, search: v, page: 1 }));
  };

  const handleTypeFilter = (t: TypeFilter) => {
    setTypeFilter(t);
    setParams((p) => ({ ...p, transactionType: t, page: 1 }));
  };

  const handleStatusFilter = (s: StatusFilter) => {
    setStatusFilter(s);
    setParams((p) => ({ ...p, status: s === "ALL" ? undefined : s, page: 1 }));
  };

  const limit = params.limit ?? 10;
  const page = params.page ?? 1;

  return (
    <div className="w-full shrink-0 lg:border-r border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black text-foreground uppercase tracking-tight">
            WiWO Billing Records
          </div>
          <div className="text-[11px] text-muted-foreground">{total} transactions total</div>
        </div>
        <Button
          id="wiwo-summary-refresh"
          variant="outline"
          size="icon"
          className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          onClick={refresh}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Type Filter Tabs */}
      <div className="px-3 pt-3 pb-1 border-b border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/10">
        <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              id={`wiwo-type-filter-${tab.key.toLowerCase()}`}
              onClick={() => handleTypeFilter(tab.key)}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                typeFilter === tab.key
                  ? tab.key === "ONBOARDING_BASELINE"
                    ? "bg-white dark:bg-zinc-700 shadow-sm text-amber-600"
                    : tab.key === "REGULAR_BILLING"
                      ? "bg-white dark:bg-zinc-700 shadow-sm text-orange-600"
                      : "bg-white dark:bg-zinc-700 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status Filter Chips */}
      <div className="px-3 py-2 border-b border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/5">
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {(["ALL", "DRAFT", "POSTED", "CANCELLED"] as StatusFilter[]).map((st) => (
            <button
              key={st}
              id={`wiwo-status-filter-${st.toLowerCase()}`}
              type="button"
              onClick={() => handleStatusFilter(st)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-full border transition-all whitespace-nowrap ${
                statusFilter === st
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-800"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="p-3 pb-2 bg-zinc-50/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            id="wiwo-summary-search"
            placeholder="Search TX#, Customer..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-xs bg-white dark:bg-zinc-900"
          />
        </div>
      </div>

      {/* Card List */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {loading && rows.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-100 dark:border-zinc-800/40 p-4 animate-pulse space-y-2 bg-zinc-50/50 dark:bg-zinc-900/10"
            >
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-muted-foreground bg-zinc-50/30 dark:bg-zinc-900/5">
            No WiWO billing transactions found.
          </div>
        ) : (
          rows.map((row) => {
            const id = row.id;
            const txNo = row.transaction_no;
            const txType = row.transaction_type ?? "REGULAR_BILLING";
            const date = row.transaction_date
              ? format(new Date(row.transaction_date), "MMM dd, yyyy")
              : "—";
            const customer =
              row.customer?.customer_name || row.customer_code;
            const site =
              row.site?.site_name ||
              (row.lpg_site_id ? `Site #${row.lpg_site_id}` : "—");
            const billableKg = row.billable_kg != null ? Number(row.billable_kg) : 0;
            const netAmt = row.net_amount != null ? Number(row.net_amount) : 0;
            const isSelected = selectedId === id;
            const isOnboarding = txType === "ONBOARDING_BASELINE";

            return (
              <button
                key={id}
                id={`wiwo-summary-row-${id}`}
                type="button"
                onClick={() => onSelect(id ?? null)}
                className={`w-full text-left rounded-xl border p-3 transition text-sm flex flex-col gap-2 ${
                  isSelected
                    ? isOnboarding
                      ? "border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 ring-1 ring-amber-500/30 shadow-md"
                      : "border-orange-500 bg-orange-50/20 dark:bg-orange-950/20 ring-1 ring-orange-500/30 shadow-md shadow-orange-500/5"
                    : "border-zinc-150 dark:border-zinc-800/80 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 bg-white dark:bg-zinc-950"
                }`}
              >
                <div className="flex items-start justify-between gap-3 w-full">
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Transaction Number */}
                    <div
                      className={`text-xs font-bold truncate font-mono ${
                        isSelected
                          ? isOnboarding
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-orange-600 dark:text-orange-400"
                          : "text-foreground"
                      }`}
                    >
                      {txNo || `TX #${id}`}
                    </div>
                    <div className="text-[11px] text-zinc-900 dark:text-zinc-100 font-bold truncate">
                      {customer}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <Scale className="h-3 w-3 shrink-0 text-muted-foreground" />
                      {site}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {STATUS_BADGE[row.status] ?? (
                      <Badge variant="outline">{row.status}</Badge>
                    )}
                    {TX_TYPE_BADGE[txType]}
                  </div>
                </div>

                {/* Footer row */}
                <div className="flex justify-between items-center border-t border-dashed border-zinc-150 dark:border-zinc-800/50 pt-2 w-full text-[10px] text-zinc-400 dark:text-zinc-500">
                  <span>{date}</span>
                  <div className="flex items-center gap-1.5">
                    {isOnboarding ? (
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded text-[10px]">
                        Baseline: {billableKg > 0 ? `${billableKg.toFixed(3)} kg` : `${Number(row.metered_kg ?? 0).toFixed(3)} kg`}
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-foreground bg-zinc-50 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-[10px]">
                        {billableKg.toFixed(3)} kg (₱{netAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="px-4 py-3 border-t border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 flex justify-between items-center text-[11px] text-zinc-500">
          <span>
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <div className="flex gap-2">
            <Button
              id="wiwo-summary-prev-page"
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
              className="h-7 px-2.5 text-[10px]"
            >
              Prev
            </Button>
            <Button
              id="wiwo-summary-next-page"
              variant="outline"
              size="sm"
              disabled={page * limit >= total}
              onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
              className="h-7 px-2.5 text-[10px]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
