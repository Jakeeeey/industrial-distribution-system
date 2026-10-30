// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/SmoothSearchableSelect.tsx
// ==============================================================================
// Searchable combobox used by the branch and cylinder-size selectors.
// Radix Popover + Command for keyboard filtering, Framer Motion for the open/close
// transition — the same control the other BIA cylinder reports expose, so branch
// scoping behaves identically across the subsystem.
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SmoothSearchableSelectProps {
  options: { value: string; label: string }[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SmoothSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  disabled = false,
  className,
}: SmoothSearchableSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedLabel = React.useMemo(
    () => options.find((option) => option.value === value)?.label,
    [options, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between transition-all duration-150 hover:border-primary/50 focus-visible:ring-1",
            !value && "text-muted-foreground",
            open && "border-primary ring-1 ring-ring",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="ml-2 flex shrink-0 items-center"
          >
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </motion.div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[220px] border bg-popover p-0 shadow-lg"
        align="start"
        sideOffset={4}
      >
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="w-full"
        >
          <Command className="rounded-lg">
            <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} className="h-9" />
            <CommandList className="max-h-[240px] overflow-y-auto p-1">
              <CommandEmpty className="py-2.5 text-center text-xs text-muted-foreground">
                No matching option found.
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  // AG-COMMENT: Map CommandItem value uniquely using label + ID so products with identical descriptions
                  // are never triggered together by cmdk, while searching by description still works cleanly.
                  const uniqueSearchVal = `${option.label} #${option.value}`;
                  const isSelected = value === option.value;
                  return (
                    <CommandItem
                      key={option.value}
                      value={uniqueSearchVal}
                      keywords={[option.label, option.value]}
                      onSelect={() => {
                        onValueChange(option.value);
                        setOpen(false);
                      }}
                      className="flex cursor-pointer items-center justify-between rounded-md py-2 text-xs transition-colors"
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}
