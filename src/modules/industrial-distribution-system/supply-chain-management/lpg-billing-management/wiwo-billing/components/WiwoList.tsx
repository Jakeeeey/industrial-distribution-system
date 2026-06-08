"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Calendar, RefreshCw } from "lucide-react";
import type { MeteredWiwoTransaction } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface WiwoListProps {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onNew: () => void;
}

export function WiwoList({ selectedId, onSelect, onNew }: WiwoListProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [transactions, setTransactions] = useState<MeteredWiwoTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchList = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          search,
          status,
          page: String(page),
          limit: "10",
        });
        const res = await fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing?${queryParams}`);
        const data = await res.json();
        setTransactions(data.data || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error("Failed to load transactions", err);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [search, status, page]);

  return (
    <div className="w-full lg:w-[380px] shrink-0 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/20">
      {/* List Header Actions */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/85 space-y-3 shrink-0">
        <Button
          onClick={onNew}
          className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-medium text-sm py-2 px-4 rounded-xl shadow-md"
        >
          <Plus className="h-4 w-4" />
          New Transaction
        </Button>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by ID or customer..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 text-xs"
          />
        </div>

        {/* Status Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {[
            { value: "", label: "All" },
            { value: "DRAFT", label: "Draft" },
            { value: "POSTED", label: "Posted" },
            { value: "CANCELLED", label: "Cancelled" },
          ].map((s) => (
            <Button
              key={s.value}
              variant={status === s.value ? "default" : "secondary"}
              size="xs"
              onClick={() => {
                setStatus(s.value);
                setPage(1);
              }}
              className="text-[10px] uppercase font-bold tracking-wider rounded-full px-3 py-1"
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Transactions List container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-xs">Loading logs...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">
            No transactions found.
          </div>
        ) : (
          transactions.map((tx) => {
            const isSelected = selectedId === tx.id;
            return (
              <div
                key={tx.id}
                onClick={() => onSelect(tx.id)}
                className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col gap-2 ${
                  isSelected
                    ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/80 shadow-md"
                    : "bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800/80"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="font-bold text-xs dark:text-zinc-100 text-zinc-800 truncate max-w-[170px]">
                    {tx.transaction_no}
                  </div>
                  <Badge
                    variant={
                      tx.status === "POSTED"
                        ? "default"
                        : tx.status === "CANCELLED"
                        ? "destructive"
                        : "secondary"
                    }
                    className={`text-[9px] font-extrabold px-2 py-0.5 uppercase tracking-wider ${
                      tx.status === "POSTED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : ""
                    }`}
                  >
                    {tx.status}
                  </Badge>
                </div>

                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                  {tx.customer?.customer_name || tx.customer_code}
                  {tx.site?.site_name && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                      Site: {tx.site.site_name}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800/60 pt-2 mt-1">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {tx.transaction_date}
                  </div>
                  <div className="font-bold text-zinc-700 dark:text-zinc-300">
                    {tx.billable_kg} KG
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] mt-0.5">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded font-semibold text-zinc-500">
                    {tx.transaction_type?.replace("_", " ")}
                  </Badge>
                  {tx.billable_source !== "NONE" && (
                    <span className="text-zinc-400">
                      Source: <strong className="text-zinc-600 dark:text-zinc-300">{tx.billable_source}</strong>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {total > 10 && (
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs shrink-0">
          <Button
            variant="outline"
            size="xs"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <span className="text-muted-foreground font-medium">
            Page {page} of {Math.ceil(total / 10)}
          </span>
          <Button
            variant="outline"
            size="xs"
            disabled={page * 10 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
