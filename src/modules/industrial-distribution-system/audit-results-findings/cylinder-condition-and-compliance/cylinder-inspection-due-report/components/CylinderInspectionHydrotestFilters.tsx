// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/components/CylinderInspectionHydrotestFilters.tsx
// ==============================================================================
// Filter Bar for Cylinder Inspection and Hydrotest Due Report
// - Search bar positioned at the start of the row
// - SearchableSelect utilized for Branch, Product, Horizon, Compliance, and Condition
// - "Include Retired" toggle switch
// ==============================================================================

"use client";

import * as React from "react";
import { useCylinderInspection } from "../providers/CylinderInspectionHydrotestProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, RotateCcw, Filter } from "lucide-react";
// AG-COMMENT: Using module-scoped SearchableSelect to ensure truncation without modifying global components
import { SearchableSelect } from "./searchable-select";
import type { CylinderInspectionFilterInput } from "../types/cylinder-inspection-hydrotest.schema";

export function CylinderInspectionHydrotestFilters() {
  const { filters, setFilters, resetFilters, lookups, isLoading } = useCylinderInspection();
  const [localSearch, setLocalSearch] = React.useState(filters.searchQuery || "");

  // Debounced search sync
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== (filters.searchQuery || "")) {
        setFilters({ searchQuery: localSearch });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [localSearch, filters.searchQuery, setFilters]);

  // Sync external filter resets back to local search state
  React.useEffect(() => {
    setLocalSearch(filters.searchQuery || "");
  }, [filters.searchQuery]);

  const handleBranchChange = (val: string) => {
    setFilters({ branchId: val === "ALL" ? undefined : val });
  };

  const handleProductChange = (val: string) => {
    setFilters({ productId: val === "ALL" ? undefined : Number(val) });
  };

  const handleHorizonChange = (val: string) => {
    setFilters({ warningDays: Number(val) });
  };

  const handleStatusChange = (val: string) => {
    setFilters({ complianceStatus: val as CylinderInspectionFilterInput["complianceStatus"] });
  };

  const handleConditionChange = (val: string) => {
    setFilters({ condition: val as CylinderInspectionFilterInput["condition"] });
  };

  const handleRetiredToggle = (checked: boolean) => {
    setFilters({ includeRetired: checked });
  };

  // Memoized SearchableSelect Options
  const branchOptions = React.useMemo(() => [
    { value: "ALL", label: "All Authorized Branches" },
    ...(lookups?.branches.map((b) => ({
      value: String(b.id),
      label: b.branch_name,
    })) || []),
  ], [lookups?.branches]);

  const productOptions = React.useMemo(() => [
    { value: "ALL", label: "All Serialized Products" },
    ...(lookups?.products.map((p) => ({
      value: String(p.product_id),
      label: p.product_code ? `${p.product_name} (${p.product_code})` : p.product_name,
    })) || []),
  ], [lookups?.products]);

  const horizonOptions = React.useMemo(() => [
    { value: "15", label: "Next 15 Days" },
    { value: "30", label: "Next 30 Days (Standard)" },
    { value: "60", label: "Next 60 Days" },
    { value: "90", label: "Next 90 Days (Quarterly)" },
    { value: "180", label: "Next 180 Days" },
  ], []);

  const complianceOptions = React.useMemo(() => [
    { value: "ALL", label: "All Compliance Statuses" },
    { value: "OVERDUE", label: "Overdue (Critical)" },
    { value: "DUE_SOON", label: "Due Soon (Warning)" },
    { value: "FAILED", label: "Failed / Defective" },
    { value: "MISSING_CERT", label: "Missing Cert / Unknown" },
    { value: "COMPLIANT", label: "Compliant" },
  ], []);

  const conditionOptions = React.useMemo(() => [
    { value: "ALL", label: "All Physical Conditions" },
    { value: "GOOD", label: "Good Condition" },
    { value: "FOR_REPAIR", label: "For Repair" },
    { value: "DAMAGED", label: "Damaged" },
    { value: "SCRAP", label: "Scrap / Condemned" },
  ], []);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-primary" />
          <span>Audit & Compliance Filters</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLocalSearch("");
            resetFilters();
          }}
          disabled={isLoading}
          className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <RotateCcw className="h-3 w-3" />
          Reset Filters
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Search Bar at the start of the row */}
        <div className="space-y-1 min-w-0">
          <label className="text-[11px] font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Serial, custodian, remarks..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="h-9 pl-8 text-xs"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* 2. Branch SearchableSelect */}
        <div className="space-y-1 min-w-0">
          <label className="text-[11px] font-medium text-muted-foreground">Branch</label>
          <SearchableSelect
            options={branchOptions}
            value={filters.branchId || "ALL"}
            onValueChange={handleBranchChange}
            placeholder="Select branch..."
            disabled={isLoading}
            className="h-9 text-xs"
          />
        </div>

        {/* 3. Gas Product SKU SearchableSelect */}
        <div className="space-y-1 min-w-0">
          <label className="text-[11px] font-medium text-muted-foreground">Gas Product SKU</label>
          <SearchableSelect
            options={productOptions}
            value={filters.productId ? String(filters.productId) : "ALL"}
            onValueChange={handleProductChange}
            placeholder="Select product..."
            disabled={isLoading}
            className="h-9 text-xs"
          />
        </div>

        {/* 4. Warning Horizon SearchableSelect */}
        <div className="space-y-1 min-w-0">
          <label className="text-[11px] font-medium text-muted-foreground">Warning Horizon</label>
          <SearchableSelect
            options={horizonOptions}
            value={String(filters.warningDays || 30)}
            onValueChange={handleHorizonChange}
            placeholder="Warning window..."
            disabled={isLoading}
            className="h-9 text-xs"
          />
        </div>

        {/* 5. Compliance Rating SearchableSelect */}
        <div className="space-y-1 min-w-0">
          <label className="text-[11px] font-medium text-muted-foreground">Compliance Rating</label>
          <SearchableSelect
            options={complianceOptions}
            value={filters.complianceStatus || "ALL"}
            onValueChange={handleStatusChange}
            placeholder="All Statuses"
            disabled={isLoading}
            className="h-9 text-xs"
          />
        </div>

        {/* 6. Physical Condition SearchableSelect */}
        <div className="space-y-1 min-w-0">
          <label className="text-[11px] font-medium text-muted-foreground">Physical Condition</label>
          <SearchableSelect
            options={conditionOptions}
            value={filters.condition || "ALL"}
            onValueChange={handleConditionChange}
            placeholder="All Conditions"
            disabled={isLoading}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* Secondary toggles */}
      <div className="flex items-center gap-3 pt-1 border-t border-border/40">
        <div className="flex items-center space-x-2">
          <Switch
            id="include-retired"
            checked={Boolean(filters.includeRetired)}
            onCheckedChange={handleRetiredToggle}
            disabled={isLoading}
          />
          <Label htmlFor="include-retired" className="text-xs text-muted-foreground cursor-pointer">
            Include Retired / Decommissioned Cylinders (Historical Preservation)
          </Label>
        </div>
      </div>
    </div>
  );
}
