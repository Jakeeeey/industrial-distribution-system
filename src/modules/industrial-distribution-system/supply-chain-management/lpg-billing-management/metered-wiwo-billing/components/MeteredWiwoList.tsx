"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, RefreshCw } from "lucide-react";
import { useMeteredWiwoList } from "../hooks/useMeteredWiwoBilling";
import { format } from "date-fns";

interface Props {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onNew: () => void;
}

const STATUS_BADGE: Record<string, React.ReactNode> = {
  DRAFT: <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">Draft</Badge>,
  POSTED: (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none text-[10px] font-bold uppercase tracking-wider">
      Posted
    </Badge>
  ),
  CANCELLED: <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider">Cancelled</Badge>,
};

const SOURCE_BADGE: Record<string, React.ReactNode> = {
  METERED: (
    <Badge className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-none text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider">
      Metered
    </Badge>
  ),
  WIWO: (
    <Badge className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-450 border-none text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider">
      WIWO
    </Badge>
  ),
};

export function MeteredWiwoList({ selectedId, onSelect, onNew }: Props) {
  const [search, setSearch] = useState("");
  const { rows, total, loading, params, setParams, refresh } = useMeteredWiwoList();

  const handleSearch = (v: string) => {
    setSearch(v);
    setParams((p) => ({ ...p, search: v, page: 1 }));
  };

  const limit = params.limit ?? 10;
  const page = params.page ?? 1;

  return (
    <div className="w-[360px] shrink-0 border-r border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black text-foreground uppercase tracking-tight">
            Metered Transactions
          </div>
          <div className="text-[11px] text-muted-foreground">
            {total} items total
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            onClick={refresh}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            onClick={onNew}
            className="h-8 bg-violet-600 hover:bg-violet-700 shadow-md shadow-violet-500/20 text-xs font-semibold px-3"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New
          </Button>
        </div>
      </div>

      {/* Toolbar (Search) */}
      <div className="p-3 pb-2 border-b border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            id="metered-wiwo-search"
            placeholder="Search PO#, Customer, Site..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-xs bg-white dark:bg-zinc-900"
          />
        </div>
      </div>

      {/* Cards List container */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto">
        {loading && rows.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-100 dark:border-zinc-800/40 p-4 animate-pulse space-y-2 bg-zinc-50/50 dark:bg-zinc-900/10">
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-muted-foreground bg-zinc-50/30 dark:bg-zinc-900/5">
            No transactions found.
          </div>
        ) : (
          rows.map((row) => {
            const id = row.id;
            const txNo = row.transaction_no;
            const date = row.transaction_date
              ? format(new Date(row.transaction_date), "MMM dd, yyyy")
              : "—";
            const customer = row.customer?.customer_name || row.customer?.store_name || row.customer_code;
            const site = row.site?.site_name || (row.lpg_site_id ? `Site #${row.lpg_site_id}` : "—");
            const billableKg = row.billable_kg != null ? Number(row.billable_kg) : 0;
            const netAmt = row.net_amount != null ? Number(row.net_amount) : 0;
            const selected = selectedId === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id ?? null)}
                className={`w-full text-left rounded-xl border p-3 transition text-sm flex flex-col gap-2 ${
                  selected
                    ? "border-violet-500 bg-violet-50/20 dark:bg-violet-950/20 ring-1 ring-violet-500/30 shadow-md shadow-violet-500/5"
                    : "border-zinc-150 dark:border-zinc-800/80 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 bg-white dark:bg-zinc-950"
                }`}
              >
                <div className="flex items-start justify-between gap-3 w-full">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className={`text-xs font-bold truncate font-mono ${selected ? "text-violet-600 dark:text-violet-400" : "text-foreground"}`}>
                      {txNo}
                    </div>
                    <div className="text-[11px] text-zinc-900 dark:text-zinc-100 font-bold truncate">
                      {customer}
                    </div>
                    {/* <div className="text-[11px] text-muted-foreground truncate">
                      {site}
                    </div> */}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {STATUS_BADGE[row.status] ?? <Badge variant="outline">{row.status}</Badge>}
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-dashed border-zinc-150 dark:border-zinc-800/50 pt-2 w-full text-[10px] text-zinc-400 dark:text-zinc-500">
                  <span>{date}</span>
                  <div className="flex items-center gap-1.5">
                    {SOURCE_BADGE[row.billable_source]}
                    <span className="font-mono font-bold text-foreground bg-zinc-50 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-[10px]">
                      {billableKg.toFixed(2)} kg (₱{netAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {total > limit && (
        <div className="px-4 py-3 border-t border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 flex justify-between items-center text-[11px] text-zinc-500">
          <span>
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
              className="h-7 px-2.5 text-[10px]"
            >
              Prev
            </Button>
            <Button
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
