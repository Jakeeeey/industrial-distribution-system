// components/RTOFilterBar.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Filter bar for the BIA RTO Operation module.
// All filters are applied client-side on already-fetched records.
// The branchId filter triggers a BFF re-fetch.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Search, RotateCcw, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRTOOperation } from "../hooks/useRTOOperation";
import type { MissingStatus, BalanceStatus } from "../types";

export function RTOFilterBar() {
  const {
    filters,
    setFilters,
    isLoading,
    search,
    setSearch,
    setPage,
    records,
    filteredRecords,
    refetch,
  } = useRTOOperation();

  // Local search state (debounced into context)
  const [localSearch, setLocalSearch] = React.useState(search);
  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(localSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, setSearch, setPage]);

  const isFiltered =
    !!localSearch.trim() ||
    (!!filters.missingStatus && filters.missingStatus !== "all") ||
    (!!filters.balanceStatus && filters.balanceStatus !== "all");

  const handleReset = () => {
    setLocalSearch("");
    setSearch("");
    setFilters({});
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-3 p-3.5 border-b border-border/50 lg:flex-row lg:items-center lg:justify-between bg-muted/5">
      {/* Left: search + dropdowns */}
      <div className="flex flex-col gap-2 w-full lg:flex-row lg:items-center lg:w-auto">
        {/* Search */}
        <div className="relative w-full lg:w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            id="rto-search"
            placeholder="Search dealer, agent…"
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
            }}
            className="pl-8 h-8 text-xs rounded-lg w-full bg-background"
          />
        </div>

        {/* Filters and Reset button side-by-side or wrapped */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="flex-1 sm:flex-initial sm:w-[145px]">
            <Select
              value={filters.missingStatus ?? "all"}
              onValueChange={(v) => {
                setFilters((f) => ({
                  ...f,
                  missingStatus: v === "all" ? undefined : (v as MissingStatus),
                }));
                setPage(1);
              }}
            >
              <SelectTrigger
                id="rto-missing-status-filter"
                className="h-8 text-xs rounded-lg w-full font-medium bg-background"
              >
                <SelectValue placeholder="Missing Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-medium">All Missing Status</SelectItem>
                <SelectItem value="normal" className="text-xs font-medium">Normal (≤ 50)</SelectItem>
                <SelectItem value="warning" className="text-xs font-medium">Warning (51–100)</SelectItem>
                <SelectItem value="critical" className="text-xs font-medium">Critical (&gt; 100)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 sm:flex-initial sm:w-[140px]">
            <Select
              value={filters.balanceStatus ?? "all"}
              onValueChange={(v) => {
                setFilters((f) => ({
                  ...f,
                  balanceStatus: v === "all" ? undefined : (v as BalanceStatus),
                }));
                setPage(1);
              }}
            >
              <SelectTrigger
                id="rto-balance-status-filter"
                className="h-8 text-xs rounded-lg w-full font-medium bg-background"
              >
                <SelectValue placeholder="Balance Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-medium">All Balances</SelectItem>
                <SelectItem value="paid" className="text-xs font-medium">Paid</SelectItem>
                <SelectItem value="low" className="text-xs font-medium">Low Balance</SelectItem>
                <SelectItem value="high" className="text-xs font-medium">High Balance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isFiltered && (
            <Button
              id="rto-filter-reset"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Right: count + refresh */}
      <div className="flex items-center justify-between sm:justify-end gap-3 w-full lg:w-auto shrink-0 border-t border-border/20 pt-2 lg:border-t-0 lg:pt-0">
        <span className="text-xs text-muted-foreground font-medium">
          {filteredRecords.length.toLocaleString()} of {records.length.toLocaleString()} dealer
          {records.length !== 1 ? "s" : ""}
        </span>
        <Button
          id="rto-refresh"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="h-8 gap-1.5 text-xs rounded-lg bg-background"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>
    </div>
  );
}
