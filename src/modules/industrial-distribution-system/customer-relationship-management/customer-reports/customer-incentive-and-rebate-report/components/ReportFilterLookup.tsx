"use client";

// ============================================================
// ReportFilterLookup.tsx
// Server-backed typeahead for one multi-select filter. The shared
// SearchableSelect only filters the options it is given, which cannot work
// against a customer master of this size — typing has to reach the database.
//
// The list is always one page of the search result, so the three actions under
// the search bar say what they touch: "Select all" and "Unselect all" act on
// what is shown, only "Clear" acts on the whole selection. An empty selection
// always means "everything", never "nothing".
// ============================================================

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  useIncentiveFilterOptions,
  type ReportLookupKind,
} from "../hooks/useIncentiveFilterOptions";
import type { ReportLookupOption } from "../types/customer-incentive.types";

export interface ReportFilterLookupProps {
  id: string;
  label: string;
  kind: ReportLookupKind;
  /** Text shown on the trigger while nothing is picked, e.g. "All branches". */
  allLabel: string;
  /** Picked options, kept in the order the reader chose them. */
  selected: ReportLookupOption[];
  onChange(next: ReportLookupOption[]): void;
  disabled?: boolean;
}

/**
 * Trigger text: displays the all-label when empty, or the first selected item's label.
 * The extra '+N more' count beside the first filter item is removed to avoid duplicate
 * count indicators, as the total count is now displayed exclusively in the right-aligned badge.
 */
function triggerText(selected: ReportLookupOption[], allLabel: string): string {
  if (selected.length === 0) return allLabel;
  return selected[0].label;
}

export function ReportFilterLookup({
  id,
  label,
  kind,
  allLabel,
  selected,
  onChange,
  disabled = false,
}: ReportFilterLookupProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  // Nothing is searched until the reader opens the picker — the filter card
  // states that the database has not been read yet, and option lists fetched
  // on mount would make that untrue.
  const [hasOpened, setHasOpened] = React.useState(false);
  const { options, isLoading, error } = useIncentiveFilterOptions(
    kind,
    term,
    hasOpened
  );

  const picked = React.useMemo(
    () => new Set(selected.map((option) => option.value)),
    [selected]
  );

  const toggle = (option: ReportLookupOption): void => {
    // Keeping the popover open is the point of a multi-select: a reader picks
    // a branch, then a second, without reopening the search each time.
    onChange(
      picked.has(option.value)
        ? selected.filter((item) => item.value !== option.value)
        : [...selected, option]
    );
  };

  const addAllShown = (): void => {
    const extra = options.filter((option) => !picked.has(option.value));
    if (extra.length === 0) return;
    onChange([...selected, ...extra]);
  };

  const removeAllShown = (): void => {
    const shown = new Set(options.map((option) => option.value));
    onChange(selected.filter((option) => !shown.has(option.value)));
  };

  const shownSelected = options.filter((option) =>
    picked.has(option.value)
  ).length;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setHasOpened(true);
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              selected.length === 0 && "text-muted-foreground"
            )}
          >
            {/* First selected filter label (without inline duplicate count), truncated on overflow */}
            <span className="truncate text-left">{triggerText(selected, allLabel)}</span>
            {/* Filter count badge and chevron icons grouped and justified to the right / end */}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
              {selected.length > 0 ? (
                <Badge
                  variant="secondary"
                  className="rounded-full px-1.5 text-[10px] tabular-nums"
                >
                  {selected.length}
                </Badge>
              ) : null}
              <ChevronsUpDown
                aria-hidden="true"
                className="size-4 opacity-50"
              />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[280px] p-0"
          align="start"
        >
          {/* The list is already the server's answer, so cmdk must not re-filter it. */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${label.toLowerCase()}...`}
              value={term}
              onValueChange={setTerm}
            />

            <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={addAllShown}
                disabled={
                  isLoading ||
                  Boolean(error) ||
                  options.length === 0 ||
                  shownSelected === options.length
                }
                title="Add every option in the list below to the selection"
              >
                Select all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={removeAllShown}
                disabled={shownSelected === 0}
                title="Remove the options in the list below from the selection"
              >
                Unselect all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-muted-foreground"
                onClick={() => onChange([])}
                disabled={selected.length === 0}
                title="Drop the whole selection and go back to all options"
              >
                Clear
              </Button>
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                {selected.length === 0 ? "all" : `${selected.length} picked`}
              </span>
            </div>

            <CommandList>
              {isLoading ? (
                <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Loading options…
                </div>
              ) : error ? (
                <div className="px-3 py-4 text-xs text-destructive">{error}</div>
              ) : (
                <CommandGroup>
                  {options.length === 0 ? (
                    <CommandEmpty>No matches found.</CommandEmpty>
                  ) : (
                    <>
                      {options.slice(0, 300).map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => toggle(option)}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              picked.has(option.value) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {option.label}
                        </CommandItem>
                      ))}
                      {options.length > 300 ? (
                        <div className="border-t py-2 text-center text-[10px] text-muted-foreground">
                          Showing first 300 of {options.length} options. Type to narrow down.
                        </div>
                      ) : null}
                    </>
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
