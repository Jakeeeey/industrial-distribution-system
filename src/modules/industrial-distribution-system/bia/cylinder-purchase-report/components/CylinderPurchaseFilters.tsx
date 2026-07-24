"use client";

import * as React from "react";
import { Filter, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCylinderPurchaseReport } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport";
import { useCylinderPurchaseFilterOptions } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseFilterOptions";
import {
  applyReportLookupSelection,
  formatReportLookupLabel,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.filter-context";
import type {
  AppliedFilterContext,
  ReportLookupOption,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

import { ReportSearchLookupInput } from "./ReportSearchLookupInput";

const ALL_OPTIONS = "all";

// Development comment: Refactored filter controls to use global SearchableSelect comboboxes across all dropdowns.
export function CylinderPurchaseFilters(): React.ReactElement {
  const {
    draftFilters,
    setDraftFilters,
    applyFilters,
    clearFilters,
    isInitialLoading,
    isRefreshing,
  } = useCylinderPurchaseReport();
  const [customerQuery, setCustomerQuery] = React.useState(
    draftFilters.customerLabel ?? draftFilters.customerCode ?? "",
  );
  const [productQuery, setProductQuery] = React.useState(
    draftFilters.productLabel ??
      (draftFilters.productId === undefined
        ? ""
        : String(draftFilters.productId)),
  );
  const {
    branchOptions,
    customerOptions,
    isMasterDataLoading,
    productOptions,
    salespersonOptions,
  } = useCylinderPurchaseFilterOptions(customerQuery, productQuery);

  const setFilter = <Key extends keyof AppliedFilterContext>(
    key: Key,
    value: AppliedFilterContext[Key],
  ): void => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const findLookupOption = (
    options: ReportLookupOption[],
    value: string,
  ): ReportLookupOption | undefined =>
    options.find(
      (candidate) =>
        formatReportLookupLabel(candidate) === value ||
        candidate.value === value,
    );

  const handleCustomerChange = (value: string): void => {
    const selected =
      value === ALL_OPTIONS
        ? undefined
        : findLookupOption(customerOptions, value);
    setCustomerQuery(selected ? formatReportLookupLabel(selected) : "");
    setDraftFilters((current) =>
      applyReportLookupSelection(current, "customers", selected),
    );
  };

  const handleProductChange = (value: string): void => {
    const selected =
      value === ALL_OPTIONS
        ? undefined
        : findLookupOption(productOptions, value);
    setProductQuery(selected ? formatReportLookupLabel(selected) : "");
    setDraftFilters((current) =>
      applyReportLookupSelection(current, "products", selected),
    );
  };

  const handleBranchChange = (value: string): void => {
    const selected =
      value === ALL_OPTIONS
        ? undefined
        : findLookupOption(branchOptions, value);
    setDraftFilters((current) =>
      applyReportLookupSelection(current, "branches", selected),
    );
  };

  const handleSalespersonChange = (value: string): void => {
    const selected =
      value === ALL_OPTIONS
        ? undefined
        : findLookupOption(salespersonOptions, value);
    setDraftFilters((current) =>
      applyReportLookupSelection(current, "salespeople", selected),
    );
  };

  const handleClear = async (): Promise<void> => {
    setCustomerQuery("");
    setProductQuery("");
    await clearFilters();
  };

  const hasInvalidDateRange =
    !draftFilters.startDate ||
    !draftFilters.endDate ||
    draftFilters.startDate > draftFilters.endDate;
  const isLoading = isInitialLoading || isRefreshing;

  return (
    <Card className="gap-4 border-border/80 py-4">
      <CardContent className="space-y-4 px-4">
        <div className="flex items-center gap-2">
          <Filter aria-hidden="true" className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            Report filters
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <ReportSearchLookupInput
            id="cylinder-report-customer"
            label="Customer"
            value={draftFilters.customerCode ?? ALL_OPTIONS}
            options={customerOptions}
            placeholder="Search code or customer"
            allOptionLabel="All customers"
            onValueChange={handleCustomerChange}
          />

          <ReportSearchLookupInput
            id="cylinder-report-product"
            label="Serialized product"
            value={
              draftFilters.productId === undefined
                ? ALL_OPTIONS
                : String(draftFilters.productId)
            }
            options={productOptions}
            placeholder="Search code or product"
            allOptionLabel="All serialized products"
            onValueChange={handleProductChange}
          />

          <ReportSearchLookupInput
            id="cylinder-report-branch"
            label="Branch"
            value={
              draftFilters.branchId === undefined
                ? ALL_OPTIONS
                : String(draftFilters.branchId)
            }
            options={branchOptions}
            placeholder="Search branch"
            allOptionLabel="All branches"
            disabled={isMasterDataLoading}
            onValueChange={handleBranchChange}
          />

          <ReportSearchLookupInput
            id="cylinder-report-salesperson"
            label="Salesperson"
            value={
              draftFilters.salesmanId === undefined
                ? ALL_OPTIONS
                : String(draftFilters.salesmanId)
            }
            options={salespersonOptions}
            placeholder="Search salesperson"
            allOptionLabel="All salespeople"
            disabled={isMasterDataLoading}
            onValueChange={handleSalespersonChange}
          />

          <div className="space-y-1.5">
            <Label htmlFor="cylinder-report-start-date">Start date</Label>
            <Input
              id="cylinder-report-start-date"
              type="date"
              required
              value={draftFilters.startDate}
              max={draftFilters.endDate}
              onChange={(event) => setFilter("startDate", event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cylinder-report-end-date">End date</Label>
            <Input
              id="cylinder-report-end-date"
              type="date"
              required
              value={draftFilters.endDate}
              min={draftFilters.startDate}
              aria-invalid={hasInvalidDateRange}
              aria-describedby={
                hasInvalidDateRange ? "cylinder-report-date-error" : undefined
              }
              onChange={(event) => setFilter("endDate", event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            id="cylinder-report-date-error"
            role={hasInvalidDateRange ? "alert" : undefined}
            className="text-xs text-destructive"
          >
            {hasInvalidDateRange
              ? "Choose a start date on or before the end date."
              : null}
          </p>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleClear()}
              disabled={isLoading}
            >
              <RotateCcw aria-hidden="true" />
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void applyFilters()}
              disabled={hasInvalidDateRange || isLoading}
            >
              {isLoading ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : null}
              Apply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
