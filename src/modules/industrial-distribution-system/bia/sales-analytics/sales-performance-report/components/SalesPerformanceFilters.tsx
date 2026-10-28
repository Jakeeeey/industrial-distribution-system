// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/components/SalesPerformanceFilters.tsx
// ==============================================================================
// Sales Performance Report - Filters Component
// Integrates Search at start, Date Presets without MTD/YTD, Conditional Custom Dates,
// SearchableMultiSelect for Gas Products, and an explicit 'Apply Filter' button.
// ==============================================================================

"use client";

import * as React from "react";
import { Search, Filter, Calendar, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { useSalesPerformance } from "../providers/SalesPerformanceProvider";
import type { SalesPerformanceFilterInput } from "../types/sales-performance.schema";
import type { DatePresetType, TaxTreatmentType } from "../types/sales-performance.types";

const DATE_PRESETS: { id: DatePresetType; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "custom", label: "Custom Range" },
];

export function SalesPerformanceFilters() {
  const { filters, lookups, applyFilters, resetFilters, isLoading } =
    useSalesPerformance();

  // DEV-RULE: Maintain staged local filters so selections do NOT trigger network calls until 'Apply Filter' is clicked
  const [staged, setStaged] = React.useState<SalesPerformanceFilterInput>(filters);

  // Sync staged filters whenever external filters reset
  React.useEffect(() => {
    setStaged(filters);
  }, [filters]);

  // Compute if staged filters have uncommitted changes
  const hasPendingChanges = React.useMemo(() => {
    return JSON.stringify(staged) !== JSON.stringify(filters);
  }, [staged, filters]);

  const updateStaged = <K extends keyof SalesPerformanceFilterInput>(
    key: K,
    val: SalesPerformanceFilterInput[K]
  ) => {
    setStaged((prev) => ({ ...prev, [key]: val }));
  };

  const handlePresetSelect = (preset: DatePresetType) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    let start = todayStr;
    const end = todayStr;

    if (preset === "today") {
      start = todayStr;
    } else if (preset === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now.setDate(diff));
      start = mon.toISOString().split("T")[0];
    } else if (preset === "this_month") {
      start = `${y}-${m}-01`;
    }

    setStaged((prev) => ({
      ...prev,
      datePreset: preset,
      startDate: preset === "custom" ? prev.startDate : start,
      endDate: preset === "custom" ? prev.endDate : end,
    }));
  };

  // Convert comma-delimited productId string to array for MultiSelect
  const selectedProductIds = React.useMemo(() => {
    if (!staged.productId || staged.productId === "ALL") return [];
    return staged.productId.split(",").map((s) => s.trim()).filter(Boolean);
  }, [staged.productId]);

  const handleProductMultiChange = (ids: string[]) => {
    updateStaged("productId", ids.length === 0 ? "ALL" : ids.join(","));
  };

  const handleApply = () => {
    applyFilters(staged);
  };

  const handleReset = () => {
    resetFilters();
  };

  // Options for SearchableSelect with "All" option included
  const branchOptions = React.useMemo(() => {
    return [
      { value: "ALL", label: "All Authorized Branches" },
      ...(lookups?.branches || []),
    ];
  }, [lookups]);

  const customerOptions = React.useMemo(() => {
    return [
      { value: "ALL", label: "All Customers" },
      ...(lookups?.customers || []),
    ];
  }, [lookups]);

  const productOptions = React.useMemo(() => {
    return lookups?.products || [];
  }, [lookups]);

  const salesmanOptions = React.useMemo(() => {
    return [
      { value: "ALL", label: "All Sales Representatives" },
      ...(lookups?.salesmen || []),
    ];
  }, [lookups]);

  return (
    <div className="space-y-3 p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
      {/* Row 1: Primary Controls - Searchbar at Start, Presets, Conditional Dates, and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {/* Quick Search positioned at the very start */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by invoice no, customer, branch, product..."
              value={staged.searchQuery || ""}
              onChange={(e) => updateStaged("searchQuery", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
              className="pl-9 h-9 text-xs"
              disabled={isLoading}
            />
          </div>

          {/* Period Presets: Today, This Week, This Month, Custom Range */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Period:
            </span>
            {DATE_PRESETS.map((p) => {
              const isActive = staged.datePreset === p.id;
              return (
                <Badge
                  key={p.id}
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer px-2.5 py-1 text-xs transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                  onClick={() => handlePresetSelect(p.id)}
                >
                  {p.label}
                </Badge>
              );
            })}
          </div>

          {/* Conditional From/To Date Pickers: Display ONLY when 'Custom Range' is active */}
          {staged.datePreset === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">From:</span>
                <Input
                  type="date"
                  value={staged.startDate || ""}
                  onChange={(e) => updateStaged("startDate", e.target.value)}
                  className="h-9 text-xs w-36"
                  disabled={isLoading}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">To:</span>
                <Input
                  type="date"
                  value={staged.endDate || ""}
                  onChange={(e) => updateStaged("endDate", e.target.value)}
                  className="h-9 text-xs w-36"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons: Reset & Apply Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground h-9 gap-1"
            disabled={isLoading}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
            className={`text-xs h-9 px-4 font-semibold gap-1.5 transition-all shadow-xs ${
              hasPendingChanges
                ? "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary/30"
                : "bg-primary/90 text-primary-foreground hover:bg-primary"
            }`}
            disabled={isLoading}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Apply Filter</span>
            {hasPendingChanges && (
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Row 2: Secondary Dropdown Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Branch Searchable Select */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Branch</label>
          <SearchableSelect
            options={branchOptions}
            value={staged.branchId}
            onValueChange={(val) => updateStaged("branchId", val)}
            placeholder="Select branch..."
            disabled={isLoading}
            className="h-9 text-xs"
          />
        </div>

        {/* 2. Customer Searchable Select */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Customer</label>
          <SearchableSelect
            options={customerOptions}
            value={staged.customerCode}
            onValueChange={(val) => updateStaged("customerCode", val)}
            placeholder="Select customer..."
            disabled={isLoading}
            className="h-9 text-xs"
          />
        </div>

        {/* 3. Gas / Product Searchable Multi-Select */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Gas Products (Multi-select)</label>
          <SearchableMultiSelect
            options={productOptions}
            selectedValues={selectedProductIds}
            onSelectionChange={handleProductMultiChange}
            placeholder="All Products / Gas Types"
            disabled={isLoading}
            className="h-9 text-xs"
          />
        </div>

        {/* 4. Salesman Searchable Select */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Salesman</label>
          <SearchableSelect
            options={salesmanOptions}
            value={staged.salesmanId}
            onValueChange={(val) => updateStaged("salesmanId", val)}
            placeholder="Select salesman..."
            disabled={isLoading}
            className="h-9 text-xs"
          />
        </div>

        {/* 5. Tax Treatment Select */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tax Treatment</label>
          <Select
            value={staged.taxTreatment}
            onValueChange={(val) => updateStaged("taxTreatment", val as TaxTreatmentType)}
            disabled={isLoading}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Tax Treatments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All (VAT & Non-VAT)</SelectItem>
              <SelectItem value="VAT" className="text-xs">VAT 12% (Official Receipts)</SelectItem>
              <SelectItem value="NON_VAT" className="text-xs">Non-VAT / Exempt (Provisional)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

