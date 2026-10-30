// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/components/AccountabilityFilters.tsx
// ==============================================================================
// Parameter Filter Bar for Customer Cylinder Accountability Report
// Controls reporting period cutoff, searchable branch scoping, and debounced customer search.
//
// Complies with VoSync Design System standards:
// - Searchable shadcn-based popover for branch selection with Framer Motion
// - Ownership filter removed per user requirement
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { Search, RotateCcw, Building2, Calendar, X } from "lucide-react";
import { useCustomerCylinderAccountability } from "../hooks/useCustomerCylinderAccountability";
import { SmoothSearchableSelect } from "./SmoothSearchableSelect";

export function AccountabilityFilters() {
  const { filters, setFilters, resetFilters, lookups, isLookupsLoading } = useCustomerCylinderAccountability();

  const [localSearch, setLocalSearch] = React.useState(filters.searchQuery || "");

  // AG-COMMENT: Instantaneous in-memory search sync (filters already loaded dataset without requesting server)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ searchQuery: localSearch });
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearch, setFilters]);

  // Keep local search updated if externally reset
  React.useEffect(() => {
    setLocalSearch(filters.searchQuery || "");
  }, [filters.searchQuery]);

  // AG-COMMENT: Strictly filter dropdown options to Industrial Division branches (division_id = 1).
  const INDUSTRIAL_BRANCH_IDS = React.useMemo(() => new Set(["196", "197", "278", "279", "280"]), []);

  // Branch options for SmoothSearchableSelect
  const branchOptions = React.useMemo(() => {
    const allOpt = { value: "ALL", label: "All Active Branches" };
    const branchOpts = lookups.branches
      .filter((b: { id: number | string; division_id?: number | string | null }) => {
        if (b.division_id != null && (b.division_id as unknown) !== "") {
          return Number(b.division_id) === 1 && INDUSTRIAL_BRANCH_IDS.has(String(b.id));
        }
        return INDUSTRIAL_BRANCH_IDS.has(String(b.id));
      })
      .map((b) => ({
        value: String(b.id),
        label: b.name,
      }));
    return [allOpt, ...branchOpts];
  }, [lookups.branches, INDUSTRIAL_BRANCH_IDS]);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-2xs">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-12 md:items-end">
        {/* ── 1. Search Query ────────────────────────────────────────────── */}
        <div className="sm:col-span-2 md:col-span-5">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Search Customer
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by customer name, code, or site..."
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── 2. Period Cutoff Range (Start Date) ─────────────────────────── */}
        <div className="md:col-span-2">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Period Start</span>
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ startDate: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* ── 3. Period Cutoff Range (End Date / Cutoff) ──────────────────── */}
        <div className="md:col-span-2">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Reporting Cutoff</span>
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ endDate: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* ── 4. Searchable Branch Selector (Shadcn + Framer Motion) ──────── */}
        <div className="md:col-span-2">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span>Branch</span>
          </label>
          <SmoothSearchableSelect
            options={branchOptions}
            value={String(filters.branchId ?? "ALL")}
            onValueChange={(val) => setFilters({ branchId: val })}
            placeholder="Select Branch..."
            disabled={isLookupsLoading}
          />
        </div>

        {/* ── 5. Reset Filters Button ────────────────────────────────────── */}
        <div className="md:col-span-1 flex justify-end">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border bg-muted/40 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Reset filters to default current month-to-date"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
