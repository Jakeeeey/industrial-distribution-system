// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/components/LostDamagedCylinderFilters.tsx
// ==============================================================================
// Filter Bar for Lost and Damaged Cylinder Report
// - Search bar positioned at the start of the row
// - Custom date range pickers (Start Date & End Date) that ONLY show when "Custom Range" is selected
// - Branch, Category, Condition, Lifecycle Status, and Charge Status selectors
// ==============================================================================

"use client";

import * as React from "react";
import { useLostDamagedCylinder } from "../providers/LostDamagedCylinderProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, Calendar as CalendarIcon } from "lucide-react";
import type { LostDamagedFilterInput } from "../types/lost-damaged-cylinder.schema";
import { SearchableSelect } from "@/components/ui/searchable-select";

export function LostDamagedCylinderFilters() {
  const { filters, setFilters, resetFilters, lookups } = useLostDamagedCylinder();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ searchQuery: e.target.value });
  };

  const handleBranchChange = (value: string) => {
    setFilters({ branchId: value });
  };

  const handleCategoryChange = (value: string) => {
    setFilters({ incidentCategory: value as LostDamagedFilterInput["incidentCategory"] });
  };

  const handleConditionChange = (value: string) => {
    setFilters({ condition: value as LostDamagedFilterInput["condition"] });
  };

  const handleStatusChange = (value: string) => {
    setFilters({ status: value as LostDamagedFilterInput["status"] });
  };

  const handleChargeStatusChange = (value: string) => {
    setFilters({ chargeStatus: value as LostDamagedFilterInput["chargeStatus"] });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ startDate: e.target.value });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ endDate: e.target.value });
  };

  const applyPreset = (preset: string) => {
    const now = new Date();
    let startDate = "";
    let endDate = now.toISOString().split("T")[0];

    if (preset === "TODAY") {
      startDate = endDate;
    } else if (preset === "THIS_WEEK") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff)).toISOString().split("T")[0];
    } else if (preset === "THIS_MONTH") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    } else if (preset === "CUSTOM") {
      // Retain or set current default start/end dates
      startDate = filters.startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      endDate = filters.endDate || endDate;
    } else if (preset === "ALL") {
      startDate = "";
      endDate = "";
    }

    setFilters({ datePreset: preset, startDate, endDate });
  };

  const isCustomRange = filters.datePreset === "CUSTOM";

  // Dropdown options prepared for SearchableSelect
  const branchOptions = React.useMemo(() => [
    { value: "ALL", label: "All Branches" },
    ...(lookups?.branches.map((b) => ({ value: String(b.id), label: b.branch_name })) || []),
  ], [lookups?.branches]);

  const categoryOptions = [
    { value: "ALL", label: "All Categories" },
    { value: "LOST", label: "Lost Cylinders" },
    { value: "DAMAGED", label: "Damaged / Repair" },
  ];

  const conditionOptions = [
    { value: "ALL", label: "All Conditions" },
    { value: "GOOD", label: "Good (Missing)" },
    { value: "FOR_REPAIR", label: "For Repair" },
    { value: "DAMAGED", label: "Damaged" },
    { value: "SCRAP", label: "Scrap" },
  ];

  const statusOptions = [
    { value: "ALL", label: "All Statuses" },
    { value: "REPORTED", label: "Reported (Pending)" },
    { value: "VERIFIED", label: "Verified" },
    { value: "WRITTEN_OFF", label: "Approved Write-Off" },
    { value: "RECOVERED", label: "Recovered" },
  ];

  const chargeStatusOptions = [
    { value: "ALL", label: "All Charges" },
    { value: "UNCHARGED", label: "Uncharged" },
    { value: "ASSESSED", label: "Assessed" },
    { value: "BILLED", label: "Billed" },
    { value: "SETTLED", label: "Settled" },
    { value: "WAIVED", label: "Waived" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3.5">
      {/* Date Presets Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Period:</span>
          {[
            { id: "ALL", label: "All Time" },
            { id: "TODAY", label: "Today" },
            { id: "THIS_WEEK", label: "This Week" },
            { id: "THIS_MONTH", label: "This Month" },
            { id: "CUSTOM", label: "Custom Range" },
          ].map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={filters.datePreset === item.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => applyPreset(item.id)}
              className={`h-7 px-2.5 text-xs rounded-md ${
                filters.datePreset === item.id
                  ? "font-semibold bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Filters</span>
          </Button>
        </div>
      </div>

      {/* Conditionally rendered Custom Date Range Inputs */}
      {isCustomRange && (
        <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-lg bg-muted/40 border border-border animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
            <CalendarIcon className="h-3.5 w-3.5 text-primary" />
            <span>Custom Date Range:</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Start:</span>
              <Input
                type="date"
                value={filters.startDate || ""}
                onChange={handleStartDateChange}
                className="h-7 w-36 text-xs bg-background"
              />
            </div>

            <span className="text-muted-foreground text-xs">—</span>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>End:</span>
              <Input
                type="date"
                value={filters.endDate || ""}
                onChange={handleEndDateChange}
                className="h-7 w-36 text-xs bg-background"
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter Selectors Grid - Search bar at the start */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
        {/* 1. Quick Search Input (Moved to the start of the row) */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Serial, Incident #, Doc..."
              value={filters.searchQuery || ""}
              onChange={handleSearchChange}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* 2. Branch Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Branch</label>
          <SearchableSelect
            options={branchOptions}
            value={filters.branchId || "ALL"}
            onValueChange={handleBranchChange}
            placeholder="Select Branch..."
            className="h-8 text-xs bg-background font-normal"
          />
        </div>

        {/* 3. Category Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Category</label>
          <SearchableSelect
            options={categoryOptions}
            value={filters.incidentCategory || "ALL"}
            onValueChange={handleCategoryChange}
            placeholder="Select Category..."
            className="h-8 text-xs bg-background font-normal"
          />
        </div>

        {/* 4. Condition Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Condition</label>
          <SearchableSelect
            options={conditionOptions}
            value={filters.condition || "ALL"}
            onValueChange={handleConditionChange}
            placeholder="Select Condition..."
            className="h-8 text-xs bg-background font-normal"
          />
        </div>

        {/* 5. Lifecycle Status Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Lifecycle Status</label>
          <SearchableSelect
            options={statusOptions}
            value={filters.status || "ALL"}
            onValueChange={handleStatusChange}
            placeholder="Select Status..."
            className="h-8 text-xs bg-background font-normal"
          />
        </div>

        {/* 6. Charge Status Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Charge Status</label>
          <SearchableSelect
            options={chargeStatusOptions}
            value={filters.chargeStatus || "ALL"}
            onValueChange={handleChargeStatusChange}
            placeholder="Select Charge Status..."
            className="h-8 text-xs bg-background font-normal"
          />
        </div>
      </div>
    </div>
  );
}
