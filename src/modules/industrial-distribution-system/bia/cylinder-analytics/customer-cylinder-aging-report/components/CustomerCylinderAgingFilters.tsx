// components/CustomerCylinderAgingFilters.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Filter bar for Customer Cylinder Aging Report.
// 1. Single-row responsive layout using a proportional 12-column grid without gaps.
// 2. Virtual windowing for Customer combobox (displays top 100 choices with instant client search).
// 3. Debounced threshold and search inputs for lag-free performance.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ChevronsUpDown, RotateCcw, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";
import type { AgingBucketType } from "../types/customer-cylinder-aging.types";

export function CustomerCylinderAgingFilters() {
  const { filters, updateFilter, resetFilters, lookups } =
    useCustomerCylinderAging();

  const [customerOpen, setCustomerOpen] = React.useState(false);
  const [customerSearch, setCustomerSearch] = React.useState("");

  const [branchOpen, setBranchOpen] = React.useState(false);
  const [productOpen, setProductOpen] = React.useState(false);

  // Local threshold for instant responsiveness with debounced propagation
  const [localThreshold, setLocalThreshold] = React.useState<number>(
    filters.agingThreshold ?? 30
  );

  React.useEffect(() => {
    setLocalThreshold(filters.agingThreshold ?? 30);
  }, [filters.agingThreshold]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localThreshold !== filters.agingThreshold) {
        updateFilter("agingThreshold", localThreshold);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [localThreshold, filters.agingThreshold, updateFilter]);

  const selectedCustomer = lookups?.customers.find(
    (c) => c.value === filters.customerCode
  );
  const selectedBranch = lookups?.branches.find(
    (b) => b.value === String(filters.branchId)
  );
  const selectedProduct = lookups?.products.find(
    (p) => p.value === String(filters.productId)
  );

  // Windowed Customer list: renders top 100 matching results
  const displayedCustomers = React.useMemo(() => {
    const list = lookups?.customers || [];
    if (!customerSearch.trim()) {
      return list.slice(0, 100);
    }
    const q = customerSearch.trim().toLowerCase();
    const filtered = list.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q))
    );
    return filtered.slice(0, 100);
  }, [lookups?.customers, customerSearch]);

  const totalMatchingCustomers = React.useMemo(() => {
    const list = lookups?.customers || [];
    if (!customerSearch.trim()) return list.length;
    const q = customerSearch.trim().toLowerCase();
    return list.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q))
    ).length;
  }, [lookups?.customers, customerSearch]);

  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4 shadow-2xs space-y-3">
      {/* ── Filter Bar Header ── */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-primary" />
          <span>Report Cutoff & Filters</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset Filters</span>
        </Button>
      </div>

      {/* ── Seamless Proportional Single-Row Grid (12-Columns, Zero Gap Imbalance) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-2 sm:gap-2.5 items-end">
        {/* 1. Cutoff Date (2 Cols) */}
        <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium block truncate">
            Cutoff Date
          </Label>
          <Input
            type="date"
            value={filters.asOfDate || ""}
            onChange={(e) => updateFilter("asOfDate", e.target.value)}
            className="h-8.5 text-xs w-full"
          />
        </div>

        {/* 2. Customer Select (3 Cols - Wider for clean name rendering) */}
        <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-3 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium block truncate">
            Customer
          </Label>
          <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={customerOpen}
                className="w-full h-8.5 justify-between text-xs px-2.5 font-normal truncate bg-background hover:bg-muted/50"
              >
                <span className="truncate">
                  {selectedCustomer ? selectedCustomer.label : "All Customers"}
                </span>
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search customer name or code..."
                  value={customerSearch}
                  onValueChange={setCustomerSearch}
                  className="h-9 text-xs"
                />
                <CommandList className="max-h-60">
                  <CommandEmpty>No customer accounts found.</CommandEmpty>
                  <CommandGroup
                    heading={
                      customerSearch
                        ? `Matches: ${totalMatchingCustomers} (showing top 100)`
                        : `All Customers (showing first 100 of ${(lookups?.customers || []).length})`
                    }
                  >
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        updateFilter("customerCode", "");
                        setCustomerOpen(false);
                      }}
                      className="text-xs"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          !filters.customerCode ? "opacity-100" : "opacity-0"
                        )}
                      />
                      All Customers
                    </CommandItem>
                    {displayedCustomers.map((c) => (
                      <CommandItem
                        key={c.value}
                        value={c.value}
                        onSelect={() => {
                          updateFilter("customerCode", c.value);
                          setCustomerOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            filters.customerCode === c.value
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="truncate">{c.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* 3. Operating Branch Select (2 Cols) */}
        <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium block truncate">
            Operating Branch
          </Label>
          <Popover open={branchOpen} onOpenChange={setBranchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={branchOpen}
                className="w-full h-8.5 justify-between text-xs px-2.5 font-normal truncate bg-background hover:bg-muted/50"
              >
                <span className="truncate">
                  {selectedBranch
                    ? selectedBranch.label
                    : "All Authorized Branches"}
                </span>
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search branch name..."
                  className="h-9 text-xs"
                />
                <CommandList>
                  <CommandEmpty>No branch found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        updateFilter("branchId", "");
                        setBranchOpen(false);
                      }}
                      className="text-xs"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          !filters.branchId ? "opacity-100" : "opacity-0"
                        )}
                      />
                      All Authorized Branches
                    </CommandItem>
                    {(lookups?.branches || []).map((b) => (
                      <CommandItem
                        key={b.value}
                        value={`${b.label} ${b.code}`}
                        onSelect={() => {
                          updateFilter("branchId", Number(b.value));
                          setBranchOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            Number(filters.branchId) === Number(b.value)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="truncate">{b.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* 4. Gas Product Select (2 Cols - Serialized Cylinders Only) */}
        <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium block truncate">
            Gas Product
          </Label>
          <Popover open={productOpen} onOpenChange={setProductOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={productOpen}
                className="w-full h-8.5 justify-between text-xs px-2.5 font-normal truncate bg-background hover:bg-muted/50"
              >
                <span className="truncate">
                  {selectedProduct ? selectedProduct.label : "All Products"}
                </span>
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search cylinder gas product..."
                  className="h-9 text-xs"
                />
                <CommandList>
                  <CommandEmpty>No cylinder product found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        updateFilter("productId", "");
                        setProductOpen(false);
                      }}
                      className="text-xs"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          !filters.productId ? "opacity-100" : "opacity-0"
                        )}
                      />
                      All Products
                    </CommandItem>
                    {(lookups?.products || []).map((p) => (
                      <CommandItem
                        key={p.value}
                        value={`${p.label} ${p.code}`}
                        onSelect={() => {
                          updateFilter("productId", Number(p.value));
                          setProductOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            Number(filters.productId) === Number(p.value)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="truncate">{p.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* 5. Aging Bucket Selector (2 Cols) */}
        <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium block truncate">
            Aging Bucket
          </Label>
          <Select
            value={filters.agingBucket || "ALL"}
            onValueChange={(val) =>
              updateFilter(
                "agingBucket",
                val as AgingBucketType | "ALL" | "OVERDUE_ONLY"
              )
            }
          >
            <SelectTrigger className="h-8.5 text-xs w-full bg-background">
              <SelectValue placeholder="All Buckets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">
                All Buckets
              </SelectItem>
              <SelectItem
                value="OVERDUE_ONLY"
                className="text-xs font-semibold text-rose-600 dark:text-rose-400"
              >
                Overdue Only (&gt; Threshold)
              </SelectItem>
              <SelectItem value="0_15_DAYS" className="text-xs">
                0 – 15 Days
              </SelectItem>
              <SelectItem value="16_30_DAYS" className="text-xs">
                16 – 30 Days
              </SelectItem>
              <SelectItem value="31_60_DAYS" className="text-xs">
                31 – 60 Days
              </SelectItem>
              <SelectItem value="61_90_DAYS" className="text-xs">
                61 – 90 Days
              </SelectItem>
              <SelectItem value="90_PLUS_DAYS" className="text-xs">
                90+ Days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 6. Aging Threshold Input (1 Col - Compact Stepper) */}
        <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-1 space-y-1">
          <Label className="text-[11px] text-muted-foreground font-medium block truncate" title="Days before flagged as overdue">
            Threshold (d)
          </Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={localThreshold}
            onChange={(e) =>
              setLocalThreshold(parseInt(e.target.value, 10) || 30)
            }
            className="h-8.5 text-xs text-center w-full px-1"
          />
        </div>
      </div>
    </div>
  );
}
