// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/components/CylinderStockFilters.tsx
// ==============================================================================
// Cylinder Stock Filters
// Single-row filter toolbar with debounced search input to optimize fetch calls.
// ==============================================================================

"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useCylinderStockReport } from "../providers/CylinderStockReportProvider";
import { Input } from "@/components/ui/input";
import { Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableOption } from "./searchable-select";

export function CylinderStockFilters() {
  const { filters, updateFilter, resetFilters, lookups, isLoading } = useCylinderStockReport();

  // Local state for debounced search
  const [searchTerm, setSearchTerm] = useState(filters.search || "");
  const [prevFilterSearch, setPrevFilterSearch] = useState(filters.search || "");

  // If filters.search changed externally (e.g. resetFilters), adjust searchTerm during render
  if (filters.search !== prevFilterSearch) {
    setPrevFilterSearch(filters.search || "");
    setSearchTerm(filters.search || "");
  }

  // Debounce search update by 300ms to eliminate rapid-fire API requests while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== (filters.search || "")) {
        updateFilter("search", searchTerm);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, filters.search, updateFilter]);

  // Branch options
  const branchOptions = useMemo<SearchableOption[]>(() => {
    return [
      { value: "ALL", label: "All Branches" },
      ...lookups.branches.map((b) => ({
        value: String(b.id),
        label: `${b.branch_name} (${b.branch_code})`,
      })),
    ];
  }, [lookups.branches]);

  // Gas Product options (serialized cylinder products from products table)
  const productOptions = useMemo<SearchableOption[]>(() => {
    return [
      { value: "ALL", label: "All Gas Products" },
      ...lookups.products.map((p) => ({
        value: String(p.product_id),
        label: `${p.product_name} (${p.product_code})`,
      })),
    ];
  }, [lookups.products]);

  // Variant State options (from units table: EMPTY, SWAP, REFILL, DEPOSIT, OUTRIGHT, FULL)
  const variantOptions = useMemo<SearchableOption[]>(() => {
    const states =
      lookups.variantStates && lookups.variantStates.length > 0
        ? lookups.variantStates
        : ["EMPTY", "SWAP", "REFILL", "DEPOSIT", "OUTRIGHT", "FULL"];

    return [
      { value: "ALL", label: "All Variant States" },
      ...states.map((v) => ({
        value: v,
        label: v,
      })),
    ];
  }, [lookups.variantStates]);

  // Condition options
  const conditionOptions: SearchableOption[] = [
    { value: "ALL", label: "All Conditions" },
    { value: "GOOD", label: "Good" },
    { value: "FOR_REPAIR", label: "For Repair" },
    { value: "DAMAGED", label: "Damaged" },
    { value: "SCRAP", label: "Scrap" },
  ];

  // Status options
  const statusOptions: SearchableOption[] = [
    { value: "ALL", label: "All Statuses" },
    { value: "AVAILABLE", label: "Usable Available" },
    { value: "FULL", label: "Full" },
    { value: "EMPTY", label: "Empty" },
    { value: "LOADED", label: "Loaded" },
    { value: "RESERVED", label: "Reserved" },
    { value: "WITH_CUSTOMER", label: "With Customer" },
    { value: "WITH_SUPPLIER", label: "With Supplier" },
    { value: "DAMAGED", label: "Damaged" },
    { value: "LOST", label: "Lost" },
    { value: "RETIRED", label: "Retired" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-2.5 bg-muted/20 border rounded-lg mb-3">
      {/* Debounced Search Input */}
      <div className="relative flex-1 min-w-[180px] max-w-[280px]">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search serial, SKU, custodian..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8 text-xs h-9 bg-background"
        />
      </div>

      {/* Branch Searchable Select */}
      <div className="w-[160px] shrink-0">
        <SearchableSelect
          options={branchOptions}
          value={filters.branchId ? String(filters.branchId) : "ALL"}
          onValueChange={(val) => updateFilter("branchId", val === "ALL" ? undefined : Number(val))}
          placeholder="Select Branch..."
        />
      </div>

      {/* Gas Product Searchable Select */}
      <div className="w-[190px] shrink-0">
        <SearchableSelect
          options={productOptions}
          value={filters.productId ? String(filters.productId) : "ALL"}
          onValueChange={(val) => updateFilter("productId", val === "ALL" ? undefined : Number(val))}
          placeholder="Select Gas Product..."
        />
      </div>

      {/* Variant State Searchable Select */}
      <div className="w-[150px] shrink-0">
        <SearchableSelect
          options={variantOptions}
          value={filters.variantState || "ALL"}
          onValueChange={(val) => updateFilter("variantState", val === "ALL" ? undefined : val)}
          placeholder="Select Variant..."
        />
      </div>

      {/* Condition Searchable Select */}
      <div className="w-[140px] shrink-0">
        <SearchableSelect
          options={conditionOptions}
          value={filters.condition || "ALL"}
          onValueChange={(val) => updateFilter("condition", val as typeof filters.condition)}
          placeholder="Select Condition..."
        />
      </div>

      {/* Status Searchable Select */}
      <div className="w-[150px] shrink-0">
        <SearchableSelect
          options={statusOptions}
          value={filters.status || "ALL"}
          onValueChange={(val) => updateFilter("status", val as typeof filters.status)}
          placeholder="Select Status..."
        />
      </div>

      {/* Reset Filters Action */}
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchTerm("");
            resetFilters();
          }}
          disabled={isLoading}
          className="text-xs h-9 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
          title="Reset all filters"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
