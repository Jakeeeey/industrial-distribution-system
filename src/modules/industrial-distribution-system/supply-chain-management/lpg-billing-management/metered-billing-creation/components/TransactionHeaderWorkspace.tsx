"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LpgTransactionHeader } from "../../metered-billing-common/types";

interface Props {
  selectedHeader: LpgTransactionHeader | null;
  onSelect: (header: LpgTransactionHeader) => void;
}

export function TransactionHeaderWorkspace({ selectedHeader, onSelect }: Props) {
  const [headers, setHeaders] = useState<LpgTransactionHeader[]>([]);
  const [customers, setCustomers] = useState<{ customer_code: string; customer_name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [headersRes, customersRes] = await Promise.all([
        fetch("/api/ids/scm/lpg-billing-management/metered-billing?type=headers"),
        fetch("/api/ids/scm/lpg-billing-management/metered-billing?type=customers"),
      ]);
      const [headersJson, customersJson] = await Promise.all([headersRes.json(), customersRes.json()]);
      setHeaders(headersJson.data ?? []);
      setCustomers(customersJson.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return headers;
    return headers.filter((header) =>
      [
        header.header_no,
        header.customer_id,
        header.site?.site_name,
        header.period_from,
        header.period_to,
      ].some((value) => String(value ?? "").toLowerCase().includes(query))
    );
  }, [headers, search]);


  return (
    <>
      <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[500px] max-h-[800px] bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md rounded-3xl shadow-md border border-zinc-200 dark:border-zinc-800/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 space-y-4 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <CalendarRange className="h-6 w-6 text-violet-500" />
              1. Select Transaction Header
            </h2>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search headers by site, customer, period..." className="pl-9" />
            </div>
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start custom-scrollbar">
          {filtered.map((header) => (
            <button
              type="button"
              key={header.header_id}
              onClick={() => onSelect(header)}
              className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 group flex flex-col ${
                selectedHeader?.header_id === header.header_id
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-500"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <div className="flex justify-between gap-2 w-full mb-2">
                <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{header.header_no || `Header #${header.header_id}`}</span>
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                  {header.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-1">{header.site?.site_name || `Unknown Site`}</p>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{customers.find(c => c.customer_code === header.customer_id)?.customer_name || header.customer_name || header.customer_id}</p>
              <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-zinc-100 dark:border-zinc-800 mt-3">
                <span className="flex items-center gap-1"><CalendarRange className="h-3 w-3" /> {header.period_from}</span>
                <span>to {header.period_to}</span>
              </div>
            </button>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground">
               <CalendarRange className="h-10 w-10 mb-3 opacity-20" />
               <p className="text-sm">No transaction headers found.</p>
            </div>
          )}
        </div>
      </div>

    </>
  );
}
