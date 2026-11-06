// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceFilters.tsx
// ==============================================================================
// Filter Parameter Bar for Stock Movement and Variance Report (spec §11).
// Period, branch scope, category and product. Editing these fields only moves a
// draft: the ledger is read when Apply is pressed, never before.
//
// Branch scope defaults to "All branches" — the platform has no per-user branch
// permission table, so no narrower default could honestly be called "authorised".
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Building2, CalendarDays, Filter, Package, RotateCcw, Search, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VarianceLookupOption } from "../types/stock-movement-variance.types";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";
import { SmoothSearchableSelect } from "./SmoothSearchableSelect";

/**
 * Turns a lookup list into combobox options.
 *
 * The master id is the option value — product and branch names both repeat, so
 * a name can never identify one row — and any entry missing an id or a label is
 * dropped. That also guarantees two options can never share a React key or
 * resolve to the same selection, even when the cached payload is unusual.
 */
function toOptions(
  rows: VarianceLookupOption[] | undefined
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const row of rows ?? []) {
    const value = String(row.id ?? "").trim();
    const label = String(row.label ?? "").trim();
    if (!value || !label || seen.has(value)) continue;
    seen.add(value);
    options.push({
      value,
      label: row.secondary ? `${label} (${row.secondary})` : label,
    });
  }

  return options;
}

/** Label styling shared by every field in the bar. */
function FieldLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
      <Icon className="h-3 w-3" />
      <span>{children}</span>
    </span>
  );
}

export function StockMovementVarianceFilters() {
  const {
    draft,
    setDraft,
    lookups,
    isLookingUp,
    isDirty,
    isApplyBlocked,
    isLoading,
    apply,
    reset,
    searchQuery,
    setSearchQuery,
  } = useStockMovementVarianceReport();

  /** Patch helper so each control only rewrites the key it owns. */
  const patch = React.useCallback(
    (changes: Partial<typeof draft>) => {
      setDraft((current) => ({ ...current, ...changes }));
    },
    [setDraft]
  );

  // An empty branch value is a real scope ("All branches"), not a missing one.
  const branchOptions = React.useMemo(
    () => [{ value: "", label: "All branches" }, ...toOptions(lookups?.branches)],
    [lookups]
  );

  const categoryOptions = React.useMemo(() => toOptions(lookups?.categories), [lookups]);

  // Products are keyed by master id and show `Name (CODE)`, so same-name twins
  // stay two separate, individually selectable choices.
  const productOptions = React.useMemo(() => toOptions(lookups?.products), [lookups]);

  const branchLabel =
    branchOptions.find((option) => option.value === String(draft.branchId ?? ""))?.label ??
    "All branches";

  return (
    <motion.section
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-xl border bg-card shadow-xs"
    >
      {/* ── Bar header: title, search and the two form actions ─────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <span>Report parameters</span>
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter loaded lines"
              aria-label="Filter loaded lines by product, code, branch or count document"
              className="h-8 w-44 pl-8 text-xs sm:w-56"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-[11px]"
            onClick={reset}
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </Button>

          <Button
            type="button"
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-3 text-xs",
              isDirty && "ring-1 ring-primary/40 ring-offset-1"
            )}
            onClick={apply}
            disabled={isLoading || isApplyBlocked}
          >
            <span>{isLoading ? "Reconciling…" : "Apply"}</span>
          </Button>
        </div>
      </div>

      {/* ── Parameter fields ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div>
          <FieldLabel icon={CalendarDays}>Period from</FieldLabel>
          <Input
            type="date"
            value={draft.startDate}
            max={draft.endDate}
            onChange={(event) => patch({ startDate: event.target.value })}
            className={cn(
              "h-8 text-xs",
              isApplyBlocked && "border-destructive focus-visible:ring-destructive"
            )}
          />
        </div>

        <div>
          <FieldLabel icon={CalendarDays}>Reporting cutoff</FieldLabel>
          <Input
            type="date"
            value={draft.endDate}
            min={draft.startDate}
            onChange={(event) => patch({ endDate: event.target.value })}
            className={cn(
              "h-8 text-xs",
              isApplyBlocked && "border-destructive focus-visible:ring-destructive"
            )}
          />
        </div>

        <div>
          <FieldLabel icon={Building2}>Branch</FieldLabel>
          <SmoothSearchableSelect
            options={branchOptions}
            value={String(draft.branchId ?? "")}
            onValueChange={(value) => patch({ branchId: value })}
            placeholder={isLookingUp ? "Loading branches..." : "All branches"}
            disabled={isLookingUp}
            className="h-8 text-xs"
          />
        </div>

        <div>
          <FieldLabel icon={Tags}>Category</FieldLabel>
          <SmoothSearchableSelect
            options={categoryOptions}
            value={draft.categoryId ? String(draft.categoryId) : undefined}
            onValueChange={(value) =>
              setDraft((current) => {
                const next = { ...current };
                if (value === String(current.categoryId)) delete next.categoryId;
                else next.categoryId = value;
                return next;
              })
            }
            placeholder={isLookingUp ? "Loading categories..." : "All categories"}
            disabled={isLookingUp || categoryOptions.length === 0}
            className="h-8 text-xs"
          />
        </div>

        <div>
          <FieldLabel icon={Package}>Product</FieldLabel>
          <SmoothSearchableSelect
            options={productOptions}
            value={draft.productId ? String(draft.productId) : undefined}
            onValueChange={(value) =>
              setDraft((current) => {
                const next = { ...current };
                if (value === String(current.productId)) delete next.productId;
                else next.productId = value;
                return next;
              })
            }
            placeholder={isLookingUp ? "Loading products..." : "All products"}
            disabled={isLookingUp || productOptions.length === 0}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* ── Status line: only ever one sentence, never a duplicate of a field ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t bg-muted/20 px-4 py-2 text-[11px]">
        {isApplyBlocked ? (
          <span className="font-medium text-destructive">
            {!draft.startDate || !draft.endDate
              ? "Set both a period start and a reporting cutoff."
              : "The period start must not fall after the reporting cutoff."}
          </span>
        ) : (
          <>
            <span className="text-muted-foreground">
              Scope: <span className="font-medium text-foreground">{branchLabel}</span>
            </span>
            {isDirty ? (
              <span className="text-primary">Parameters changed — press Apply to reconcile.</span>
            ) : (
              <span className="text-muted-foreground">
                Counts and movements are cut at the same date.
              </span>
            )}
          </>
        )}
      </div>
    </motion.section>
  );
}
