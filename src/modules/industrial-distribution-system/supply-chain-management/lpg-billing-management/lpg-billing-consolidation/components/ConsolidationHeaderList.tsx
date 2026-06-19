"use client";

// ─── ConsolidationHeaderList.tsx ──────────────────────────────────────────────
// Left-panel: scrollable, filterable list of LPG billing headers.
// The reviewer selects a header to open its workspace on the right panel.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { FileText, Search, RefreshCw, CheckCircle2, Clock, XCircle, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { UseBillingConsolidationReturn } from "../hooks/useBillingConsolidation";
import type { HeaderStatus } from "../types/billing-consolidation.types";

interface ConsolidationHeaderListProps {
  hook: UseBillingConsolidationReturn;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_OPTS: { label: string; value: HeaderStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Posted", value: "POSTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function StatusBadge({ status }: { status: HeaderStatus }) {
  if (status === "POSTED") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40 text-[10px] font-semibold px-1.5 py-0">
        <CheckCircle2 className="h-2.5 w-2.5" /> Posted
      </Badge>
    );
  }
  if (status === "CANCELLED") {
    return (
      <Badge className="gap-1 bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/40 text-[10px] font-semibold px-1.5 py-0">
        <XCircle className="h-2.5 w-2.5" /> Cancelled
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40 text-[10px] font-semibold px-1.5 py-0">
      <Clock className="h-2.5 w-2.5" /> Draft
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConsolidationHeaderList({ hook }: ConsolidationHeaderListProps) {
  const {
    headers,
    totalHeaders,
    isLoadingHeaders,
    headerError,
    headerParams,
    setHeaderParams,
    loadHeaders,
    selectedHeaderId,
    selectHeader,
  } = hook;

  // Local debounced search state
  const [searchInput, setSearchInput] = useState(headerParams.search ?? "");

  // Debounce search by 400 ms
  useEffect(() => {
    const t = setTimeout(() => {
      setHeaderParams({ search: searchInput, page: 1 });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, setHeaderParams]);

  // Load on mount and when params change
  useEffect(() => {
    loadHeaders();
  }, [loadHeaders, headerParams]);

  return (
    <div className="flex flex-col h-full border-r border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950">
      {/* ── List Header ──────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800/40 shrink-0 space-y-2">
        {/* Title + Refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <ReceiptText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
              Billing Headers
            </span>
            <span className="text-[10px] text-muted-foreground ml-0.5">
              ({totalHeaders})
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => loadHeaders()}
            disabled={isLoadingHeaders}
            title="Refresh list"
          >
            <RefreshCw className={cn("h-3 w-3", isLoadingHeaders && "animate-spin")} />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <Input
            placeholder="Search header no. or customer..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-7 h-7 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1">
          {STATUS_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setHeaderParams({ status: opt.value, page: 1 })}
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors border",
                headerParams.status === opt.value
                  ? "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800/40"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── List Body ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Error State */}
        {headerError && (
          <div className="p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/10 border-b border-rose-100 dark:border-rose-900/20">
            {headerError}
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoadingHeaders && (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg bg-zinc-100 dark:bg-zinc-800/40 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoadingHeaders && headers.length === 0 && !headerError && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">No billing headers found</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Try changing the status filter or search term.
            </p>
          </div>
        )}

        {/* Header Rows */}
        {!isLoadingHeaders &&
          headers.map((header) => {
            const isSelected = selectedHeaderId === header.header_id;
            const isBilled = header.is_billed === 1;

            return (
              <button
                key={header.header_id}
                onClick={() => selectHeader(header.header_id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800/40 transition-colors group",
                  isSelected
                    ? "bg-violet-50 dark:bg-violet-900/10 border-l-2 border-l-violet-500"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30 border-l-2 border-l-transparent"
                )}
              >
                {/* Row top: Header No. + Status */}
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className={cn(
                      "text-xs font-bold truncate",
                      isSelected ? "text-violet-700 dark:text-violet-300" : "text-zinc-800 dark:text-zinc-100"
                    )}
                  >
                    {header.header_no ?? `#${header.header_id}`}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {isBilled && (
                      <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400">
                        Billed
                      </Badge>
                    )}
                    <StatusBadge status={header.status} />
                  </div>
                </div>

                {/* Customer */}
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  {header.customer_id}
                  {header.site?.site_name ? ` — ${header.site.site_name}` : ""}
                </p>

                {/* Period */}
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {header.period_from} → {header.period_to}
                </p>
              </button>
            );
          })}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {totalHeaders > (headerParams.limit ?? 15) && (
        <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800/40 flex items-center justify-between shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px]"
            disabled={(headerParams.page ?? 1) <= 1 || isLoadingHeaders}
            onClick={() => setHeaderParams({ page: (headerParams.page ?? 1) - 1 })}
          >
            ← Prev
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Page {headerParams.page ?? 1}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px]"
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
