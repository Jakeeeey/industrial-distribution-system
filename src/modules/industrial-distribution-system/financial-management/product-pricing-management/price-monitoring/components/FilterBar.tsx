"use client";

// =============================================================================
// Price Monitoring — FilterBar Component
// Layer  : components (UI only — receives callbacks, no state)
// Spec   : §8.1 Required Screen Controls
// =============================================================================

import * as React from "react";
import { Search, RefreshCw, X, Loader2, Download, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PriceMonitoringQuery } from "../types";
import type { ProductOption, SupplierOption } from "../providers/priceMonitoringApi";
import { fetchProductOptions } from "../providers/priceMonitoringApi";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FilterBarProps {
  query: PriceMonitoringQuery;
  onQueryChange: (updates: Partial<PriceMonitoringQuery>) => void;
  onApply: () => void;
  onClear: () => void;
  onExport?: () => void;
  hasData?: boolean;
  loading: boolean;
  suppliers: SupplierOption[];
  /** Set to true after an Apply attempt with no product selected. */
  showProductError?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FilterBar — product selector (required) + supplier selector (optional).
 * Apply button calls onApply; Clear resets both filters.
 * Product search is debounced async (uses fetchProductOptions).
 */
export function FilterBar({
  query,
  onQueryChange,
  onApply,
  onClear,
  onExport,
  hasData = false,
  loading,
  suppliers,
  showProductError = false,
}: FilterBarProps) {
  // Product async search state
  const [productSearch, setProductSearch] = React.useState("");
  const [productOptions, setProductOptions] = React.useState<ProductOption[]>([]);
  const [productSearching, setProductSearching] = React.useState(false);

  // Debounce product search — 350ms
  React.useEffect(() => {
    let active = true;

    if (productSearch.trim().length < 1) {
      setProductSearching(true);
      fetchProductOptions("", 100)
        .then((results) => {
          if (active) {
            setProductOptions(results);
          }
        })
        .catch(() => {
          if (active) {
            setProductOptions([]);
          }
        })
        .finally(() => {
          if (active) {
            setProductSearching(false);
          }
        });
      return () => {
        active = false;
      };
    }

    const timer = setTimeout(async () => {
      setProductSearching(true);
      try {
        const results = await fetchProductOptions(productSearch, 100);
        if (active) {
          setProductOptions(results);
        }
      } catch {
        if (active) {
          setProductOptions([]);
        }
      } finally {
        if (active) {
          setProductSearching(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productSearch]);

  // Build option list for the product select.
  // If a product is already selected, include it in options so it shows the label.
  const productSelectOptions = React.useMemo(() => {
    const opts = productOptions.map((p) => ({
      value: String(p.product_id),
      label: p.product_code
        ? `${p.product_code} — ${p.product_name}`
        : p.product_name,
    }));

    // If selected product is not in search results, add a stub entry so the
    // control still shows the label instead of the raw ID.
    if (
      query.productId &&
      !opts.find((o) => o.value === String(query.productId))
    ) {
      opts.unshift({
        value: String(query.productId),
        label: query.productLabel ?? `Product #${query.productId}`,
      });
    }

    return opts;
  }, [productOptions, query.productId, query.productLabel]);

  // Build supplier options
  const supplierSelectOptions = React.useMemo(
    () => [
      { value: "", label: "All Suppliers" },
      ...suppliers.map((s) => ({
        value: String(s.id),
        label: s.supplier_shortcut
          ? `${s.supplier_shortcut} — ${s.supplier_name}`
          : s.supplier_name,
      })),
    ],
    [suppliers],
  );

  const handleProductChange = (val: string) => {
    if (!val) {
      onQueryChange({ productId: "", productCode: null, productLabel: null });
      return;
    }
    const id = Number(val);
    const found = productOptions.find((p) => p.product_id === id);
    onQueryChange({
      productId: id,
      productCode: found?.product_code ?? null,
      productLabel: found
        ? found.product_code
          ? `${found.product_code} — ${found.product_name}`
          : found.product_name
        : `Product #${id}`,
    });
  };

  const handleSupplierChange = (val: string) => {
    if (!val) {
      onQueryChange({ supplierId: "", supplierLabel: null });
      return;
    }
    const id = Number(val);
    const found = suppliers.find((s) => s.id === id);
    onQueryChange({
      supplierId: id,
      supplierLabel: found?.supplier_name ?? `Supplier #${id}`,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Filter controls row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
        {/* Product selector (required) */}
        <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[280px] sm:max-w-[380px]">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Search className="h-3 w-3" />
            Product
            <span className="text-destructive ml-0.5">*</span>
          </label>
          {/* Custom async-search product combobox */}
          <div className="relative">
            <SearchableCombobox
              placeholder="Search product code or name..."
              value={query.productId ? String(query.productId) : ""}
              options={productSelectOptions}
              onSearch={setProductSearch}
              onValueChange={handleProductChange}
              searching={productSearching}
              className={cn(showProductError && !query.productId && "ring-2 ring-destructive")}
            />
          </div>
        </div>

        {/* Supplier selector (optional) */}
        <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[220px] sm:max-w-[320px]">
          <label className="text-xs font-medium text-muted-foreground">
            Supplier <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <SearchableSelect
            options={supplierSelectOptions}
            value={query.supplierId ? String(query.supplierId) : ""}
            onValueChange={handleSupplierChange}
            placeholder="All Suppliers"
          />
        </div>

        {/* Date From (optional) */}
        <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[170px] sm:max-w-[220px]">
          <label className="text-xs font-medium text-muted-foreground">
            Date From <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !query.dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <span className="truncate">
                  {query.dateFrom ? format(query.dateFrom, "MMM d, yyyy") : "Pick date from"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={query.dateFrom}
                onSelect={(date) => onQueryChange({ dateFrom: date ?? undefined })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Date To (optional) */}
        <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[170px] sm:max-w-[220px]">
          <label className="text-xs font-medium text-muted-foreground">
            Date To <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !query.dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <span className="truncate">
                  {query.dateTo ? format(query.dateTo, "MMM d, yyyy") : "Pick date to"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={query.dateTo}
                onSelect={(date) => onQueryChange({ dateTo: date ?? undefined })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 sm:ml-2 sm:self-end pb-0.5">
          <Button
            id="price-monitoring-apply"
            onClick={onApply}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Apply
          </Button>

          <Button
            id="price-monitoring-clear"
            variant="outline"
            onClick={onClear}
            disabled={loading}
            className="gap-1.5"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>

        {/* Export Excel button (aligned to the far right on larger screens) */}
        {hasData && onExport && (
          <div className="sm:ml-auto sm:self-end pb-0.5">
            <Button
              id="price-monitoring-export"
              variant="outline"
              onClick={onExport}
              disabled={loading}
              className="gap-1.5 border-emerald-600/30 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        )}
      </div>

      {/* Active filter badges */}
      {(query.productId || query.supplierId || query.dateFrom || query.dateTo) && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {query.productId && (
            <Badge variant="secondary" className="text-xs gap-1">
              Product: {query.productLabel ?? `#${query.productId}`}
              <button
                aria-label="Remove product filter"
                onClick={() =>
                  onQueryChange({ productId: "", productCode: null, productLabel: null })
                }
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {query.supplierId && (
            <Badge variant="secondary" className="text-xs gap-1">
              Supplier: {query.supplierLabel ?? `#${query.supplierId}`}
              <button
                aria-label="Remove supplier filter"
                onClick={() =>
                  onQueryChange({ supplierId: "", supplierLabel: null })
                }
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {query.dateFrom && (
            <Badge variant="secondary" className="text-xs gap-1">
              From: {query.dateFrom.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              <button
                aria-label="Remove date from filter"
                onClick={() =>
                  onQueryChange({ dateFrom: undefined })
                }
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {query.dateTo && (
            <Badge variant="secondary" className="text-xs gap-1">
              To: {query.dateTo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              <button
                aria-label="Remove date to filter"
                onClick={() =>
                  onQueryChange({ dateTo: undefined })
                }
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async-searchable combobox (local to this component)
// Built on top of the existing shadcn Command/Popover pattern but adds an
// onSearch callback so the parent can debounce async calls.
// ---------------------------------------------------------------------------

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

interface SearchableComboboxProps {
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  onSearch: (q: string) => void;
  searching?: boolean;
  placeholder?: string;
  className?: string;
}

function SearchableCombobox({
  options,
  value,
  onValueChange,
  onSearch,
  searching,
  placeholder = "Search...",
  className,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 "
        style={{
          minWidth: "var(--radix-popover-trigger-width)",
          width: "max-content",
        }}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            onValueChange={(q) => onSearch(q)}
          />
          <CommandList>
            {searching ? (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>Type to search products.</CommandEmpty>
            ) : (
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={(val) => {
                      onValueChange(val === value ? "" : val);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
