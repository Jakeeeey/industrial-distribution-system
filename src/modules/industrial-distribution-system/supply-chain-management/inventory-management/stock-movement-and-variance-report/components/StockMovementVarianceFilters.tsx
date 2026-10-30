// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceFilters.tsx
// ==============================================================================
// Filter Parameter Bar for Stock Movement and Variance Report (spec §11).
// Period, authorized branch, category, product and an exception-only view.
// Branch scope is mandatory: the ledger is a per-branch movement view.
// ==============================================================================

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Building2, CalendarDays, Filter, Package, RotateCcw, Search, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";
import { SmoothSearchableSelect } from "./SmoothSearchableSelect";

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
    filters,
    setFilters,
    lookups,
    isLookingUp,
    onlyExceptions,
    setOnlyExceptions,
    searchQuery,
    setSearchQuery,
  } = useStockMovementVarianceReport();

  /** Patch helper so each control only rewrites the key it owns. */
  const patch = React.useCallback(
    (changes: Partial<typeof filters>) => {
      setFilters((current) => ({ ...current, ...changes }));
    },
    [setFilters]
  );

  const resetFilters = React.useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    const firstOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    )
      .toISOString()
      .split("T")[0];

    setFilters((current) => ({
      startDate: firstOfMonth,
      endDate: today,
      branchId: current.branchId,
    }));
    setSearchQuery("");
    setOnlyExceptions(false);
  }, [setFilters, setSearchQuery, setOnlyExceptions]);

  const branchOptions = React.useMemo(
    () =>
      (lookups?.branches ?? []).map((branch) => ({
        value: String(branch.id),
        label: branch.label,
      })),
    [lookups]
  );

  const categoryOptions = React.useMemo(
    () =>
      (lookups?.categories ?? []).map((category) => ({
        value: String(category.id),
        label: category.label,
      })),
    [lookups]
  );

  // The movements ledger filters by product NAME, so the option value is the label.
  const productOptions = React.useMemo(
    () =>
      (lookups?.products ?? []).map((product) => ({
        value: product.label,
        label: product.secondary ? `${product.label} (${product.secondary})` : product.label,
      })),
    [lookups]
  );

  const periodInvalid = filters.startDate > filters.endDate;

  return (
    <motion.section
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-3 rounded-xl border bg-card p-4 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <span>Report parameters</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={resetFilters}
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* ── Period start ─────────────────────────────────────────────────── */}
        <div>
          <FieldLabel icon={CalendarDays}>Period from</FieldLabel>
          <Input
            type="date"
            value={filters.startDate}
            max={filters.endDate}
            onChange={(event) => patch({ startDate: event.target.value })}
            className={cn("h-8 text-xs", periodInvalid && "border-destructive")}
          />
        </div>

        {/* ── Reporting cutoff ─────────────────────────────────────────────── */}
        <div>
          <FieldLabel icon={CalendarDays}>Reporting cutoff</FieldLabel>
          <Input
            type="date"
            value={filters.endDate}
            min={filters.startDate}
            onChange={(event) => patch({ endDate: event.target.value })}
            className={cn("h-8 text-xs", periodInvalid && "border-destructive")}
          />
        </div>

        {/* ── Authorized branch (required) ─────────────────────────────────── */}
        <div>
          <FieldLabel icon={Building2}>Branch (required)</FieldLabel>
          <SmoothSearchableSelect
            options={branchOptions}
            value={filters.branchId ? String(filters.branchId) : undefined}
            onValueChange={(value) => patch({ branchId: value })}
            placeholder={isLookingUp ? "Loading branches..." : "Select branch"}
            disabled={isLookingUp || branchOptions.length === 0}
            className="h-8 text-xs"
          />
        </div>

        {/* ── Category ─────────────────────────────────────────────────────── */}
        <div>
          <FieldLabel icon={Tags}>Category</FieldLabel>
          <SmoothSearchableSelect
            options={categoryOptions}
            value={filters.categoryId ? String(filters.categoryId) : undefined}
            onValueChange={(value) =>
              setFilters((current) => {
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

        {/* ── Product (server-side narrowing) ──────────────────────────────── */}
        <div>
          <FieldLabel icon={Package}>Product</FieldLabel>
          <SmoothSearchableSelect
            options={productOptions}
            value={filters.productName}
            onValueChange={(value) =>
              setFilters((current) => {
                const next = { ...current };
                if (value === current.productName) delete next.productName;
                else next.productName = value;
                return next;
              })
            }
            placeholder={isLookingUp ? "Loading products..." : "All products"}
            disabled={isLookingUp || productOptions.length === 0}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {periodInvalid ? (
        <p className="text-[11px] font-medium text-destructive">
          The period start must not fall after the reporting cutoff.
        </p>
      ) : null}

      {/* ── Local narrowing controls ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search loaded lines by product, code or count document"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <button
          type="button"
          onClick={() => setOnlyExceptions(!onlyExceptions)}
          aria-pressed={onlyExceptions}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
            onlyExceptions
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "bg-background text-muted-foreground hover:bg-accent"
          )}
        >
          <Filter className="h-3 w-3" />
          <span>Exceptions only</span>
        </button>
      </div>
    </motion.section>
  );
}
