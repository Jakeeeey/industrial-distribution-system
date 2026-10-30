// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationFilters.tsx
// ==============================================================================
// Parameter Filter Bar for the Cylinder Utilization Report (spec §2, §5).
//
// Controls the reporting period, the cutoff the fleet is measured against, branch
// scoping and the cylinder size. The search box narrows the grid that is already
// in memory, so typing never triggers a Directus round-trip.
//
// Complies with VoSync Design System standards:
// - Searchable shadcn popover with Framer Motion for branch / size scoping
// - Debounced local search synced back to the provider
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { Building2, Calendar, Layers, RotateCcw, Search, X } from "lucide-react";
import { useCylinderUtilizationReport } from "../hooks/useCylinderUtilizationReport";
import { SmoothSearchableSelect } from "./SmoothSearchableSelect";

export function UtilizationFilters() {
  const { filters, setFilters, resetFilters, lookups, isLookupsLoading, search, setSearch } =
    useCylinderUtilizationReport();

  // Local echo of the in-memory search term, debounced into the provider.
  const [localSearch, setLocalSearch] = React.useState(search);

  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(localSearch), 280);
    return () => clearTimeout(timer);
  }, [localSearch, setSearch]);

  // Keeps the box in sync when filters are reset from anywhere else in the module.
  React.useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const branchOptions = React.useMemo(
    () => [
      { value: "ALL", label: "All Active Branches" },
      ...lookups.branches.map((branch) => ({ value: String(branch.id), label: branch.name })),
    ],
    [lookups.branches]
  );

  const sizeOptions = React.useMemo(
    () => [
      { value: "", label: "All Cylinder Sizes" },
      ...lookups.sizes.map((size) => ({ value: String(size.id), label: size.label })),
    ],
    [lookups.sizes]
  );

  return (
    <div className="rounded-xl border bg-card p-4 shadow-2xs">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-12 md:items-end">
        {/* ── 1. Grid Search (in-memory) ───────────────────────────────── */}
        <div className="sm:col-span-2 md:col-span-4">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Search Branch or Size
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filters the loaded grid only..."
              className="w-full rounded-lg border bg-background py-2 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── 2. Period Start ──────────────────────────────────────────── */}
        <div className="md:col-span-2">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Period Start</span>
          </label>
          {/* Honest affordance: with no asset history in the schema only the cutoff
              moves the figures, so the opening day is recorded, not applied. */}
          <input
            type="date"
            title="Recorded as the reporting period opening for audit context. Fleet composition is read live, so only the reporting cutoff changes the figures."
            value={filters.startDate}
            onChange={(e) => setFilters({ startDate: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* ── 3. Reporting Cutoff ──────────────────────────────────────── */}
        <div className="md:col-span-2">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Reporting Cutoff</span>
          </label>
          <input
            type="date"
            title="The date every asset's dormancy is measured against. Must not be in the future; a future cutoff is clamped to today."
            value={filters.endDate}
            onChange={(e) => setFilters({ endDate: e.target.value })}
            className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* ── 4. Branch Scope ──────────────────────────────────────────── */}
        <div className="md:col-span-2">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span>Branch</span>
          </label>
          <SmoothSearchableSelect
            options={branchOptions}
            value={filters.branchId === undefined || filters.branchId === "" ? "ALL" : String(filters.branchId)}
            onValueChange={(val) => setFilters({ branchId: val })}
            placeholder="Select Branch..."
            disabled={isLookupsLoading}
          />
        </div>

        {/* ── 5. Cylinder Size ─────────────────────────────────────────── */}
        <div className="md:col-span-2">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span>Cylinder Size</span>
          </label>
          <SmoothSearchableSelect
            options={sizeOptions}
            value={filters.productId === undefined ? "" : String(filters.productId)}
            onValueChange={(val) => setFilters({ productId: val })}
            placeholder="Select Size..."
            disabled={isLookupsLoading}
          />
        </div>

        {/* ── 6. Reset ─────────────────────────────────────────────────── */}
        <div className="flex justify-end md:col-span-1">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border bg-muted/40 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Reset to month-to-date, all branches and sizes"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
