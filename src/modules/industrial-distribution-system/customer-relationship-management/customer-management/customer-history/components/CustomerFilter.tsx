"use client";

import React, { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronsUpDown, Check, User2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomerHistoryData } from "../types";
import { Badge } from "@/components/ui/badge";

interface CustomerSelectorProps {
  customers: CustomerHistoryData[];
  selected: CustomerHistoryData | null;
  onSelect: (customer: CustomerHistoryData) => void;
  disabled?: boolean;
}

interface CustomerFilterProps {
  customers: CustomerHistoryData[];
  selected: CustomerHistoryData | null;
  onSelect: (customer: CustomerHistoryData) => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

const TIER_COLORS: Record<string, string> = {
  Commercial: "bg-blue-500/10 text-blue-600 border-blue-200",
  "Walk-in": "bg-green-500/10 text-green-600 border-green-200",
  "Retail Trade Outlet": "bg-purple-500/10 text-purple-600 border-purple-200",
  RTO: "bg-purple-500/10 text-purple-600 border-purple-200",
  Retail: "bg-purple-500/10 text-purple-600 border-purple-200",
  Residential: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  Dealer: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  "Sub-Dealer": "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  Unclassified: "bg-muted text-muted-foreground border-border",
};

export function CustomerFilter({
  customers,
  selected,
  onSelect,
  loading,
  disabled,
  label = "Target Customer:",
}: CustomerFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
      <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        {loading ? (
          <Skeleton className="h-11 w-full sm:w-95 rounded-xl" />
        ) : (
          <CustomerSelector
            customers={customers}
            selected={selected}
            onSelect={onSelect}
            disabled={disabled || loading}
          />
        )}
      </div>
    </div>
  );
}

export function CustomerSelector({
  customers,
  selected,
  onSelect,
  disabled,
}: CustomerSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild className="w-full">
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-11 w-full justify-between rounded-xl shadow-sm border-border/60 bg-background font-medium w-full"
        >
          <div className="flex items-center gap-2 min-w-0 w-full">
            <User2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate text-sm">
              {selected ? selected.name : "Select a customer..."}
            </span>
            {selected && (
              <Badge
                variant="outline"
                className={cn(
                  "ml-1 text-[10px] px-1.5 py-0 font-semibold uppercase tracking-wide shrink-0",
                  TIER_COLORS[selected.tier] ?? "",
                )}
              >
                {selected.tier}
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-0 shadow-xl rounded-xl border-border/60"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Search customer by name or ID..."
            className="h-10 text-sm"
          />
          <CommandList className=" overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No customers found.
            </CommandEmpty>
            <CommandGroup heading="Customers">
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.id}`}
                  onSelect={() => {
                    onSelect(c);
                    setOpen(false);
                  }}
                  className="cursor-pointer py-2.5"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 text-primary shrink-0",
                      selected?.id === c.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">
                      {c.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.id}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "ml-2 text-[10px] px-1.5 py-0 font-semibold uppercase tracking-wide shrink-0",
                      TIER_COLORS[c.tier] ?? "",
                    )}
                  >
                    {c.tier}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
