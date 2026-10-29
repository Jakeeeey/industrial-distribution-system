// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/components/DeliverPerformanceFilters.tsx
// ==============================================================================
// Delivery Performance Report - Filters Bar
// Optimized with debounced search input (350ms) to prevent unnecessary fetch bursts.
// ==============================================================================

"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useDeliverPerformance, type DatePeriodPreset } from "../providers/DeliverPerformanceProvider";

const periodOptions = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

export function DeliverPerformanceFilters() {
  const { filters, updateFilter, periodPreset, setPeriodPreset, resetFilters, lookups, loading } =
    useDeliverPerformance();

  // Local debounced search state
  const [localSearch, setLocalSearch] = useState<string>(filters.search || "");
  const [prevSearch, setPrevSearch] = useState(filters.search);

  // Sync state during render when filters.search changes externally (e.g., reset)
  if (filters.search !== prevSearch) {
    setPrevSearch(filters.search);
    setLocalSearch(filters.search || "");
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== (filters.search || "")) {
        updateFilter("search", localSearch);
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [localSearch, filters.search, updateFilter]);

  // Branch options
  const branchOptions = useMemo(() => {
    const list = [{ value: "all", label: "All Branches" }];
    if (lookups?.branches) {
      lookups.branches.forEach((b) => {
        list.push({ value: String(b.id), label: b.branch_name });
      });
    }
    return list;
  }, [lookups]);

  // Status options
  const statusOptions = useMemo(() => {
    return [
      { value: "all", label: "All Statuses" },
      { value: "Fulfilled", label: "Fulfilled" },
      { value: "Fulfilled With Concerns", label: "Fulfilled With Concerns" },
      { value: "Fulfilled With Returns", label: "Fulfilled With Returns" },
      { value: "Not Fulfilled", label: "Not Fulfilled" },
    ];
  }, []);

  // Driver options
  const driverOptions = useMemo(() => {
    const list = [{ value: "all", label: "All Drivers" }];
    if (lookups?.drivers) {
      lookups.drivers.forEach((d) => {
        list.push({ value: String(d.user_id), label: d.name });
      });
    }
    return list;
  }, [lookups]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/60 p-2 sm:p-2.5 shadow-xs">
      <div className="flex flex-wrap items-end gap-2 w-full">
        {/* 1. Search Bar with Debounce */}
        <div className="flex flex-col gap-1 min-w-[200px] flex-1 max-w-sm">
          <label className="text-[11px] font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search waybill, customer, driver..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              disabled={loading}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* 2. Date Period Presets - using SearchableSelect */}
        <div className="flex flex-col gap-1 w-[140px]">
          <label className="text-[11px] font-medium text-muted-foreground">Period</label>
          <SearchableSelect
            options={periodOptions}
            value={periodPreset}
            onValueChange={(val) => setPeriodPreset(val as DatePeriodPreset)}
            placeholder="Period"
            disabled={loading}
            className="h-8 text-xs bg-background"
          />
        </div>

        {/* 3. Inline Conditional Date Pickers */}
        {periodPreset === "custom" && (
          <>
            <div className="flex flex-col gap-1 w-[130px]">
              <label className="text-[11px] font-medium text-muted-foreground">Start Date</label>
              <Input
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => updateFilter("startDate", e.target.value)}
                disabled={loading}
                className="h-8 text-xs bg-background"
              />
            </div>
            <div className="flex flex-col gap-1 w-[130px]">
              <label className="text-[11px] font-medium text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => updateFilter("endDate", e.target.value)}
                disabled={loading}
                className="h-8 text-xs bg-background"
              />
            </div>
          </>
        )}

        {/* 4. Branch Searchable Select */}
        <div className="flex flex-col gap-1 min-w-[150px] flex-1">
          <label className="text-[11px] font-medium text-muted-foreground">Branch</label>
          <SearchableSelect
            options={branchOptions}
            value={filters.branchId || "all"}
            onValueChange={(val) => updateFilter("branchId", val)}
            placeholder="All Branches"
            disabled={loading}
            className="h-8 text-xs bg-background"
          />
        </div>

        {/* 5. Delivery Status Searchable Select */}
        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          <label className="text-[11px] font-medium text-muted-foreground">Fulfillment Status</label>
          <SearchableSelect
            options={statusOptions}
            value={filters.status || "all"}
            onValueChange={(val) => updateFilter("status", val)}
            placeholder="All Statuses"
            disabled={loading}
            className="h-8 text-xs bg-background"
          />
        </div>

        {/* 6. Driver / Custodian Searchable Select */}
        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          <label className="text-[11px] font-medium text-muted-foreground">Driver / Custodian</label>
          <SearchableSelect
            options={driverOptions}
            value={filters.driverId || "all"}
            onValueChange={(val) => updateFilter("driverId", val)}
            placeholder="All Drivers"
            disabled={loading}
            className="h-8 text-xs bg-background"
          />
        </div>

        {/* 7. Reset Button aligned inline */}
        <div className="flex items-end pb-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            disabled={loading}
            className="h-8 text-xs text-muted-foreground gap-1 px-2.5 hover:text-foreground"
            title="Reset Filters"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
