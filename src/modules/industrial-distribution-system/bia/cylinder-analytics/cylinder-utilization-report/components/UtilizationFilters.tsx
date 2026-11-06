// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationFilters.tsx
// ==============================================================================
// Parameter Filter Bar for the Cylinder Utilization Report (spec §2, §5).
//
// Controls the reporting period, reporting cutoff, branch multi-scoping, and
// cylinder size multi-scoping with dynamic select-all/unselect-all.
//
// AG-COMMENT: Staged filter pattern — selections only update the dataset when the
// user clicks the explicit "Apply" button, preventing unnecessary server round-trips.
//
// Complies with VoSync Design System standards:
// - Searchable multi-select popovers with select/unselect all and reset
// - Clear period start and reporting cutoff controls
// - Explicit "Apply" button with unapplied changes indicator
// - Full comments left behind for long-term maintainability (AG-COMMENT)
// ==============================================================================

"use client";

import * as React from "react";
import { Building2, Calendar, Filter, Layers, RotateCcw } from "lucide-react";
import { useCylinderUtilizationReport } from "../hooks/useCylinderUtilizationReport";
import { UtilizationMultiSelect } from "./UtilizationMultiSelect";
import type { CylinderUtilizationFilters } from "../types/cylinder-utilization-report.types";

export function UtilizationFilters() {
  const { filters, setFilters, resetFilters, lookups, isLookupsLoading, isLoading } =
    useCylinderUtilizationReport();

  // AG-COMMENT: Staged filters ensure network fetches occur ONLY when the "Apply" button is clicked
  const [stagedFilters, setStagedFilters] = React.useState<CylinderUtilizationFilters>(filters);

  // Sync staged filters whenever the external filters are updated or reset
  React.useEffect(() => {
    setStagedFilters(filters);
  }, [filters]);

  const hasUnappliedChanges = React.useMemo(() => {
    return JSON.stringify(stagedFilters) !== JSON.stringify(filters);
  }, [stagedFilters, filters]);

  // ── 1. Options mapping ──────────────────────────────────────────────────────
  const branchOptions = React.useMemo(
    () => lookups.branches.map((b) => ({ value: String(b.id), label: b.name, code: b.code })),
    [lookups.branches]
  );

  const sizeOptions = React.useMemo(
    () => lookups.sizes.map((s) => ({ value: String(s.id), label: s.label, code: s.code })),
    [lookups.sizes]
  );

  const allBranchValues = React.useMemo(() => branchOptions.map((b) => b.value), [branchOptions]);
  const allSizeValues = React.useMemo(() => sizeOptions.map((s) => s.value), [sizeOptions]);

  // ── 2. Active selection calculation for multi-selects based on STAGED filters
  const selectedBranchValues = React.useMemo(() => {
    if (stagedFilters.branchId === "NONE") return [];
    if (!stagedFilters.branchId || stagedFilters.branchId === "ALL") return allBranchValues;
    return String(stagedFilters.branchId).split(",").map((s) => s.trim()).filter(Boolean);
  }, [stagedFilters.branchId, allBranchValues]);

  const selectedSizeValues = React.useMemo(() => {
    if (stagedFilters.productId === "NONE") return [];
    if (!stagedFilters.productId || stagedFilters.productId === "ALL" || stagedFilters.productId === "") return allSizeValues;
    return String(stagedFilters.productId).split(",").map((s) => s.trim()).filter(Boolean);
  }, [stagedFilters.productId, allSizeValues]);

  // ── 3. Change handlers: update STAGED state only ────────────────────────────
  const handleBranchChange = (newSelected: string[]) => {
    setStagedFilters((prev) => {
      if (newSelected.length === 0) {
        return { ...prev, branchId: "NONE" };
      }
      if (newSelected.length === allBranchValues.length) {
        return { ...prev, branchId: "ALL" };
      }
      return { ...prev, branchId: newSelected.join(",") };
    });
  };

  const handleSizeChange = (newSelected: string[]) => {
    setStagedFilters((prev) => {
      if (newSelected.length === 0) {
        return { ...prev, productId: "NONE" };
      }
      if (newSelected.length === allSizeValues.length) {
        return { ...prev, productId: "" };
      }
      return { ...prev, productId: newSelected.join(",") };
    });
  };

  // AG-COMMENT: Commits staged filters to provider, which fires the network fetch
  const handleApply = () => {
    setFilters(stagedFilters);
  };

  const handleReset = () => {
    resetFilters();
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-2xs">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        {/* ── 1. Period Start ──────────────────────────────────────────── */}
        <div className="sm:col-span-1 lg:col-span-2">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Period Start</span>
          </label>
          <input
            type="date"
            title="Start date of the reporting period."
            value={stagedFilters.startDate}
            onChange={(e) => setStagedFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            className="w-full h-9 rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          />
        </div>

        {/* ── 2. Reporting Cutoff ──────────────────────────────────────── */}
        <div className="sm:col-span-1 lg:col-span-2">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Reporting Cutoff</span>
          </label>
          <input
            type="date"
            title="Cutoff date against which cylinder dormancy and fleet status are measured."
            value={stagedFilters.endDate}
            onChange={(e) => setStagedFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            className="w-full h-9 rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          />
        </div>

        {/* ── 3. Branch Multi-Select ───────────────────────────────────── */}
        <div className="sm:col-span-1 lg:col-span-3">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span>Branch</span>
          </label>
          <UtilizationMultiSelect
            options={branchOptions}
            selectedValues={selectedBranchValues}
            onSelectionChange={handleBranchChange}
            unitLabel="Branches"
            placeholder="Select Branches..."
            disabled={isLookupsLoading}
          />
        </div>

        {/* ── 4. Product Multi-Select ────────────────────────────── */}
        <div className="sm:col-span-1 lg:col-span-3">
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span>Product</span>
          </label>
          <UtilizationMultiSelect
            options={sizeOptions}
            selectedValues={selectedSizeValues}
            onSelectionChange={handleSizeChange}
            unitLabel="Products"
            placeholder="Select Products..."
            disabled={isLookupsLoading}
          />
        </div>

        {/* ── 5. Action Buttons: Reset & Apply Filter ───────────────────── */}
        <div className="sm:col-span-2 lg:col-span-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer disabled:opacity-50"
            title="Reset to default filters"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={isLoading}
            className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-60 ${
              hasUnappliedChanges
                ? "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary/30 font-bold"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
            title="Apply filter parameters to update report data"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Apply</span>
            {hasUnappliedChanges && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Unapplied changes pending" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
