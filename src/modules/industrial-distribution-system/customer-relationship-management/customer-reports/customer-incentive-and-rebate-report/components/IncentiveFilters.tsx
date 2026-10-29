"use client";

// ============================================================
// IncentiveFilters.tsx
// Draft filters only — nothing is read until Apply, so a half-changed
// window never flashes a partial answer in the table. The panel carries no
// readout of the applied filters; the table header already states them.
// The five master-data pickers are multi-selects; an empty selection always
// means "everything", never "nothing".
// ============================================================

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Info,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCustomerIncentiveReport } from "../hooks/useCustomerIncentiveReport";
import type { ReportLookupKind } from "../hooks/useIncentiveFilterOptions";
import {
  getPeriodPreset,
  isSameSelection,
  resolveSizeKg,
  type ReportPeriodPreset,
} from "../services/customer-incentive.helpers";
import {
  CLAIM_STATUS_LABELS,
  type AppliedFilterContext,
  type ClaimStatus,
  type ReportLookupOption,
} from "../types/customer-incentive.types";
import { ReportFilterLookup } from "./ReportFilterLookup";

const ALL_STATUS = "ALL";

const PERIOD_PRESETS: { key: ReportPeriodPreset; label: string }[] = [
  { key: "thisQuarter", label: "This quarter" },
  { key: "lastQuarter", label: "Last quarter" },
  { key: "thisMonth", label: "This month" },
  { key: "last30", label: "Last 30 days" },
  { key: "yearToDate", label: "Year to date" },
];

// One entry per master-data picker. `idKey` is what the request is filtered
// by; `labelKey` only decorates the trigger, so it is never compared.
type ListKey =
  | "branchIds"
  | "customerCodes"
  | "salesmanIds"
  | "classificationIds"
  | "categoryIds";

type LabelKey =
  | "branchLabels"
  | "customerLabels"
  | "salesmanLabels"
  | "classificationLabels"
  | "categoryLabels";

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
    id: "cir-branch",
    label: "Branch",
    kind: "branches",
    allLabel: "All branches",
    idKey: "branchIds",
    labelKey: "branchLabels",
  },
  {
    id: "cir-customer",
    label: "Customer",
    kind: "customers",
    allLabel: "All customers",
    idKey: "customerCodes",
    labelKey: "customerLabels",
  },
  {
    id: "cir-salesman",
    label: "Salesman",
    kind: "salesmen",
    allLabel: "All salesmen",
    idKey: "salesmanIds",
    labelKey: "salesmanLabels",
  },
  {
    id: "cir-classification",
    label: "Classification",
    kind: "classifications",
    allLabel: "All classifications",
    idKey: "classificationIds",
    labelKey: "classificationLabels",
  },
  {
    id: "cir-category",
    label: "Cylinder Weight Category",
    kind: "categories",
    allLabel: "Any weight category",
    idKey: "categoryIds",
    labelKey: "categoryLabels",
  },
];

function valuesOf(
  filters: AppliedFilterContext,
  picker: PickerDef
): (string | number)[] {
  return filters[picker.idKey] ?? [];
}

function labelsOf(filters: AppliedFilterContext, picker: PickerDef): string[] {
  return filters[picker.labelKey] ?? [];
}

/**
 * The picker is rebuilt from the id list plus its parallel label list, so a
 * selection survives Apply, a collapse and a reload without the option master
 * being in memory.
 */
function selectedOf(
  filters: AppliedFilterContext,
  picker: PickerDef
): ReportLookupOption[] {
  const values = valuesOf(filters, picker);
  const labels = labelsOf(filters, picker);
  return values.map((value, index) => ({
    value: String(value),
    label: labels[index] || String(value),
  }));
}

/**
 * Writes both parallel lists back. Customer codes stay text because that is
 * what the schema and Directus compare; a category keeps its code as the label
 * because the export file name is built from it.
 */
function selectionPatch(
  picker: PickerDef,
  options: ReportLookupOption[]
): Partial<AppliedFilterContext> {
  const labels = options.map((option) =>
    picker.idKey === "categoryIds" ? option.code ?? option.label : option.label
  );
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
    case "categoryIds":
      return {
        categoryIds: options.map((option) => Number(option.value)),
        categoryLabels: labels,
      };
  }
}

// Dates, claim status and the five selection lists decide what is read. The
// label lists only decorate the triggers, so comparing them would report a
// change that is not one.
function isDirty(
  draft: AppliedFilterContext,
  applied: AppliedFilterContext | null
): boolean {
  if (!applied) return true;
  if (
    draft.startDate !== applied.startDate ||
    draft.endDate !== applied.endDate ||
    draft.claimStatus !== applied.claimStatus ||
    (draft.sizeKg ?? 0) !== (applied.sizeKg ?? 0)
  ) {
    return true;
  }
  return PICKERS.some(
    (picker) =>
      !isSameSelection(draft[picker.idKey], applied[picker.idKey])
  );
}

export function IncentiveFilters(): React.ReactElement {
  const {
    draftFilters,
    appliedFilters,
    setDraftFilters,
    applyFilters,
    resetFilters,
    isInitialLoading,
    isRefreshing,
  } = useCustomerIncentiveReport();
  // Open on first paint: choosing the period is the entry point of this
  // report, and collapsing is one click away once the window is set.
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

          <div className="flex min-w-0 items-center gap-1.5">
            {pending ? (
              <>
                <Badge variant="secondary" className="text-[11px]">
                  {appliedFilters ? "Changes not applied" : "Form not applied yet"}
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
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
              <span className="mr-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Quick period
              </span>
              <span className="mr-0.5 h-4 w-px bg-border" aria-hidden="true" />
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

            <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="cir-start-date">Start date</Label>
                <Input
                  id="cir-start-date"
                  type="date"
                  required
                  value={draftFilters.startDate}
                  max={draftFilters.endDate}
                  onChange={(event) => patch({ startDate: event.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cir-end-date">End date / cutoff</Label>
                <Input
                  id="cir-end-date"
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
                  onChange={(options) => patch(selectionPatch(picker, options))}
                  disabled={isLoading}
                />
              ))}

              <div className="space-y-1.5">
                <Label htmlFor="cir-claim-status">Claim status</Label>
                <Select
                  value={draftFilters.claimStatus ?? ALL_STATUS}
                  onValueChange={(next) =>
                    patch({
                      claimStatus:
                        next === ALL_STATUS
                          ? undefined
                          : (next as ClaimStatus | undefined),
                    })
                  }
                >
                  <SelectTrigger id="cir-claim-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STATUS}>Any status</SelectItem>
                    {(
                      Object.entries(CLAIM_STATUS_LABELS) as [
                        ClaimStatus,
                        string,
                      ][]
                    ).map(([status, label]) => (
                      <SelectItem key={status} value={status}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Collapsible className="group/filter-notes border-t pt-2.5">
              <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                <Info aria-hidden="true" className="size-3.5" />
                How these filters decide the figures
                <ChevronDown
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-data-[state=open]/filter-notes:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-x-6 gap-y-2 pt-2 text-[11px] leading-4 text-muted-foreground sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-foreground">
                      Claim status
                    </span>{" "}
                    reads the customer&rsquo;s most advanced claim, so one
                    holding both an Approved and a For Review memo appears under
                    Approved. Released states follow the money, because the memo
                    flow never writes them.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Eligible cylinder category
                    </span>{" "}
                    comes from industrial category names, because a serialized
                    cylinder commonly stores 0 in its weight column. Pick several
                    to value them in one pass; each counted unit keeps the size of
                    its own category. With none picked, any product of the default
                    kg counts. Leaving a picker empty always means
                    &ldquo;everything&rdquo;, never &ldquo;nothing&rdquo;. The
                    master keeps no dated history, so a closed quarter is measured
                    against today&rsquo;s categories and rates.
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-medium text-foreground">Branch</span>{" "}
                    narrows the sales evidence to what you select. The platform
                    stores no per-user branch grants, so access to this module is
                    the only enforced gate.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFilters}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Reset form
                </Button>
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
                  {appliedFilters ? "Apply filters" : "Load report"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
