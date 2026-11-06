// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/components/SearchableMultiSelect.tsx
// ==============================================================================
// Sales Performance Report - Searchable Multi-Select Component
// Allows selecting multiple gas products with search, checkboxes, and select/clear all.
// ==============================================================================

"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface MultiSelectOption {
  value: string;
  label: string;
  code?: string;
  weight?: number;
}

interface SearchableMultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[]; // e.g. ["24340", "24345"] or [] for All
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableMultiSelect({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "All Products / Gas Types",
  disabled = false,
  className,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.code && opt.code.toLowerCase().includes(q))
    );
  }, [options, searchTerm]);

  const isAllSelected = selectedValues.length === 0;

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onSelectionChange(selectedValues.filter((v) => v !== val));
    } else {
      onSelectionChange([...selectedValues, val]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange([]);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange([]);
  };

  // Button Trigger Label
  const triggerLabel = React.useMemo(() => {
    if (isAllSelected) return placeholder;
    if (selectedValues.length === 1) {
      const match = options.find((o) => o.value === selectedValues[0]);
      return match ? match.label : "1 Product Selected";
    }
    return `${selectedValues.length} Products Selected`;
  }, [isAllSelected, selectedValues, options, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-xs h-9 px-3 bg-card hover:bg-muted/50 border border-input",
            className
          )}
        >
          <span className="truncate text-left flex-1 mr-2">{triggerLabel}</span>
          <div className="flex items-center gap-1 shrink-0">
            {!isAllSelected && (
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
                onClick={handleClear}
                className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-2 space-y-2" align="start">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search gas product or SKU code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground border-b pb-1.5">
          <button
            type="button"
            onClick={handleSelectAll}
            className={cn(
              "hover:text-foreground transition-colors font-medium",
              isAllSelected && "text-primary font-bold"
            )}
          >
            Select All
          </button>
          {!isAllSelected && (
            <button
              type="button"
              onClick={handleClear}
              className="text-rose-500 hover:text-rose-600 transition-colors font-medium"
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Options list */}
        <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-1">
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No matching gas products found.
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isChecked = selectedValues.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => toggleOption(opt.value)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md cursor-pointer text-xs transition-colors hover:bg-muted/60",
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
                  <span className="truncate flex-1" title={opt.label}>
                    {opt.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
