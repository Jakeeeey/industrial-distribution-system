// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationMultiSelect.tsx
// ==============================================================================
// Searchable Multi-Select Combobox for Cylinder Utilization Filters.
//
// Supports:
// - Dynamic "Select All" / "Unselect All" toggle
// - In-dropdown "Reset" button to restore all options
// - Real-time client-side search filtering
// - Checkboxes with count badges on trigger
// - Full comments left behind for long-term maintainability (AG-COMMENT)
// ==============================================================================

"use client";

import * as React from "react";
import { Check, ChevronsUpDown, RotateCcw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface UtilizationMultiSelectOption {
  value: string;
  label: string;
  code?: string;
}

interface UtilizationMultiSelectProps {
  options: UtilizationMultiSelectOption[];
  selectedValues: string[]; // List of selected option values
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
  unitLabel?: string; // e.g., "Branches" or "Sizes"
  disabled?: boolean;
  className?: string;
}

export function UtilizationMultiSelect({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
  unitLabel = "Items",
  disabled = false,
  className,
}: UtilizationMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const allValues = React.useMemo(() => options.map((o) => o.value), [options]);

  // AG-COMMENT: Dynamic check if all available options are currently selected
  const isAllSelected = React.useMemo(() => {
    if (options.length === 0) return true;
    return options.every((opt) => selectedValues.includes(opt.value));
  }, [options, selectedValues]);

  const isNoneSelected = selectedValues.length === 0;

  // Filter options based on user search term
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.code && opt.code.toLowerCase().includes(q))
    );
  }, [options, searchTerm]);

  // Toggle individual option checkbox
  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onSelectionChange(selectedValues.filter((v) => v !== val));
    } else {
      onSelectionChange([...selectedValues, val]);
    }
  };

  // AG-COMMENT: Dynamically toggle between Select All and Unselect All
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allValues);
    }
  };

  // Reset to default (all options selected)
  const handleReset = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onSelectionChange(allValues);
  };

  // Clear all selections
  const handleClearAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onSelectionChange([]);
  };

  // Trigger button summary text
  const triggerText = React.useMemo(() => {
    if (options.length === 0) return placeholder;
    if (isAllSelected) return `All ${unitLabel} (${options.length})`;
    if (isNoneSelected) return `0 ${unitLabel} Selected`;
    if (selectedValues.length === 1) {
      const match = options.find((o) => o.value === selectedValues[0]);
      return match ? match.label : `1 ${unitLabel} Selected`;
    }
    return `${selectedValues.length} of ${options.length} ${unitLabel}`;
  }, [options, isAllSelected, isNoneSelected, selectedValues, unitLabel, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-xs h-9 px-3 bg-card hover:bg-muted/50 border border-input transition-all duration-150",
            open && "border-primary ring-1 ring-ring",
            className
          )}
        >
          <span className="truncate text-left flex-1 mr-2 font-medium text-foreground">
            {triggerText}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isAllSelected && !isNoneSelected && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] font-semibold bg-primary/10 text-primary"
              >
                {selectedValues.length}
              </Badge>
            )}
            {!isAllSelected && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleReset}
                title="Reset to All"
                className="p-0.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-2 space-y-2 shadow-lg" align="start">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search ${unitLabel.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs bg-background"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* AG-COMMENT: Action Shortcuts: Dynamic Select All / Unselect All + Reset Button */}
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground border-b pb-1.5">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className={cn(
              "font-medium transition-colors cursor-pointer hover:text-foreground",
              isAllSelected ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-primary font-semibold"
            )}
          >
            {isAllSelected ? "Unselect All" : "Select All"}
          </button>

          <div className="flex items-center gap-2">
            {!isAllSelected && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                title="Reset to all items"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
            {!isNoneSelected && !isAllSelected && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-rose-500 hover:text-rose-600 transition-colors font-medium cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Checkbox Options list */}
        <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-1">
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No matching {unitLabel.toLowerCase()} found.
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isChecked = selectedValues.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => toggleOption(opt.value)}
                  className={cn(
                    "flex items-center gap-2.5 p-2 rounded-md cursor-pointer text-xs transition-colors hover:bg-muted/60 select-none",
                    isChecked && "bg-muted/80 font-medium"
                  )}
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      isChecked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-input bg-background"
                    )}
                  >
                    {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <span className="truncate flex-1 text-foreground" title={opt.label}>
                    {opt.label}
                  </span>
                  {opt.code && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {opt.code}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
