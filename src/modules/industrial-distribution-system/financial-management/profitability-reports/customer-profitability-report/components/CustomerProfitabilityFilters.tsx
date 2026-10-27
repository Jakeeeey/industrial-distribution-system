// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/components/CustomerProfitabilityFilters.tsx
// ==============================================================================
// Filter Bar Component with SearchableSelect, Date Presets, Custom Date Range, and Search
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import { useCustomerProfitability } from "../providers/CustomerProfitabilityProvider";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Search, Calendar, X, CalendarRange } from "lucide-react";
import type { ProfitabilityTier, DatePreset } from "../types/customer-profitability.types";

export function CustomerProfitabilityFilters() {
  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    datePreset,
    setDatePreset,
    branchId,
    setBranchId,
    tier,
    setTier,
    searchQuery,
    setSearchQuery,
    branches,
    setPage,
  } = useCustomerProfitability();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to page 1 on search
  };

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(1);
  };

  // Build options for branch SearchableSelect
  const branchOptions = React.useMemo(() => {
    const list = [
      {
        value: "all",
        label: "Consolidated (All Branches)",
      },
    ];
    branches.forEach((b) => {
      list.push({
        value: String(b.id),
        label: `${b.branch_name} (${b.branch_code})`,
      });
    });
    return list;
  }, [branches]);

  // Build options for margin tier SearchableSelect
  const tierOptions = React.useMemo(
    () => [
      { value: "all", label: "All Tiers" },
      { value: "HIGH", label: "High (≥25%)" },
      { value: "MODERATE", label: "Moderate (10-25%)" },
      { value: "MARGINAL", label: "Marginal (0-10%)" },
      { value: "LOSS", label: "Loss-Making (<0%)" },
      { value: "INCOMPLETE", label: "Incomplete Data" },
    ],
    []
  );

  return (
    <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-3.5 shadow-xs">
      {/* Top Filter Controls: Search & Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search Input */}
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search account by code, customer name, store..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9 pr-8 h-9 text-xs bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded-xs"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Branch Searchable Select */}
        <div className="md:col-span-4">
          <SearchableSelect
            options={branchOptions}
            value={String(branchId)}
            onValueChange={(val) => {
              setBranchId(val === "all" ? "all" : Number(val));
              setPage(1);
            }}
            placeholder="Select branch..."
            className="h-9 text-xs bg-background"
          />
        </div>

        {/* Margin Tier Searchable Select */}
        <div className="md:col-span-3">
          <SearchableSelect
            options={tierOptions}
            value={tier}
            onValueChange={(val) => {
              setTier(val as ProfitabilityTier | "all");
              setPage(1);
            }}
            placeholder="Select tier..."
            className="h-9 text-xs bg-background"
          />
        </div>
      </div>

      {/* Bottom Filter Controls: Date Presets & Optional Custom Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-border/50">
        {/* Date Presets Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-muted-foreground mr-1 hidden sm:inline-block">Period:</span>
          {(
            [
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "qtd", label: "QTD" },
              { id: "ytd", label: "YTD" },
              { id: "custom", label: "Custom Range" },
            ] as const
          ).map((p) => {
            const isActive = datePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.id === "custom" && <CalendarRange className="h-3.5 w-3.5" />}
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Range Selector (Visible only when 'custom' is active) */}
        {datePreset === "custom" && (
          <div className="flex items-center gap-2 text-xs bg-muted/40 border border-border/80 px-3 py-1.5 rounded-lg animate-in fade-in-50 duration-200">
            <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-7 text-xs bg-background border border-input rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-muted-foreground font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="h-7 text-xs bg-background border border-input rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>
    </div>
  );
}
