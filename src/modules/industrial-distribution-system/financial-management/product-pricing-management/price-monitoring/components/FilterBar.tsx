"use client";

// =============================================================================
// Price Monitoring — FilterBar Component
// Layer  : components (UI only — receives callbacks, no state)
// Spec   : §8.1 Required Screen Controls
// =============================================================================

import * as React from "react";
import { Search, RefreshCw, X, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PriceMonitoringQuery } from "../types";
import type { ProductOption, SupplierOption } from "../providers/priceMonitoringApi";
import { fetchProductOptions } from "../providers/priceMonitoringApi";

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
  serializedAndDiv1Only: boolean;
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
  showProductError = false,
  serializedAndDiv1Only,
}: FilterBarProps) {
  const [productSearch, setProductSearch] = React.useState("");
  const [productOptions, setProductOptions] = React.useState<ProductOption[]>([]);
  const [productSearching, setProductSearching] = React.useState(false);
  const initialFetchedRef = React.useRef(false);

  // Debounce product search — 350ms
  React.useEffect(() => {
    let active = true;

    if (productSearch.trim().length < 1) {
      if (!initialFetchedRef.current) {
        setProductSearching(true);
      }
      fetchProductOptions("", 100, serializedAndDiv1Only ? 1 : undefined)
        .then((results) => {
          if (active) {
            setProductOptions(results);
            initialFetchedRef.current = true;
          }
        })
        .catch(() => {
          if (active) setProductOptions([]);
        })
        .finally(() => {
          if (active) setProductSearching(false);
        });
      return () => {
        active = false;
      };
    }

    const timer = setTimeout(async () => {
      setProductSearching(true);
      try {
        const results = await fetchProductOptions(
          productSearch,
          100,
          serializedAndDiv1Only ? 1 : undefined,
        );
        if (active) setProductOptions(results);
      } catch {
        if (active) setProductOptions([]);
      } finally {
        if (active) setProductSearching(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productSearch, serializedAndDiv1Only]);

  // Build option list for the product select
  const productSelectOptions = React.useMemo(() => {
    let filteredProducts = productOptions;
    if (serializedAndDiv1Only) {
      filteredProducts = productOptions.filter((p) => p.is_serialized === 1);
    }

    const opts = filteredProducts.map((p) => ({
      value: String(p.product_id),
      label: p.product_code
        ? `${p.product_code} — ${p.product_name}`
        : p.product_name,
    }));

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
  }, [productOptions, query.productId, query.productLabel, serializedAndDiv1Only]);

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

  return (
    <div className="flex flex-col gap-3">
      {/* Filter controls row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">

        {/* Product selector (required) — full width on mobile */}
        <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[280px] sm:max-w-[380px]">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Search className="h-3 w-3" />
            Product
            <span className="text-destructive ml-0.5">*</span>
          </label>
          <div className="relative">
            <SearchableCombobox
              placeholder="Search product code or name..."
              value={query.productId ? String(query.productId) : ""}
              options={productSelectOptions}
              onSearch={setProductSearch}
              onValueChange={handleProductChange}
              searching={productSearching}
              className={cn(
                showProductError && !query.productId && "ring-2 ring-destructive",
              )}
            />
          </div>
        </div>

        {/* Date range row — side by side on mobile, inline on desktop */}
        <div className="flex gap-2 w-full sm:w-auto sm:contents">
          {/* Date From */}
          <div className="flex flex-col gap-1 flex-1 sm:flex-none sm:w-auto sm:min-w-[130px] sm:max-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground">
              Date From
            </label>
            <input
              type="date"
              className="h-9 w-full px-3 border border-input bg-background rounded-lg text-xs font-semibold text-foreground/80 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              value={query.dateFrom || ""}
              onChange={(e) => onQueryChange({ dateFrom: e.target.value })}
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1 flex-1 sm:flex-none sm:w-auto sm:min-w-[130px] sm:max-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground">
              Date To
            </label>
            <input
              type="date"
              className="h-9 w-full px-3 border border-input bg-background rounded-lg text-xs font-semibold text-foreground/80 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              value={query.dateTo || ""}
              onChange={(e) => onQueryChange({ dateTo: e.target.value })}
            />
          </div>
        </div>

        {/* Action buttons — full width on mobile, auto on desktop */}
        <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-2 sm:self-end pb-0.5">
          <Button
            id="price-monitoring-apply"
            onClick={onApply}
            disabled={loading}
            className="gap-1.5 flex-1 sm:flex-none"
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
            className="gap-1.5 flex-1 sm:flex-none"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>

        {/* Export Excel button — full width on mobile, far right on desktop */}
        {hasData && onExport && (
          <div className="w-full sm:w-auto sm:ml-auto sm:self-end pb-0.5">
            <Button
              id="price-monitoring-export"
              variant="outline"
              onClick={onExport}
              disabled={loading}
              className="gap-1.5 w-full sm:w-auto border-emerald-600/30 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        )}
      </div>

      {/* Active filter badges */}
      {/* {(query.productId || query.supplierId || query.dateFrom || query.dateTo) && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {query.productId && (
            <Badge variant="secondary" className="text-xs gap-1">
              Product: {query.productLabel ?? `#${query.productId}`}
              <button
                aria-label="Remove product filter"
                onClick={() =>
                  onQueryChange({
                    productId: "",
                    productCode: null,
                    productLabel: null,
                  })
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
              From: {query.dateFrom}
              <button
                aria-label="Reset date from filter"
                onClick={() =>
                  onQueryChange({
                    dateFrom: `${new Date().getFullYear()}-01-01`,
                  })
                }
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {query.dateTo && (
            <Badge variant="secondary" className="text-xs gap-1">
              To: {query.dateTo}
              <button
                aria-label="Reset date to filter"
                onClick={() =>
                  onQueryChange({
                    dateTo: `${new Date().getFullYear()}-12-31`,
                  })
                }
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )} */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async-searchable combobox (local to this component)
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

  React.useEffect(() => {
    if (open) {
      onSearch("");
    }
  }, [open, onSearch]);

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
        className="p-0"
        style={{
          minWidth: "var(--radix-popover-trigger-width)",
          width: "max-content",
          maxWidth: "min(calc(100vw - 32px), 480px)",
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