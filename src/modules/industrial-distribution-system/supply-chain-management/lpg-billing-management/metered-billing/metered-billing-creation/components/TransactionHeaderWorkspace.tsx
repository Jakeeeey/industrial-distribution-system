/**
 * TransactionHeaderWorkspace.tsx
 *
 * AG-CHANGE: Full UI overhaul to match CreateBillingWorkspace stepper theme.
 *   - Premium gradient header with step pill branding
 *   - Date range filter (period_from / period_to overlap check)
 *   - Upgraded header cards with richer status badges, site + customer info
 *   - Empty state illustration
 *   - Create Header modal aligned with the same design language
 *   - Preserves custom props (autoOpenCreate, onCloseCreate) and sonner toast error handling.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Filter,
  X,
  Building2,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { LpgTransactionHeader } from "../../metered-billing-common/types";

// AG-CHANGE: Short format for compact display "Jun 13"
const formatDateShort = (iso?: string | null) => {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

interface Props {
  selectedHeader: LpgTransactionHeader | null;
  onSelect: (header: LpgTransactionHeader) => void;
  autoOpenCreate?: boolean;
  onCloseCreate?: () => void;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
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

export function TransactionHeaderWorkspace({
  selectedHeader,
  onSelect,
  autoOpenCreate,
  onCloseCreate,
}: Props) {
  // ─── State ────────────────────────────────────────────────────────────────
  const [headers, setHeaders] = useState<LpgTransactionHeader[]>([]);
  const [customers, setCustomers] = useState<{ customer_code: string; customer_name: string }[]>([]);
  const [sites, setSites] = useState<{ id: number; site_name: string | null; customer_code: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Date range filter
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Create form
  const [siteId, setSiteId] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [creating, setCreating] = useState(false);

  // ─── Auto-open create header dialog ───────────────────────────────────────
  useEffect(() => {
    if (autoOpenCreate) {
      setOpen(true);
      onCloseCreate?.();
    }
  }, [autoOpenCreate, onCloseCreate]);

  // ─── Load data ────────────────────────────────────────────────────────────
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

  // ─── Filtering ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = headers;

    // Text search
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((h) =>
        [h.header_no, h.customer_id, h.site?.site_name, h.period_from, h.period_to].some(
          (v) => String(v ?? "").toLowerCase().includes(query)
        )
      );
    }

    // Date range filter
    if (filterFrom) {
      result = result.filter((h) => !h.period_to || h.period_to >= filterFrom);
    }
    if (filterTo) {
      result = result.filter((h) => !h.period_from || h.period_from <= filterTo);
    }

    return result;
  }, [headers, search, filterFrom, filterTo]);

  const hasActiveFilters = !!filterFrom || !!filterTo;

  const clearFilters = () => {
    setFilterFrom("");
    setFilterTo("");
  };

  // ─── Create Header ────────────────────────────────────────────────────────
  const createHeader = async () => {
    if (!siteId || !periodFrom || !periodTo) {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_HEADER",
          lpg_site_id: Number(siteId),
          period_from: periodFrom,
          period_to: periodTo,
          remarks: remarks.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to create header.");

      toast.success("Transaction header created successfully!");
      setHeaders((prev) => [json.data, ...prev]);
      onSelect(json.data);
      setOpen(false);
      setSiteId("");
      setPeriodFrom("");
      setPeriodTo("");
      setRemarks("");

      await load();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to create header.";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full max-w-4xl mx-auto flex flex-col bg-card/80 backdrop-blur-md rounded-3xl shadow-md border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-transparent shrink-0">
          <div className="flex items-center justify-between gap-3">
            {/* Title */}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                Metered Billing
              </p>
              <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black shadow-md shadow-primary/30 shrink-0">
                  1
                </span>
                <span className="truncate">Select Header</span>
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">
                Choose a billing period header to begin physical validation.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Refresh */}
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                title="Refresh"
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
              </button>

              {/* New Header */}
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="hidden xs:inline sm:inline">New Header</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Search + Filters ───────────────────────────────────────────── */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border space-y-2.5 shrink-0">
          <div className="flex gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search headers..."
                className="w-full h-9 pl-9 pr-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all duration-200 ${showFilters || hasActiveFilters
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
            >
              <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Filter</span>
              {hasActiveFilters && (
                <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center">
                  !
                </span>
              )}
            </button>
          </div>

          {/* Date Range Filters */}
          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-3 p-4 bg-muted/40 rounded-2xl border border-border animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Period From (≥)
                </label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Period To (≤)
                </label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
              {hasActiveFilters && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="h-9 px-3 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent border border-border transition-colors flex items-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Result count */}
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading..."
              : `${filtered.length} header${filtered.length !== 1 ? "s" : ""}${hasActiveFilters || search ? " matching filters" : ""}`}
          </p>
        </div>

        {/* ── Header Cards Grid ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 custom-scrollbar" style={{ minHeight: 300, maxHeight: 540 }}>
          {loading && headers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin" />
              <span className="text-sm animate-pulse">Loading headers...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <CalendarRange className="h-10 w-10 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-semibold">No transaction headers found</p>
                <p className="text-xs mt-0.5">
                  {hasActiveFilters || search
                    ? "Try adjusting your search or date filters."
                    : "Create a new header to get started."}
                </p>
              </div>
              {(hasActiveFilters || search) && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); clearFilters(); }}
                  className="text-xs font-bold text-primary hover:underline underline-offset-2"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {filtered.map((header) => {
                const customerName =
                  customers.find((c) => c.customer_code === header.customer_id)?.customer_name ||
                  header.customer_name ||
                  header.customer_id;
                const isSelected = selectedHeader?.header_id === header.header_id;

                return (
                  <button
                    type="button"
                    key={header.header_id}
                    onClick={() => onSelect(header)}
                    className={`group relative w-full text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 flex flex-col ${isSelected
                      ? "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10"
                      : "border-border hover:border-primary/40 hover:shadow-md"
                      }`}
                  >
                    {/* Hero: Date Range */}
                    <div className={`px-3 pt-3 pb-2.5 sm:px-4 sm:pt-4 sm:pb-3 flex flex-col gap-1 transition-colors ${isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 group-hover:bg-primary/15 text-primary"
                      }`}>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <CalendarRange className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 opacity-80" />
                          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-70">
                            Period
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center flex-nowrap gap-x-1 mt-1">
                        <span className="text-[11px] xs:text-xs sm:text-sm font-black leading-tight whitespace-nowrap">
                          {formatDateShort(header.period_from)}
                        </span>
                        <span className="text-[10px] font-bold opacity-45 shrink-0">→</span>
                        <span className="text-[11px] xs:text-xs sm:text-sm font-black leading-tight whitespace-nowrap">
                          {formatDateShort(header.period_to)}
                        </span>
                      </div>
                    </div>

                    {/* Body: Site + Status */}
                    <div className={`px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col gap-2 flex-1 transition-colors ${isSelected ? "bg-primary/10" : "bg-card group-hover:bg-accent/40"
                      }`}>
                      <div className="flex items-start gap-1.5 sm:gap-2">
                        <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 transition-colors hidden sm:flex ${isSelected
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          }`}>
                          <Building2 className="h-3 w-3" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs sm:text-sm font-bold line-clamp-1 leading-tight ${isSelected ? "text-primary" : "text-foreground"
                            }`}>
                            {header.site?.site_name || `Site #${header.customer_site_id}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {customerName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/60 gap-1">
                        <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground truncate">
                          {header.header_no || `#${header.header_id}`}
                        </span>
                        <StatusBadge status={header.status} />
                      </div>
                    </div>

                    <ChevronRight className={`absolute bottom-3.5 right-3 h-4 w-4 transition-all duration-200 ${isSelected ? "text-primary opacity-0" : "text-muted-foreground opacity-0 group-hover:opacity-60 group-hover:translate-x-0.5"
                      }`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Create Header Dialog ───────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg p-0 overflow-hidden rounded-2xl sm:rounded-3xl">
          <div className="px-6 py-5 bg-gradient-to-r from-primary/5 via-transparent to-transparent border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <span className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Plus className="h-4 w-4" />
              </span>
              New Transaction Header
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Define a billing period for a customer site.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createHeader();
            }}
            className="p-6 space-y-5"
          >
            {/* Site select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Customer Site *
              </label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                required
              >
                <option value="">Select a site...</option>
                {sites.map((site) => {
                  const custName = customers.find(c => c.customer_code === site.customer_code)?.customer_name || site.customer_code;
                  return (
                    <option key={site.id} value={site.id}>
                      {site.site_name || `Site #${site.id}`} — {custName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Period from/to */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Period From *
                </label>
                <input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Period To *
                </label>
                <input
                  type="date"
                  value={periodTo}
                  min={periodFrom || undefined}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  required
                />
              </div>
            </div>

            {/* Period validation hint */}
            {periodFrom && periodTo && periodFrom > periodTo && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Period From must be before Period To.
              </p>
            )}

            {/* Remarks */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Remarks
              </label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes about this billing period..."
                className="resize-none rounded-xl text-sm min-h-[80px]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !siteId || !periodFrom || !periodTo || periodFrom > periodTo}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-sm font-bold rounded-xl shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Header
                  </>
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
