"use client";

// ============================================================
// CustomerOrderConsumptionFilters.tsx
// Draft filters only — nothing is read until Apply, so a half-changed
// window never flashes a partial answer in the table. The panel collapses
// to a chip summary of what is currently on screen.
// The four master-data pickers are multi-selects; an empty selection always
// means "everything", never "nothing".
// ============================================================

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import type { ReportLookupKind } from "../hooks/useConsumptionFilterOptions";
import {
  getPeriodPreset,
  isSameSelection,
  type ReportPeriodPreset,
} from "../services/customer-order-consumption.helpers";
import type {
  AppliedFilterContext,
  ConsumptionChannel,
  ReportLookupOption,
} from "../types/customer-order-consumption.types";
import { ReportFilterLookup } from "./ReportFilterLookup";

const ALL_CHANNEL = "ALL";

type ChannelChoice = ConsumptionChannel | typeof ALL_CHANNEL;

const CHANNEL_OPTIONS: { key: ChannelChoice; label: string }[] = [
  { key: ALL_CHANNEL, label: "Both channels" },
  { key: "CYLINDER", label: "Cylinder / bulk" },
  { key: "LPG", label: "Metered LPG" },
];

const PERIOD_PRESETS: { key: ReportPeriodPreset; label: string }[] = [
  { key: "last30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "thisQuarter", label: "This quarter" },
  { key: "yearToDate", label: "Year to date" },
];

const CHANNEL_LABEL: Record<ConsumptionChannel, string> = {
  CYLINDER: "Cylinder / bulk only",
  LPG: "Metered & weighed LPG only",
};

// One entry per master-data picker. `idKey` is what the request is filtered
// by; `labelKey` only decorates the chips and the trigger button.
type ListKey =
  | "branchIds"
  | "customerCodes"
  | "salesmanIds"
  | "classificationIds";

type LabelKey =
  | "branchLabels"
  | "customerLabels"
  | "salesmanLabels"
  | "classificationLabels";

interface PickerDef {
  id: string;
  label: string;
  kind: ReportLookupKind;
  allLabel: string;
  idKey: ListKey;
  labelKey: LabelKey;
}

const PICKERS: PickerDef[] = [
  {
    id: "coc-branch",
    label: "Branch",
    kind: "branches",
    allLabel: "All branches",
    idKey: "branchIds",
    labelKey: "branchLabels",
  },
  {
    id: "coc-customer",
    label: "Customer",
    kind: "customers",
    allLabel: "All customers",
    idKey: "customerCodes",
    labelKey: "customerLabels",
  },
  {
    id: "coc-salesman",
    label: "Salesman",
    kind: "salesmen",
    allLabel: "All salesmen",
    idKey: "salesmanIds",
    labelKey: "salesmanLabels",
  },
  {
    id: "coc-classification",
    label: "Classification",
    kind: "classifications",
    allLabel: "All classifications",
    idKey: "classificationIds",
    labelKey: "classificationLabels",
  },
];

function valuesOf(filters: AppliedFilterContext, picker: PickerDef): (string | number)[] {
  return filters[picker.idKey] ?? [];
}

function labelsOf(filters: AppliedFilterContext, picker: PickerDef): string[] {
  return filters[picker.labelKey] ?? [];
}

/**
 * The picker is rebuilt from the id list plus its parallel label list, so a
 * selection survives Apply, a collapse and a page reload without the option
 * master being in memory.
 */
function selectedOf(filters: AppliedFilterContext, picker: PickerDef): ReportLookupOption[] {
  const values = valuesOf(filters, picker);
  const labels = labelsOf(filters, picker);
  return values.map((value, index) => ({
    value: String(value),
    label: labels[index] || String(value),
  }));
}

/**
 * Writes both parallel lists back. Customer codes stay text because that is
 * what the schema and Directus compare; the other three are numeric ids.
 */
function selectionPatch(
  picker: PickerDef,
  options: ReportLookupOption[]
): Partial<AppliedFilterContext> {
  const labels = options.map((option) => option.label);
  switch (picker.idKey) {
    case "customerCodes":
      return {
        customerCodes: options.map((option) => option.code ?? option.value),
        customerLabels: labels,
      };
    case "branchIds":
      return {
        branchIds: options.map((option) => Number(option.value)),
        branchLabels: labels,
      };
    case "salesmanIds":
      return {
        salesmanIds: options.map((option) => Number(option.value)),
        salesmanLabels: labels,
      };
    case "classificationIds":
      return {
        classificationIds: options.map((option) => Number(option.value)),
        classificationLabels: labels,
      };
  }
}

// Dates, channel and the four selection lists decide what is read. The label
// lists only decorate the pickers, so comparing them would report a change
// that is not one.
function isDirty(draft: AppliedFilterContext, applied: AppliedFilterContext): boolean {
  if (
    draft.startDate !== applied.startDate ||
    draft.endDate !== applied.endDate ||
    draft.channel !== applied.channel
  ) {
    return true;
  }
  return PICKERS.some(
    (picker) => !isSameSelection(draft[picker.idKey], applied[picker.idKey])
  );
}

/** One chip per active picker: named when it is the only pick, counted after. */
function pickerChips(filters: AppliedFilterContext): string[] {
  const chips: string[] = [];
  for (const picker of PICKERS) {
    const values = valuesOf(filters, picker);
    if (values.length === 0) continue;
    const first = labelsOf(filters, picker)[0] || `${picker.label} ${values[0]}`;
    chips.push(values.length === 1 ? first : `${first} +${values.length - 1} more`);
  }
  return chips;
}

/** What the numbers on screen were actually filtered by. */
function chipsOf(filters: AppliedFilterContext): string[] {
  const chips = [`${filters.startDate} → ${filters.endDate}`, ...pickerChips(filters)];
  if (filters.channel) chips.push(CHANNEL_LABEL[filters.channel]);
  else chips.push("Both channels, reported separately");
  return chips;
}

export function CustomerOrderConsumptionFilters(): React.ReactElement {
  const {
    draftFilters,
    appliedFilters,
    setDraftFilters,
    applyFilters,
    clearFilters,
    isInitialLoading,
    isRefreshing,
  } = useCustomerOrderConsumptionReport();
  // Open on first paint: choosing the period and branch is the entry point of
  // this report, and collapsing is one click away once the window is set.
  const [open, setOpen] = React.useState(true);

  const isLoading = isInitialLoading || isRefreshing;

  const patch = React.useCallback(
    (next: Partial<AppliedFilterContext>): void => {
      setDraftFilters((current) => ({ ...current, ...next }));
    },
    [setDraftFilters]
  );

  const hasInvalidRange =
    !draftFilters.startDate ||
    !draftFilters.endDate ||
    draftFilters.startDate > draftFilters.endDate;

  const pending = isDirty(draftFilters, appliedFilters);

  return (
    <Card className="gap-3 border-border/80 py-3">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
          >
            {open ? (
              <ChevronDown aria-hidden="true" className="size-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-4" />
            )}
            <Filter aria-hidden="true" className="size-4 text-primary" />
            Report filters
          </button>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {chipsOf(appliedFilters).map((chip) => (
              <Badge
                key={chip}
                variant="outline"
                className="max-w-[220px] truncate text-[11px] font-normal"
              >
                {chip}
              </Badge>
            ))}
            {pending ? (
              <>
                <Badge variant="secondary" className="text-[11px]">
                  not applied yet
                </Badge>
                {!open ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void applyFilters()}
                    disabled={isLoading || hasInvalidRange}
                  >
                    Apply
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {open ? (
          <div className="space-y-4 border-t pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Quick period:</span>
              {PERIOD_PRESETS.map(({ key, label }) => {
                const preset = getPeriodPreset(key);
                const active =
                  preset.startDate === draftFilters.startDate &&
                  preset.endDate === draftFilters.endDate;
                return (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={active ? "secondary" : "outline"}
                    className="h-7 rounded-full px-3 text-xs font-normal"
                    onClick={() => patch(preset)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="space-y-1.5">
                <Label htmlFor="coc-start-date">Start date</Label>
                <Input
                  id="coc-start-date"
                  type="date"
                  required
                  value={draftFilters.startDate}
                  max={draftFilters.endDate}
                  onChange={(event) => patch({ startDate: event.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coc-end-date">End date / cutoff</Label>
                <Input
                  id="coc-end-date"
                  type="date"
                  required
                  value={draftFilters.endDate}
                  min={draftFilters.startDate}
                  aria-invalid={hasInvalidRange}
                  onChange={(event) => patch({ endDate: event.target.value })}
                />
              </div>

              {PICKERS.map((picker) => (
                <ReportFilterLookup
                  key={picker.id}
                  id={picker.id}
                  label={picker.label}
                  kind={picker.kind}
                  allLabel={picker.allLabel}
                  selected={selectedOf(draftFilters, picker)}
                  onChange={(next) => patch(selectionPatch(picker, next))}
                  disabled={isLoading}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1.5">
                <Label id="coc-channel-label" className="text-xs text-muted-foreground">
                  Demand channel
                </Label>
                <div
                  role="group"
                  aria-labelledby="coc-channel-label"
                  className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
                >
                  {CHANNEL_OPTIONS.map(({ key, label }) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={
                        (draftFilters.channel ?? ALL_CHANNEL) === key ? "secondary" : "ghost"
                      }
                      className="h-7 rounded-md px-3 text-xs"
                      aria-pressed={(draftFilters.channel ?? ALL_CHANNEL) === key}
                      onClick={() =>
                        patch({ channel: key === ALL_CHANNEL ? undefined : key })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Both channels are reported separately and never added into one
                  kilogram total — a combined figure would mix a purchase proxy
                  with measured usage.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void applyFilters()}
                  disabled={isLoading || hasInvalidRange}
                  className="gap-2"
                >
                  {isLoading ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <Search aria-hidden="true" className="size-4" />
                  )}
                  Apply filters
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void clearFilters()}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Reset
                </Button>
              </div>
            </div>

            {hasInvalidRange ? (
              <p className="text-xs text-destructive">
                Start date must be on or before the end date — an inverted window
                would report zero demand.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
