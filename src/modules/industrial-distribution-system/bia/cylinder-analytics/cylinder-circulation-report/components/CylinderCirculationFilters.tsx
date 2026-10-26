// components/CylinderCirculationFilters.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Filter bar for Cylinder Circulation Report.
// 1. Search bar placed at start of row (Column 1)
// 2. Supports multi-cylinder selection (comma-separated or Enter key tags)
// 3. Searchable selects for Branch, Gas Type (SKU), and Circulation Health
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCylinderCirculationReport } from "../providers/CylinderCirculationReportProvider";
import { Search, X } from "lucide-react";
import type { CirculationBreakType } from "../types/cylinder-circulation.types";

export function CylinderCirculationFilters() {
  const {
    filters,
    updateFilter,
    branches,
    products,
    lookupsLoading,
  } = useCylinderCirculationReport();

  const [inputVal, setInputVal] = React.useState<string>("");

  // Existing selected serial tags
  const activeSerialTags = React.useMemo(() => {
    const raw = filters.serialNumber || "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [filters.serialNumber]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const trimmed = inputVal.trim().replace(/^,+|,+$/g, "");
      if (trimmed && !activeSerialTags.includes(trimmed)) {
        const updated = [...activeSerialTags, trimmed].join(", ");
        updateFilter("serialNumber", updated);
        setInputVal("");
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updated = activeSerialTags.filter((t) => t !== tagToRemove).join(", ");
    updateFilter("serialNumber", updated);
  };

  const handleBlur = () => {
    const trimmed = inputVal.trim().replace(/^,+|,+$/g, "");
    if (trimmed && !activeSerialTags.includes(trimmed)) {
      const updated = [...activeSerialTags, trimmed].join(", ");
      updateFilter("serialNumber", updated);
      setInputVal("");
    }
  };

  // Branch options
  const branchOptions = React.useMemo(() => {
    return [
      { value: "all", label: "All Authorized Branches" },
      ...branches.map((b) => ({
        value: b.value,
        label: `${b.label} (${b.code || b.value})`,
      })),
    ];
  }, [branches]);

  // Serialized Product options
  const productOptions = React.useMemo(() => {
    return [
      { value: "all", label: "All Gas Cylinders" },
      ...products.map((p) => ({
        value: p.value,
        label: p.label,
      })),
    ];
  }, [products]);

  // Circulation Status options
  const statusOptions = [
    { value: "ALL", label: "All Circulations (Healthy & Breaks)" },
    { value: "BREAKS_ONLY", label: "⚠️ Flagged Breaks Only" },
    { value: "HEALTHY", label: "Healthy In-Circulation" },
    { value: "BREAK_MISSING_RETURN", label: "Missing Return Scan" },
    { value: "BREAK_UNVERIFIED_TRANSIT", label: "Stalled in Transit (>72h)" },
    { value: "BREAK_LOCATION_CONFLICT", label: "Location Conflict" },
    { value: "BREAK_STATUS_MISMATCH", label: "Status Mismatch" },
  ];

  return (
    <div className="bg-card border rounded-lg p-4 shadow-xs space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {/* ── Position 1: Cylinder Serial / Tag Search Bar (Multi-select) ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cylinder Serials (Multi)
            </Label>
            {activeSerialTags.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {activeSerialTags.length} selected
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={
                activeSerialTags.length === 0
                  ? "e.g. CYL-0012, CYL-0014 (Enter to add)"
                  : "Add another serial tag..."
              }
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {/* ── Position 2: Branch Filter ── */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Branch
          </Label>
          <SearchableSelect
            options={branchOptions}
            value={filters.branchId ? String(filters.branchId) : "all"}
            onValueChange={(val) => {
              updateFilter("branchId", val === "all" ? "" : Number(val));
            }}
            placeholder="Select Branch..."
            disabled={lookupsLoading}
          />
        </div>

        {/* ── Position 3: Product / Gas Type Filter ── */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Gas Type / Cylinder SKU
          </Label>
          <SearchableSelect
            options={productOptions}
            value={filters.productId ? String(filters.productId) : "all"}
            onValueChange={(val) => {
              updateFilter("productId", val === "all" ? "" : Number(val));
            }}
            placeholder="Select Gas Type..."
            disabled={lookupsLoading}
          />
        </div>

        {/* ── Position 4: Circulation Health Status Filter ── */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Circulation Health
          </Label>
          <SearchableSelect
            options={statusOptions}
            value={filters.circulationStatus || "ALL"}
            onValueChange={(val) => {
              updateFilter(
                "circulationStatus",
                val as CirculationBreakType | "ALL" | "BREAKS_ONLY"
              );
            }}
            placeholder="Filter by Status..."
          />
        </div>
      </div>

      {/* Render Removable Badges for Multiple Selected Serials */}
      {activeSerialTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
          <span className="text-[11px] text-muted-foreground font-medium mr-1">
            Active Serials:
          </span>
          {activeSerialTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs py-0.5 pl-2 pr-1 gap-1 font-mono bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:bg-primary/20 rounded-full p-0.5 inline-flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={() => updateFilter("serialNumber", "")}
            className="text-[11px] text-muted-foreground hover:text-foreground underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
