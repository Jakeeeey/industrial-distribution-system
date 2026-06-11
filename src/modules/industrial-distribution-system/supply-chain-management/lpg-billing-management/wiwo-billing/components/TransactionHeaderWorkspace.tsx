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
      <div className="w-full max-w-4xl mx-auto flex flex-col min-h-[500px] max-h-[800px] bg-card/80 backdrop-blur-md rounded-3xl shadow-md border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-5 sm:p-6 border-b border-border space-y-4 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CalendarRange className="h-6 w-6 text-primary" />
              1. Select Transaction Header
            </h2>
            <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Transaction Header
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
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
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border hover:border-primary/50 hover:bg-accent"
              }`}
            >
              <div className="flex justify-between gap-2 w-full mb-2">
                <span className="font-mono text-sm font-bold text-foreground">{header.header_no || `Header #${header.header_id}`}</span>
                <span className="rounded-full badge-warning px-2 py-0.5 text-[10px] font-bold">
                  {header.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground line-clamp-1">{header.site?.site_name || `Site #${header.customer_site_id}`}</p>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{customers.find(c => c.customer_code === header.customer_id)?.customer_name || header.customer_name || header.customer_id}</p>
              {/* AG-UPDATE: Date highlighting for better visibility. Changed to semantic primary pill layout */}
              <div className="mt-auto pt-3 flex items-center justify-between text-xs font-bold text-primary border-t border-border mt-3">
                <span className="flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded-md">
                  <CalendarRange className="h-3.5 w-3.5" /> 
                  {header.period_from}
                </span>
                <span className="text-muted-foreground font-medium mx-2">to</span>
                <span className="bg-primary/10 px-2 py-1 rounded-md">
                  {header.period_to}
                </span>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
