// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/components/CustomerProfitabilityFilters.tsx
// ==============================================================================
// Filter Bar Component with Date Presets, Branch, Margin Tier, and Search
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import { useCustomerProfitability } from "../providers/CustomerProfitabilityProvider";
import { Input } from "@/components/ui/input";
import { Search, Calendar, Filter, X } from "lucide-react";
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

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setBranchId(val === "all" ? "all" : Number(val));
    setPage(1);
  };

  const handleTierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTier(e.target.value as ProfitabilityTier | "all");
    setPage(1);
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-3">
      {/* Top Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
        {/* Search Input */}
        <div className="lg:col-span-4 relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search account by code, customer name, store..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9 pr-8 h-9 text-xs bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date Presets */}
        <div className="lg:col-span-3 flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "qtd", label: "QTD" },
              { id: "ytd", label: "YTD" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetChange(p.id)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                datePreset === p.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Branch Selector */}
        <div className="lg:col-span-3">
          <select
            value={branchId}
            onChange={handleBranchChange}
            className="w-full h-9 text-xs bg-background border border-input rounded-md px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Consolidated (All Branches)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name} ({b.branch_code})
              </option>
            ))}
          </select>
        </div>

        {/* Margin Tier Filter */}
        <div className="lg:col-span-2">
          <select
            value={tier}
            onChange={handleTierChange}
            className="w-full h-9 text-xs bg-background border border-input rounded-md px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Tiers</option>
            <option value="HIGH">High (≥25%)</option>
            <option value="MODERATE">Moderate (10-25%)</option>
            <option value="MARGINAL">Marginal (0-10%)</option>
            <option value="LOSS">Loss-Making (&lt;0%)</option>
            <option value="INCOMPLETE">Incomplete Data</option>
          </select>
        </div>
      </div>

        {/* Date Range Custom Input Row (if needed) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Date Range:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setDatePreset("custom");
            }}
            className="h-7 text-xs bg-background border border-input rounded px-2 text-foreground focus:outline-none"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setDatePreset("custom");
            }}
            className="h-7 text-xs bg-background border border-input rounded px-2 text-foreground focus:outline-none"
          />
        </div>
    </div>
  );
}
