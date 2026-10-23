// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/components/SmoothSearchableSelect.tsx
// ==============================================================================
// Smooth Searchable Select Combobox with Framer Motion.
// Provides fluid opening/closing transitions for dropdowns, rotating chevrons,
// and instant keyboard/filter navigation for branches, customers, and products.
//
// Complies with Vertex IDS UI standards:
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
  // Controlled open state for coordinating Framer Motion animations
  const [open, setOpen] = React.useState(false);

  // Active label lookup
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
          {/* Framer motion rotation on dropdown chevron */}
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
        {/* Animated dropdown container for smooth open/close expansion */}
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
              className="h-9 text-xs"
            />
            <CommandList className="max-h-60 overflow-y-auto text-xs">
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                No matching results.
              </CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const isSelected = value === opt.value;
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => {
                        onValueChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between py-1.5 px-2.5 text-xs cursor-pointer rounded-sm hover:bg-accent transition-colors",
                        isSelected && "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      <Check
                        className={cn(
                          "ml-2 h-3.5 w-3.5 shrink-0 transition-opacity",
                          isSelected ? "opacity-100 text-primary" : "opacity-0"
                        )}
                      />
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
