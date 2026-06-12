"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { LpgTransactionHeader } from "../../metered-billing-common/types";

interface Props {
  selectedHeader: LpgTransactionHeader | null;
  onSelect: (header: LpgTransactionHeader) => void;
  autoOpenCreate?: boolean;
  onCloseCreate?: () => void;
}

export function TransactionHeaderWorkspace({ selectedHeader, onSelect, autoOpenCreate, onCloseCreate }: Props) {
  const [headers, setHeaders] = useState<LpgTransactionHeader[]>([]);
  const [customers, setCustomers] = useState<{ customer_code: string; customer_name: string }[]>([]);
  const [sites, setSites] = useState<{ id: number; site_name: string | null; customer_code: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Header Creation State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (autoOpenCreate) {
      setIsCreateOpen(true);
      onCloseCreate?.();
    }
  }, [autoOpenCreate, onCloseCreate]);

  const load = async () => {
    setLoading(true);
    try {
      const [headersRes, customersRes, sitesRes] = await Promise.all([
        fetch("/api/ids/scm/lpg-billing-management/metered-billing?type=headers"),
        fetch("/api/ids/scm/lpg-billing-management/metered-billing?type=customers"),
        fetch("/api/ids/scm/lpg-billing-management/metered-billing?type=sites"),
      ]);
      const [headersJson, customersJson, sitesJson] = await Promise.all([
        headersRes.json(),
        customersRes.json(),
        sitesRes.json(),
      ]);
      setHeaders(headersJson.data ?? []);
      setCustomers(customersJson.data ?? []);
      setSites(sitesJson.data ?? []);
    } catch (err) {
      console.error("Failed to load header workspace resources:", err);
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

  const handleCreateHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiteId || !periodFrom || !periodTo) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (periodFrom > periodTo) {
      toast.error("Period From must be before or equal to Period To.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/ids/scm/lpg-billing-management/metered-billing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "CREATE_HEADER",
          lpg_site_id: Number(selectedSiteId),
          period_from: periodFrom,
          period_to: periodTo,
          remarks: remarks.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create transaction header.");
      }

      toast.success("Transaction header created successfully!");
      setIsCreateOpen(false);
      setSelectedSiteId("");
      setPeriodFrom("");
      setPeriodTo("");
      setRemarks("");

      await load();

      if (json.data) {
        onSelect(json.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while creating the header.";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[500px] max-h-[800px] bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md rounded-3xl shadow-md border border-zinc-200 dark:border-zinc-800/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 space-y-4 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <CalendarRange className="h-6 w-6 text-violet-500" />
              1. Select Transaction Header
            </h2>
            <Button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all duration-200 shrink-0"
            >
              + New Transaction Header
            </Button>
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl">
          <div className="space-y-4">
            <div>
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <CalendarRange className="h-5 w-5 text-violet-500" />
                New Transaction Header
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Create an active transaction header for a customer site to begin billing.
              </p>
            </div>

            <form onSubmit={handleCreateHeader} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="site" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Select LPG Customer Site
                </Label>
                <select
                  id="site"
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                >
                  <option value="" disabled>Select a site...</option>
                  {sites.map((site) => {
                    const custName = customers.find(c => c.customer_code === site.customer_code)?.customer_name || site.customer_code;
                    return (
                      <option key={site.id} value={site.id}>
                        {site.site_name} — {custName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="periodFrom" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Period From
                  </Label>
                  <Input
                    id="periodFrom"
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="periodTo" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Period To
                  </Label>
                  <Input
                    id="periodTo"
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="remarks" className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Remarks
                </Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Billing period details or customer notes..."
                  className="min-h-[80px] rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={creating}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold"
                >
                  {creating ? "Creating..." : "Create Header"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
