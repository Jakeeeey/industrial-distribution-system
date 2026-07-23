"use client";

import * as React from "react";
import { toast } from "sonner";

import { fetchReportLookups } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services";
import type {
  ReportLookupOption,
  ReportLookupType,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

interface CylinderPurchaseFilterOptions {
  branchOptions: ReportLookupOption[];
  customerOptions: ReportLookupOption[];
  isMasterDataLoading: boolean;
  productOptions: ReportLookupOption[];
  salespersonOptions: ReportLookupOption[];
}

function reportLookupError(error: unknown, fallback: string): void {
  if (!(error instanceof Error) || error.name !== "AbortError") {
    toast.error(error instanceof Error ? error.message : fallback);
  }
}

function useDebouncedLookup(
  type: Extract<ReportLookupType, "customers" | "products">,
  query: string,
): ReportLookupOption[] {
  const [options, setOptions] = React.useState<ReportLookupOption[]>([]);

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchReportLookups(type, query, controller.signal)
        .then(setOptions)
        .catch((error: unknown) =>
          reportLookupError(
            error,
            `Unable to load ${type === "customers" ? "customer" : "product"} options.`,
          ),
        );
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, type]);

  return options;
}

export function useCylinderPurchaseFilterOptions(
  customerQuery: string,
  productQuery: string,
): CylinderPurchaseFilterOptions {
  const customerOptions = useDebouncedLookup("customers", customerQuery);
  const productOptions = useDebouncedLookup("products", productQuery);
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
      .catch((error: unknown) =>
        reportLookupError(
          error,
          "Unable to load branch and salesperson options.",
        ),
      )
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsMasterDataLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return {
    branchOptions,
    customerOptions,
    isMasterDataLoading,
    productOptions,
    salespersonOptions,
  };
}
