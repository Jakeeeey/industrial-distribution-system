"use client";

// ─── ConsolidationHeaderWorkspace.tsx ───────────────────────────────────────
// Full-page, grid-based card workspace for selecting a billing consolidation header (Step 1).
// Modeled after the premium stepper designs in the wiwo-billing module.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import {
  CalendarRange,
  Loader2,
  RefreshCw,
  Search,
  Building2,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { UseBillingConsolidationReturn } from "../hooks/useBillingConsolidation";
import type { HeaderStatus } from "../types/billing-consolidation.types";

interface ConsolidationHeaderWorkspaceProps {
  hook: UseBillingConsolidationReturn;
  onSelect: (headerId: number) => void;
}

const STATUS_OPTS: { label: string; value: HeaderStatus | "ALL" }[] = [
  { label: "All Headers", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Posted", value: "POSTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function StatusBadge({ status }: { status: HeaderStatus }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    DRAFT: {
      icon: <Clock className="h-2.5 w-2.5" />,
      cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
    },
    POSTED: {
      icon: <CheckCircle2 className="h-2.5 w-2.5" />,
      cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
    },
    CANCELLED: {
      icon: <AlertCircle className="h-2.5 w-2.5" />,
      cls: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40",
    },
  };
  const cfg = map[status] ?? {
    icon: null,
    cls: "bg-muted text-muted-foreground border-transparent",
  };
  return (
    <Badge className={cn("gap-1 text-[10px] font-semibold px-1.5 py-0 border", cfg.cls)}>
      {cfg.icon}
      {status}
    </Badge>
  );
}

const formatDateShort = (iso?: string | null) => {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function ConsolidationHeaderWorkspace({ hook, onSelect }: ConsolidationHeaderWorkspaceProps) {
  const {
    headers,
    totalHeaders,
    isLoadingHeaders,
    headerError,
    headerParams,
    setHeaderParams,
    loadHeaders,
    selectedHeaderId,
  } = hook;

  // Local search input
  const [searchInput, setSearchInput] = useState(headerParams.search ?? "");

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setHeaderParams({ search: searchInput, page: 1 });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, setHeaderParams]);

  // Load headers on parameters change
  useEffect(() => {
    loadHeaders();
  }, [loadHeaders, headerParams]);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col bg-card/80 backdrop-blur-md rounded-3xl shadow-md border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 my-4">
      {/* ── Header ── */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-transparent shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">
              LPG Billing Consolidation
            </p>
            <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-black border border-primary/20 dark:bg-primary/20 dark:text-primary-foreground/90 dark:border-primary/30 shrink-0">
                1
              </span>
              <span className="truncate">Select Billing Header</span>
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">
              Choose a consolidated billing period header to review and approve transactions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadHeaders()}
            disabled={isLoadingHeaders}
            title="Refresh headers list"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-border bg-card hover:bg-accent flex items-center justify-center transition-colors shrink-0"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground", isLoadingHeaders && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ── Search & Filters ── */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border space-y-2.5 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search headers, customer codes or site names..."
              className="w-full h-9 pl-9 bg-background text-sm"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {STATUS_OPTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHeaderParams({ status: opt.value, page: 1 })}
                className={cn(
                  "text-xs font-bold px-3 py-1.5 rounded-xl border transition-all duration-250 whitespace-nowrap",
                  headerParams.status === opt.value
                    ? "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground/90 dark:border-primary/30 shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Count Indicator */}
        <p className="text-xs text-muted-foreground">
          {isLoadingHeaders
            ? "Loading billing headers..."
            : `${totalHeaders} header${totalHeaders !== 1 ? "s" : ""} found`}
        </p>
      </div>

      {/* ── Header Cards Grid ── */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 min-h-[300px] max-h-[500px] custom-scrollbar bg-background">
        {headerError && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-rose-500 border border-dashed border-rose-200 rounded-2xl bg-rose-50/50 dark:bg-rose-950/15">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm font-bold">Failed to load headers</p>
            <p className="text-xs text-muted-foreground mt-1">{headerError}</p>
          </div>
        )}

        {isLoadingHeaders && headers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <span className="text-sm font-medium animate-pulse">Fetching records...</span>
          </div>
        ) : !isLoadingHeaders && headers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground text-center">
            <ReceiptText className="h-10 w-10 opacity-20 text-primary" />
            <div>
              <p className="text-sm font-semibold">No billing headers found</p>
              <p className="text-xs mt-0.5">Try adjusting your search criteria or filter options.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {headers.map((header) => {
              const isSelected = selectedHeaderId === header.header_id;
              const isBilled = header.is_billed === 1;

              return (
                <button
                  type="button"
                  key={header.header_id}
                  onClick={() => onSelect(header.header_id)}
                  className={cn(
                    "group relative w-full text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 flex flex-col bg-card hover:shadow-md",
                    isSelected
                      ? "border-primary/50 bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/30 shadow-md shadow-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  {/* Hero Date Range */}
                  <div
                    className={cn(
                      "px-4 pt-4 pb-3 flex flex-col gap-1 transition-colors border-b border-border/50",
                      isSelected
                        ? "bg-primary/10 text-primary dark:text-primary-foreground/90"
                        : "bg-primary/5 group-hover:bg-primary/10 text-primary"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <CalendarRange className="h-3.5 w-3.5 shrink-0 opacity-85" />
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-85">
                          Billing Period
                        </span>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    </div>

                    <div className="flex items-center flex-nowrap gap-x-1.5 mt-1">
                      <span className="text-xs sm:text-sm font-black leading-tight whitespace-nowrap">
                        {formatDateShort(header.period_from)}
                      </span>
                      <span className="text-xs font-bold opacity-50 shrink-0">→</span>
                      <span className="text-xs sm:text-sm font-black leading-tight whitespace-nowrap">
                        {formatDateShort(header.period_to)}
                      </span>
                    </div>
                  </div>

                  {/* Body Site & Status */}
                  <div className="px-4 py-3.5 flex flex-col gap-2.5 flex-1 bg-card">
                    <div className="flex items-start gap-2">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-black line-clamp-1 leading-tight text-foreground">
                          {header.site?.site_name || `Site #${header.customer_site_id}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 font-bold">
                          {header.customer_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-border/60 gap-1.5 mt-auto">
                      <span className="font-mono text-[10px] text-muted-foreground truncate">
                        {header.header_no || `#${header.header_id}`}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isBilled && (
                          <Badge className="text-[9px] px-1.5 py-0 bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400">
                            Billed
                          </Badge>
                        )}
                        <StatusBadge status={header.status} />
                      </div>
                    </div>
                  </div>

                  {/* Arrow Indicator on Hover */}
                  {!isSelected && (
                    <ChevronRight className="absolute bottom-3.5 right-3 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-75 group-hover:translate-x-0.5 transition-all duration-200" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalHeaders > (headerParams.limit ?? 15) && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-900/20">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            disabled={(headerParams.page ?? 1) <= 1 || isLoadingHeaders}
            onClick={() => setHeaderParams({ page: (headerParams.page ?? 1) - 1 })}
          >
            ← Previous
          </Button>
          <span className="text-xs text-muted-foreground font-bold">
            Page {headerParams.page ?? 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            disabled={
              (headerParams.page ?? 1) * (headerParams.limit ?? 15) >= totalHeaders ||
              isLoadingHeaders
            }
            onClick={() => setHeaderParams({ page: (headerParams.page ?? 1) + 1 })}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
