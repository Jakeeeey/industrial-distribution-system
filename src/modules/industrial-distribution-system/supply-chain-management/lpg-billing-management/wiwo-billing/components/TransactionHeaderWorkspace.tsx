"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { CustomerSite, LpgTransactionHeader } from "../types";

interface Props {
  selectedHeader: LpgTransactionHeader | null;
  onSelect: (header: LpgTransactionHeader) => void;
}

export function TransactionHeaderWorkspace({ selectedHeader, onSelect }: Props) {
  const [headers, setHeaders] = useState<LpgTransactionHeader[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [customers, setCustomers] = useState<{ customer_code: string; customer_name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [remarks, setRemarks] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [headersRes, sitesRes, customersRes] = await Promise.all([
        fetch("/api/ids/scm/lpg-billing-management/wiwo-billing?type=headers"),
        fetch("/api/ids/scm/lpg-billing-management/wiwo-billing?type=sites"),
        fetch("/api/ids/scm/lpg-billing-management/wiwo-billing?type=customers"),
      ]);
      const [headersJson, sitesJson, customersJson] = await Promise.all([headersRes.json(), sitesRes.json(), customersRes.json()]);
      setHeaders(headersJson.data ?? []);
      setSites(sitesJson.data ?? []);
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

  const createHeader = async () => {
    const selectedSite = sites.find((site) => site.id === Number(siteId));
    if (!selectedSite || !periodFrom || !periodTo) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ids/scm/lpg-billing-management/wiwo-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_HEADER",
          customer_code: selectedSite.customer_code,
          lpg_site_id: selectedSite.id,
          period_from: periodFrom,
          period_to: periodTo,
          remarks,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to create header.");
      setHeaders((prev) => [json.data, ...prev]);
      onSelect(json.data);
      setOpen(false);
      setSiteId("");
      setPeriodFrom("");
      setPeriodTo("");
      setRemarks("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create header.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <aside className="w-full lg:w-96 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col min-h-0">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
          <Button onClick={() => setOpen(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4" />
            New Transaction Header
          </Button>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search headers..." className="pl-9" />
            </div>
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.map((header) => (
            <button
              type="button"
              key={header.header_id}
              onClick={() => onSelect(header)}
              className={`w-full text-left rounded-xl border p-3 transition-colors ${
                selectedHeader?.header_id === header.header_id
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                  : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              <div className="flex justify-between gap-2">
                <span className="font-mono text-xs font-bold">{header.header_no || `Header #${header.header_id}`}</span>
                <span className="text-[9px] font-bold">{header.status}</span>
              </div>
              <p className="text-xs mt-1">{header.site?.site_name || `Site #${header.customer_site_id}`}</p>
              <p className="text-[10px] text-muted-foreground">{customers.find(c => c.customer_code === header.customer_id)?.customer_name || header.customer_name || header.customer_id}</p>
              <p className="text-[10px] text-muted-foreground mt-2">
                {header.period_from} to {header.period_to}
              </p>
            </button>
          ))}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-10">No transaction headers found.</p>
          )}
        </div>
      </aside>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-emerald-600" />
            Create Transaction Header
          </DialogTitle>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Site</Label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Select a site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.site_name || `Site #${site.id}`} | {site.customer_code}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Period From</Label>
                <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Period To</Label>
                <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => void createHeader()}
                disabled={loading || !siteId || !periodFrom || !periodTo || periodFrom > periodTo}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Header
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
