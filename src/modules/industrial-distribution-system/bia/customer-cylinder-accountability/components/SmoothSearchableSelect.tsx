// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/components/SmoothSearchableSelect.tsx
// ==============================================================================
// Smooth Searchable Select Combobox with Framer Motion.
// Provides fluid opening/closing transitions for dropdowns, rotating chevrons,
// and instant keyboard/filter navigation for branches and customer lookups.
//
// Complies with VoSync Design System standards:
// - Always leave comments on all changes and development workflows
// - Accessible keyboard navigation via Radix UI & Command primitive
// - Framer Motion spring and tween transitions for premium micro-interactions
// ==============================================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

  const selectedLabel = React.useMemo(() => {
    return options.find((opt) => opt.value === value)?.label;
  }, [options, value]);

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
            className="ml-2 flex items-center shrink-0"
          >
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </motion.div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[220px] p-0 shadow-lg border bg-popover"
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
            <CommandInput
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              className="h-9"
            />
            <CommandList className="max-h-[240px] overflow-y-auto p-1">
              <CommandEmpty className="py-2.5 text-center text-xs text-muted-foreground">
                No matching option found.
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between py-2 text-xs rounded-md cursor-pointer transition-colors"
                  >
                    <span className="truncate">{option.label}</span>
                    {value === option.value && (
                      <Check className="h-4 w-4 text-primary ml-2 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}
