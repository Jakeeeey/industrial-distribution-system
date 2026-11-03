// components/CustomerCylinderTurnaroundFilters.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Filter bar for Customer Cylinder Turnaround Ratio (CTR) Module.
// Unified single-line layout following exact order:
// 1. Searchbar (compact quick search)
// 2. Customer (Searchable select combobox)
// 3. Branch (Searchable select combobox - restricted to Industrial Division)
// 4. CTR Grade Tier (Searchable select combobox including Unmonitored Holding)
// 5. Date Selection (Today, This week, This month, This year, Custom range)
// 6. Dynamic Date Pickers: From - To appear ONLY when "Custom range" is active.
// 7. Reset Action button.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Check, ChevronsUpDown, RotateCcw, Search, Calendar, User, Building2, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomerCylinderTurnaround } from "../providers/CustomerCylinderTurnaroundProvider";
import type { CustomerCylinderTurnaroundFilterInput, DatePresetType } from "../types/customer-cylinder-turnaround.schema";

const DATE_PRESET_OPTIONS: Array<{ value: DatePresetType; label: string }> = [
  { value: "TODAY", label: "Today" },
  { value: "THIS_WEEK", label: "This Week" },
  { value: "THIS_MONTH", label: "This Month" },
  { value: "THIS_YEAR", label: "This Year" },
  { value: "CUSTOM", label: "Custom Range" },
];

const GRADE_OPTIONS: Array<{ value: NonNullable<CustomerCylinderTurnaroundFilterInput["grade"]>; label: string }> = [
  { value: "ALL", label: "All Grade Tiers" },
  { value: "CTR_4", label: "CTR 4 (Fastest / ₱2/kg)" },
  { value: "CTR_6", label: "CTR 6 (Standard / ₱4/kg)" },
  { value: "CTR_8", label: "CTR 8 (Moderate / ₱6/kg)" },
  { value: "SUB_STANDARD", label: "Sub-standard (>8 mos)" },
  { value: "UNMONITORED", label: "Unmonitored Holding (Base > 0, No Orders)" },
  { value: "BASE_ZERO", label: "Unrated (Base = 0)" },
];

export function CustomerCylinderTurnaroundFilters() {
  const {
    filters,
    setFilter,
    resetFilters,
    customersLookup,
    branchesLookup,
  } = useCustomerCylinderTurnaround();

  const [customerOpen, setCustomerOpen] = React.useState(false);
  const [customerSearch, setCustomerSearch] = React.useState("");

  const [branchOpen, setBranchOpen] = React.useState(false);
  const [gradeOpen, setGradeOpen] = React.useState(false);
  const [datePresetOpen, setDatePresetOpen] = React.useState(false);

  // Filtered customer list for combobox
  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch.trim()) return customersLookup.slice(0, 50);
    const q = customerSearch.toLowerCase();
    return customersLookup
      .filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q))
      )
      .slice(0, 50);
  }, [customersLookup, customerSearch]);

  const selectedCustomerLabel = React.useMemo(() => {
    if (!filters.customerCode) return "All Customers";
    const found = customersLookup.find(
      (c) => String(c.value).toLowerCase() === filters.customerCode?.toLowerCase()
    );
    return found ? found.label : filters.customerCode;
  }, [customersLookup, filters.customerCode]);

  const selectedBranchLabel = React.useMemo(() => {
    if (!filters.branchId) return "All Branches";
    const found = branchesLookup.find((b) => b.value === filters.branchId);
    return found ? found.label : "All Branches";
  }, [branchesLookup, filters.branchId]);

  const selectedGradeLabel = React.useMemo(() => {
    const found = GRADE_OPTIONS.find((g) => g.value === filters.grade);
    return found ? found.label : "All Grade Tiers";
  }, [filters.grade]);

  const selectedDatePresetLabel = React.useMemo(() => {
    const found = DATE_PRESET_OPTIONS.find((p) => p.value === filters.datePreset);
    return found ? found.label : "This Year";
  }, [filters.datePreset]);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* 1. SEARCHBAR */}
        <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search customer, code, or branch..."
            value={filters.searchQuery || ""}
            onChange={(e) => setFilter("searchQuery", e.target.value)}
            className="h-8.5 pl-8 text-xs bg-background"
          />
        </div>

        {/* 2. CUSTOMER (Searchable Combobox) */}
        <div className="w-full sm:w-[200px] md:w-[220px]">
          <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={customerOpen}
                className="h-8.5 w-full justify-between px-2.5 text-xs font-normal bg-background hover:bg-muted/50"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{selectedCustomerLabel}</span>
                </div>
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search customer name or code..."
                  value={customerSearch}
                  onValueChange={setCustomerSearch}
                  className="text-xs"
                />
                <CommandList>
                  <CommandEmpty className="p-2 text-center text-xs text-muted-foreground">
                    No customer found.
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        setFilter("customerCode", "");
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
                    {filteredCustomers.map((c) => (
                      <CommandItem
                        key={String(c.value)}
                        value={String(c.value)}
                        onSelect={() => {
                          setFilter("customerCode", String(c.value));
                          setCustomerOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            filters.customerCode === c.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col truncate">
                          <span className="font-medium">{c.label}</span>
                          {c.sublabel && (
                            <span className="text-[10px] text-muted-foreground">
                              {c.sublabel}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* 3. BRANCH (Searchable Combobox) */}
        <div className="w-full sm:w-[170px] md:w-[190px]">
          <Popover open={branchOpen} onOpenChange={setBranchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={branchOpen}
                className="h-8.5 w-full justify-between px-2.5 text-xs font-normal bg-background hover:bg-muted/50"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{selectedBranchLabel}</span>
                </div>
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search branch..." className="text-xs" />
                <CommandList>
                  <CommandEmpty className="p-2 text-center text-xs text-muted-foreground">
                    No branch found.
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        setFilter("branchId", "");
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
                      All Branches
                    </CommandItem>
                    {branchesLookup.map((b) => (
                      <CommandItem
                        key={String(b.value)}
                        value={String(b.value)}
                        onSelect={() => {
                          setFilter("branchId", Number(b.value));
                          setBranchOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            filters.branchId === b.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {b.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* 4. CTR GRADE TIER (Searchable Combobox) */}
        <div className="w-full sm:w-[170px] md:w-[180px]">
          <Popover open={gradeOpen} onOpenChange={setGradeOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={gradeOpen}
                className="h-8.5 w-full justify-between px-2.5 text-xs font-normal bg-background hover:bg-muted/50"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Award className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{selectedGradeLabel}</span>
                </div>
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search grade..." className="text-xs" />
                <CommandList>
                  <CommandGroup>
                    {GRADE_OPTIONS.map((g) => (
                      <CommandItem
                        key={g.value}
                        value={g.value}
                        onSelect={() => {
                          setFilter("grade", g.value);
                          setGradeOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            filters.grade === g.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {g.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* 5. DATE SELECTION (Today, This week, This month, This year, Custom range) */}
        <div className="w-full sm:w-[150px] md:w-[160px]">
          <Popover open={datePresetOpen} onOpenChange={setDatePresetOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={datePresetOpen}
                className="h-8.5 w-full justify-between px-2.5 text-xs font-normal bg-background hover:bg-muted/50"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{selectedDatePresetLabel}</span>
                </div>
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search date preset..." className="text-xs" />
                <CommandList>
                  <CommandGroup>
                    {DATE_PRESET_OPTIONS.map((p) => (
                      <CommandItem
                        key={p.value}
                        value={p.value}
                        onSelect={() => {
                          setFilter("datePreset", p.value);
                          setDatePresetOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            filters.datePreset === p.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {p.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* 6. DYNAMIC DATE PICKERS (Appears ONLY on "Custom Range") */}
        {filters.datePreset === "CUSTOM" && (
          <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">From:</span>
              <Input
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => setFilter("startDate", e.target.value)}
                className="h-8.5 w-[130px] text-xs px-2 bg-background"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">To:</span>
              <Input
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => setFilter("endDate", e.target.value)}
                className="h-8.5 w-[130px] text-xs px-2 bg-background"
              />
            </div>
          </div>
        )}

        {/* 7. RESET BUTTON */}
        <Button
          variant="ghost"
          size="icon"
          onClick={resetFilters}
          title="Reset Filters"
          className="h-8.5 w-8.5 text-muted-foreground hover:text-foreground shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
