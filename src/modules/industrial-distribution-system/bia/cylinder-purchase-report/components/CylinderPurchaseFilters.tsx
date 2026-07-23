"use client";

import * as React from "react";
import { Filter, Loader2, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCylinderPurchaseReport } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport";
import { fetchReportLookups } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services";
import type {
  CylinderPurchaseReportFilters,
  ReportLookupOption,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

const ALL_OPTIONS = "all";

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
    draftFilters.customerCode ?? "",
  );
  const [productQuery, setProductQuery] = React.useState(
    draftFilters.productId === undefined ? "" : String(draftFilters.productId),
  );
  const [customerOptions, setCustomerOptions] = React.useState<
    ReportLookupOption[]
  >([]);
  const [productOptions, setProductOptions] = React.useState<
    ReportLookupOption[]
  >([]);
  const [branchOptions, setBranchOptions] = React.useState<
    ReportLookupOption[]
  >([]);
  const [salespersonOptions, setSalespersonOptions] = React.useState<
    ReportLookupOption[]
  >([]);
  const [isMasterDataLoading, setIsMasterDataLoading] = React.useState(true);

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetchReportLookups("branches", "", controller.signal),
      fetchReportLookups("salespeople", "", controller.signal),
    ])
      .then(([branches, salespeople]) => {
        setBranchOptions(branches);
        setSalespersonOptions(salespeople);
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error) || error.name !== "AbortError") {
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to load branch and salesperson options.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsMasterDataLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchReportLookups("customers", customerQuery, controller.signal)
        .then(setCustomerOptions)
        .catch((error: unknown) => {
          if (!(error instanceof Error) || error.name !== "AbortError") {
            toast.error(
              error instanceof Error
                ? error.message
                : "Unable to load customer options.",
            );
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [customerQuery]);

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchReportLookups("products", productQuery, controller.signal)
        .then(setProductOptions)
        .catch((error: unknown) => {
          if (!(error instanceof Error) || error.name !== "AbortError") {
            toast.error(
              error instanceof Error
                ? error.message
                : "Unable to load product options.",
            );
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [productQuery]);

  const setFilter = <Key extends keyof CylinderPurchaseReportFilters>(
    key: Key,
    value: CylinderPurchaseReportFilters[Key],
  ): void => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const formatLookupOption = (option: ReportLookupOption): string =>
    option.code && option.code !== option.label
      ? `${option.code} — ${option.label}`
      : option.label;

  const handleCustomerChange = (value: string): void => {
    setCustomerQuery(value);
    const option = customerOptions.find(
      (candidate) =>
        formatLookupOption(candidate) === value || candidate.value === value,
    );
    setFilter("customerCode", option?.value || undefined);
  };

  const handleProductChange = (value: string): void => {
    setProductQuery(value);
    const option = productOptions.find(
      (candidate) =>
        formatLookupOption(candidate) === value || candidate.value === value,
    );
    const productId = option ? Number(option.value) : Number.NaN;
    setFilter("productId", Number.isFinite(productId) ? productId : undefined);
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
          <div className="space-y-1.5">
            <Label htmlFor="cylinder-report-customer">Customer</Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="cylinder-report-customer"
                list="cylinder-report-customer-options"
                value={customerQuery}
                onChange={(event) => handleCustomerChange(event.target.value)}
                placeholder="Search code or customer"
                autoComplete="off"
                className="pl-8"
              />
              <datalist id="cylinder-report-customer-options">
                {customerOptions.map((option) => (
                  <option key={option.value} value={formatLookupOption(option)} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cylinder-report-product">Serialized product</Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="cylinder-report-product"
                list="cylinder-report-product-options"
                value={productQuery}
                onChange={(event) => handleProductChange(event.target.value)}
                placeholder="Search code or product"
                autoComplete="off"
                className="pl-8"
              />
              <datalist id="cylinder-report-product-options">
                {productOptions.map((option) => (
                  <option key={option.value} value={formatLookupOption(option)} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cylinder-report-branch">Branch</Label>
            <Select
              value={
                draftFilters.branchId === undefined
                  ? ALL_OPTIONS
                  : String(draftFilters.branchId)
              }
              onValueChange={(value) =>
                setFilter(
                  "branchId",
                  value === ALL_OPTIONS ? undefined : Number(value),
                )
              }
              disabled={isMasterDataLoading}
            >
              <SelectTrigger id="cylinder-report-branch" className="w-full">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTIONS}>All branches</SelectItem>
                {branchOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {formatLookupOption(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cylinder-report-salesperson">Salesperson</Label>
            <Select
              value={
                draftFilters.salesmanId === undefined
                  ? ALL_OPTIONS
                  : String(draftFilters.salesmanId)
              }
              onValueChange={(value) =>
                setFilter(
                  "salesmanId",
                  value === ALL_OPTIONS ? undefined : Number(value),
                )
              }
              disabled={isMasterDataLoading}
            >
              <SelectTrigger id="cylinder-report-salesperson" className="w-full">
                <SelectValue placeholder="All salespeople" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTIONS}>All salespeople</SelectItem>
                {salespersonOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {formatLookupOption(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
