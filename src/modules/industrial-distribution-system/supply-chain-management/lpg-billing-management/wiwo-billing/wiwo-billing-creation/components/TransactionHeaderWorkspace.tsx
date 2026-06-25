/**
 * TransactionHeaderWorkspace.tsx
 *
 * AG-CHANGE: Full UI overhaul to match CreateBillingWorkspace stepper theme.
 *   - Premium gradient header with step pill branding
 *   - Date range filter (period_from / period_to overlap check)
 *   - Upgraded header cards with richer status badges, site + customer info
 *   - Empty state illustration
 *   - Create Header modal aligned with the same design language
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
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { CustomerSite, LpgTransactionHeader } from "../types";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";

// AG-CHANGE: Removed unused formatDate to resolve ESLint typescript-eslint/no-unused-vars warning.

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

export function TransactionHeaderWorkspace({ selectedHeader, onSelect }: Props) {
  // ─── State ────────────────────────────────────────────────────────────────
  const [headers, setHeaders] = useState<LpgTransactionHeader[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [customers, setCustomers] = useState<{ customer_code: string; customer_name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"ALL" | "BOTH" | "KILO">("ALL");

  // Date range filter
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<"period_from" | "site" | "customer" | "status" | "billing_mode">("period_from");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Reset pagination on filter or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterFrom, filterTo, activeTab, sortField, sortDir]);

  // Create form
  const [siteId, setSiteId] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setSiteSearch("");
    }
  }, [open]);

  // ─── Load data ────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const [headersRes, sitesRes, customersRes] = await Promise.all([
        fetch("/api/ids/scm/lpg-billing-management/wiwo-billing?type=headers"),
        fetch("/api/ids/scm/lpg-billing-management/wiwo-billing?type=sites"),
        fetch("/api/ids/scm/lpg-billing-management/wiwo-billing?type=customers"),
      ]);
      const [headersJson, sitesJson, customersJson] = await Promise.all([
        headersRes.json(),
        sitesRes.json(),
        customersRes.json(),
      ]);
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

  // ─── Filtering ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = headers;

    // Billing Mode Tab Filter
    if (activeTab !== "ALL") {
      result = result.filter((h) => {
        const mode = h.site?.billing_mode || "KILO";
        return mode === activeTab;
      });
    }

    // Text search
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((h) =>
        [h.header_no, h.customer_id, h.site?.site_name, h.period_from, h.period_to].some(
          (v) => String(v ?? "").toLowerCase().includes(query)
        )
      );
    }

    // Date range filter — keep headers whose period overlaps the filter range
    if (filterFrom) {
      result = result.filter((h) => !h.period_to || h.period_to >= filterFrom);
    }
    if (filterTo) {
      result = result.filter((h) => !h.period_from || h.period_from <= filterTo);
    }

    return result;
  }, [headers, search, filterFrom, filterTo, activeTab]);

  // ─── Sorting ──────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortField === "period_from") {
        return dir * ((a.period_from ?? "").localeCompare(b.period_from ?? ""));
      }
      if (sortField === "site") {
        return dir * ((a.site?.site_name ?? "").localeCompare(b.site?.site_name ?? ""));
      }
      if (sortField === "customer") {
        const aN = customers.find(c => c.customer_code === a.customer_id)?.customer_name ?? a.customer_id ?? "";
        const bN = customers.find(c => c.customer_code === b.customer_id)?.customer_name ?? b.customer_id ?? "";
        return dir * aN.localeCompare(bN);
      }
      if (sortField === "status") {
        return dir * ((a.status ?? "").localeCompare(b.status ?? ""));
      }
      if (sortField === "billing_mode") {
        return dir * ((a.site?.billing_mode ?? "").localeCompare(b.site?.billing_mode ?? ""));
      }
      return 0;
    });
  }, [filtered, sortField, sortDir, customers]);

  // Paginated data
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  const paginatedHeaders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sorted.slice(startIndex, startIndex + pageSize);
  }, [sorted, currentPage, pageSize]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-70 transition-opacity" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />;
  };

  const hasActiveFilters = !!filterFrom || !!filterTo;

  const clearFilters = () => {
    setFilterFrom("");
    setFilterTo("");
  };

  // ─── Create Header ────────────────────────────────────────────────────────
  const createHeader = async () => {
    const selectedSite = sites.find((s) => s.id === Number(siteId));
    if (!selectedSite || !periodFrom || !periodTo) return;

    setCreating(true);
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
      setSiteSearch("");
      setPeriodFrom("");
      setPeriodTo("");
      setRemarks("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create header.");
    } finally {
      setCreating(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full max-w-4xl mx-auto flex flex-col bg-card/80 backdrop-blur-md rounded-3xl shadow-md border border-border overflow-hidden h-[calc(100dvh-160px)] min-h-[380px] sm:h-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-transparent shrink-0">
          <div className="flex items-center justify-between gap-3">
            {/* Title */}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                WIWO Billing
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
              {/* Refresh — icon-only */}
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                title="Refresh"
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
              </button>

              {/* New Header — icon+text on sm+, icon-only on xs */}
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
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all duration-200 ${
                showFilters || hasActiveFilters
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

          {/* Billing Mode Segmented Tabs */}
          <div className="flex p-1 bg-muted/60 dark:bg-zinc-800/40 rounded-xl border border-border/80 max-w-md w-full">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                activeTab === "ALL"
                  ? "bg-card text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Sites
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("BOTH")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                activeTab === "BOTH"
                  ? "bg-card text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Metered-WIWO
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("KILO")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                activeTab === "KILO"
                  ? "bg-card text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Kilo Only (KILO)
            </button>
          </div>

          {/* Date Range Filters (collapsible) */}
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

        {/* ── Table List ─────────────────────────────────────────────────── */}
        {/* AG-CHANGE: Revamped from card grid to sticky-header table for better data density and scan speed */}
        <div className="flex-1 sm:flex-initial overflow-auto custom-scrollbar sm:max-h-[500px]" style={{ minHeight: 250 }}>
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
            <table className="w-full border-collapse text-sm">
              {/* Sticky column headers */}
              <thead className="sticky top-0 z-10 bg-card border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("period_from")}
                      className="group inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Period
                      <SortIcon field="period_from" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("site")}
                      className="group inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Site
                      <SortIcon field="site" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-2.5 hidden md:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort("customer")}
                      className="group inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Customer
                      <SortIcon field="customer" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-2.5 hidden sm:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort("billing_mode")}
                      className="group inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Mode
                      <SortIcon field="billing_mode" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="group inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Status
                      <SortIcon field="status" />
                    </button>
                  </th>
                  {/* Header No — not sortable, just for reference */}
                  <th className="text-left px-4 py-2.5 hidden lg:table-cell">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Header #</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paginatedHeaders.map((header) => {
                  const customerName =
                    customers.find((c) => c.customer_code === header.customer_id)?.customer_name ||
                    header.customer_name ||
                    header.customer_id;
                  const isSelected = selectedHeader?.header_id === header.header_id;
                  const billingMode = header.site?.billing_mode;

                  return (
                    <tr
                      key={header.header_id}
                      onClick={() => onSelect(header)}
                      className={`group cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? "bg-primary/8 border-l-2 border-l-primary"
                          : "hover:bg-accent/50 border-l-2 border-l-transparent"
                      }`}
                    >
                      {/* Period */}
                      <td className="px-4 py-3 whitespace-nowrap min-w-[240px]">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? "bg-primary/10 border-primary/20 text-primary"
                            : "bg-muted/40 border-border/40 text-foreground"
                        }`}>
                          <CalendarRange className={`h-3.5 w-3.5 shrink-0 ${ isSelected ? "text-primary" : "text-muted-foreground" }`} />
                          <span>{formatDateShort(header.period_from)}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-0.5">to</span>
                          <span>{formatDateShort(header.period_to)}</span>
                        </div>
                      </td>

                      {/* Site */}
                      <td className="px-4 py-3 whitespace-nowrap min-w-[150px]">
                        <p className={`text-xs font-bold leading-tight truncate max-w-[150px] ${ isSelected ? "text-primary" : "text-foreground" }`}>
                          {header.site?.site_name || `Site #${header.customer_site_id}`}
                        </p>
                      </td>

                      {/* Customer (hidden on mobile) */}
                      <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap min-w-[150px]">
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{customerName}</p>
                      </td>

                      {/* Billing Mode (hidden on mobile) */}
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap min-w-[120px]">
                        {billingMode ? (
                          <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap border shrink-0 ${
                            billingMode === "KILO"
                              ? "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200/50 dark:border-cyan-800/30 text-cyan-700 dark:text-cyan-400"
                              : "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200/50 dark:border-indigo-800/30 text-indigo-700 dark:text-indigo-400"
                          }`}>
                            {billingMode === "BOTH" ? "Metered-WIWO" : billingMode}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap min-w-[100px]">
                        <StatusBadge status={header.status} />
                      </td>

                      {/* Header No (hidden on sm and below) */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="font-mono text-[10px] text-muted-foreground">
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

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {totalItems > 0 && (
          <div className="px-4 py-3 sm:px-6 border-t border-border bg-muted/20 dark:bg-zinc-900/10 flex flex-col xs:flex-row items-center justify-between gap-3 shrink-0">
            {/* Info */}
            <div className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{Math.min(totalItems, (currentPage - 1) * pageSize + 1)}</span> to{" "}
              <span className="font-semibold text-foreground">{Math.min(totalItems, currentPage * pageSize)}</span> of{" "}
              <span className="font-semibold text-foreground">{totalItems}</span> headers
            </div>

            <div className="flex items-center gap-4">
              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
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
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="h-8 w-8 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted-foreground transition-all duration-150"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                {/* Compact Page indicators */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, idx, arr) => {
                      const isAct = p === currentPage;
                      const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;

                      return (
                        <div key={p} className="flex items-center">
                          {showEllipsis && <span className="px-1 text-xs text-muted-foreground">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(p)}
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
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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

      {/* ── Create Header Dialog ───────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        {/* AG-CHANGE: Full-width on mobile (mx-2), max-w-lg on sm+ */}
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg p-0 overflow-hidden rounded-2xl sm:rounded-3xl">
          {/* Dialog header with gradient */}
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

          <div className="p-6 space-y-5">
            {/* Site select — AG-CHANGE: converted to a searchable Combobox */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Customer Site *
              </label>
              <Combobox
                value={sites.find(s => s.id === Number(siteId)) || null}
                onValueChange={(val: CustomerSite | null) => {
                  setSiteId(val ? String(val.id) : "");
                  if (val) {
                    const custName = customers.find(c => c.customer_code === val.customer_code)?.customer_name || val.customer_code;
                    setSiteSearch(val.site_name ? `${val.site_name} (${custName})` : `Site #${val.id} (${custName})`);
                  } else {
                    setSiteSearch("");
                  }
                }}
              >
                <ComboboxInput
                  placeholder={sites.length === 0 ? "Loading sites..." : "Select LPG Site..."}
                  value={siteSearch}
                  onChange={(e) => setSiteSearch(e.target.value)}
                  showTrigger
                />
                <ComboboxContent>
                  <ComboboxList>
                    {sites.length === 0 && <ComboboxEmpty>No sites.</ComboboxEmpty>}
                    {sites
                      .filter((s) => {
                        const custName = customers.find(c => c.customer_code === s.customer_code)?.customer_name || s.customer_code;
                        return (
                          (s.site_name || "").toLowerCase().includes(siteSearch.toLowerCase()) ||
                          s.customer_code.toLowerCase().includes(siteSearch.toLowerCase()) ||
                          custName.toLowerCase().includes(siteSearch.toLowerCase())
                        );
                      })
                      .map((s) => {
                        const custName = customers.find(c => c.customer_code === s.customer_code)?.customer_name || s.customer_code;
                        return (
                          <ComboboxItem key={String(s.id)} value={s}>
                            {s.site_name ? `${s.site_name} (${custName})` : `Site #${s.id} (${custName})`}
                          </ComboboxItem>
                        );
                      })}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
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
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createHeader()}
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
