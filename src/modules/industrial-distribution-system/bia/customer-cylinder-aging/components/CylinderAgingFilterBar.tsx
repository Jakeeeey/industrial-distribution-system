// components/CylinderAgingFilterBar.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Filter bar for the Customer Cylinder Aging module.
// Exposes all 4 Spring filter params: productId, customerCode, startDate, endDate.
// Apply button triggers the BFF fetch via the provider context.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Search, Filter, RotateCcw, Loader2 } from "lucide-react";
import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CylinderAgingFilterBar() {
  const { filters, setFilters, applyFilters, isLoading } =
    useCustomerCylinderAging();

  // Local staged state — syncs to context on Apply
  const [local, setLocal] = React.useState({
    productId: filters.productId !== undefined ? String(filters.productId) : "",
    customerCode: filters.customerCode ?? "",
    startDate: filters.startDate ?? "",
    endDate: filters.endDate ?? "",
  });

  const handleChange = (key: keyof typeof local, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  /** Commits staged local state to context, then fires fetch. */
  const handleApply = async () => {
    setFilters({
      productId: local.productId !== "" ? Number(local.productId) : undefined,
      customerCode: local.customerCode || undefined,
      startDate: local.startDate || undefined,
      endDate: local.endDate || undefined,
    });
    // Small defer to let setFilters propagate before applyFilters reads it.
    // applyFilters is wrapped in useCallback so it uses the committed value.
    await applyFilters();
  };

  /** Resets all filters to empty and re-fetches. */
  const handleReset = async () => {
    const empty = { productId: "", customerCode: "", startDate: "", endDate: "" };
    setLocal(empty);
    setFilters({});
    await applyFilters();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Filters
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Product ID */}
        <div className="space-y-1.5">
          <Label
            htmlFor="cca-filter-product-id"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            Product ID
          </Label>
          <Input
            id="cca-filter-product-id"
            type="number"
            placeholder="e.g. 24678"
            value={local.productId}
            onChange={(e) => handleChange("productId", e.target.value)}
            className="h-9 text-sm"
            min={1}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
          />
        </div>

        {/* Customer Code */}
        <div className="space-y-1.5">
          <Label
            htmlFor="cca-filter-customer-code"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            Customer Code
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              id="cca-filter-customer-code"
              type="text"
              placeholder="e.g. MAIN - 31593"
              value={local.customerCode}
              onChange={(e) => handleChange("customerCode", e.target.value)}
              className="h-9 text-sm pl-8"
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
            />
          </div>
        </div>

        {/* Start Date */}
        <div className="space-y-1.5">
          <Label
            htmlFor="cca-filter-start-date"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            Start Date
          </Label>
          <Input
            id="cca-filter-start-date"
            type="date"
            value={local.startDate}
            onChange={(e) => handleChange("startDate", e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          <Label
            htmlFor="cca-filter-end-date"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            End Date
          </Label>
          <Input
            id="cca-filter-end-date"
            type="date"
            value={local.endDate}
            onChange={(e) => handleChange("endDate", e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-4 justify-end">
        <Button
          id="cca-filter-reset-btn"
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={isLoading}
          className="h-9 gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          id="cca-filter-apply-btn"
          size="sm"
          onClick={handleApply}
          disabled={isLoading}
          className="h-9 gap-1.5 min-w-24"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Filter className="h-3.5 w-3.5" />
          )}
          {isLoading ? "Loading…" : "Apply"}
        </Button>
      </div>
    </div>
  );
}
