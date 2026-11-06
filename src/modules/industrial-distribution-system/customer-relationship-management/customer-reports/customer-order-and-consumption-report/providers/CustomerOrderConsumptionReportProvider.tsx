"use client";

// ============================================================
// CustomerOrderConsumptionReportProvider.tsx
// Owns the report state: draft vs applied filters, the abortable request,
// and the drill-down for one customer. Components read through the hook.
// ============================================================

import * as React from "react";

import {
  CustomerOrderConsumptionApiError,
  requestCustomerOrderConsumptionDetail,
  requestCustomerOrderConsumptionReport,
} from "../api/customer-order-consumption.client";
import { getRollingThirtyDayRange } from "../services/customer-order-consumption.helpers";
import type {
  AppliedFilterContext,
  CustomerOrderConsumptionDetail,
  CustomerOrderConsumptionReportResponse,
} from "../types/customer-order-consumption.types";

export interface SelectedCustomerTarget {
  customerCode: string;
  customerName: string;
}

export interface CustomerOrderConsumptionReportContextValue {
  report: CustomerOrderConsumptionReportResponse | null;
  draftFilters: AppliedFilterContext;
  appliedFilters: AppliedFilterContext;
  setDraftFilters: React.Dispatch<React.SetStateAction<AppliedFilterContext>>;
  applyFilters(): Promise<void>;
  clearFilters(): Promise<void>;
  refresh(): Promise<void>;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  selectedCustomer: SelectedCustomerTarget | null;
  detail: CustomerOrderConsumptionDetail | null;
  isDetailLoading: boolean;
  detailError: string | null;
  openCustomerDetail(target: SelectedCustomerTarget): Promise<void>;
  closeCustomerDetail(): void;
}

export const CustomerOrderConsumptionReportContext =
  React.createContext<CustomerOrderConsumptionReportContextValue | undefined>(
    undefined
  );

export interface CustomerOrderConsumptionReportProviderProps {
  children: React.ReactNode;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof CustomerOrderConsumptionApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function CustomerOrderConsumptionReportProvider({
  children,
}: CustomerOrderConsumptionReportProviderProps) {
  const [initialFilters] = React.useState<AppliedFilterContext>(() =>
    getRollingThirtyDayRange(new Date())
  );
  const [report, setReport] =
    React.useState<CustomerOrderConsumptionReportResponse | null>(null);
  const [draftFilters, setDraftFilters] =
    React.useState<AppliedFilterContext>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    React.useState<AppliedFilterContext>(initialFilters);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] =
    React.useState<SelectedCustomerTarget | null>(null);
  const [detail, setDetail] = React.useState<CustomerOrderConsumptionDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  const reportController = React.useRef<AbortController | null>(null);
  const detailController = React.useRef<AbortController | null>(null);

  const requestReport = React.useCallback(
    async (filters: AppliedFilterContext): Promise<void> => {
      reportController.current?.abort();
      detailController.current?.abort();

      const controller = new AbortController();
      reportController.current = controller;
      setIsLoading(true);
      setError(null);
      // A new window makes an open drawer meaningless; it would show rows
      // that are no longer part of the table behind it.
      setSelectedCustomer(null);
      setDetail(null);
      setIsDetailLoading(false);

      try {
        const next = await requestCustomerOrderConsumptionReport(
          filters,
          controller.signal
        );
        if (controller.signal.aborted || reportController.current !== controller) return;
        setReport(next);
      } catch (requestError) {
        if (controller.signal.aborted || reportController.current !== controller) return;
        setReport(null);
        setError(describeError(requestError, "Unable to load the report."));
      } finally {
        if (reportController.current === controller) {
          reportController.current = null;
          setIsLoading(false);
        }
      }
    },
    []
  );

  React.useEffect(() => {
    void requestReport(initialFilters);
    return () => {
      reportController.current?.abort();
      reportController.current = null;
      detailController.current?.abort();
      detailController.current = null;
    };
  }, [initialFilters, requestReport]);

  const applyFilters = React.useCallback(async (): Promise<void> => {
    setAppliedFilters(draftFilters);
    await requestReport(draftFilters);
  }, [draftFilters, requestReport]);

  const clearFilters = React.useCallback(async (): Promise<void> => {
    const next = getRollingThirtyDayRange(new Date());
    setDraftFilters(next);
    setAppliedFilters(next);
    await requestReport(next);
  }, [requestReport]);

  const refresh = React.useCallback(async (): Promise<void> => {
    await requestReport(appliedFilters);
  }, [appliedFilters, requestReport]);

  const openCustomerDetail = React.useCallback(
    async (target: SelectedCustomerTarget): Promise<void> => {
      detailController.current?.abort();
      const controller = new AbortController();
      detailController.current = controller;

      setSelectedCustomer(target);
      setDetail(null);
      setDetailError(null);
      setIsDetailLoading(true);

      try {
        const next = await requestCustomerOrderConsumptionDetail(
          appliedFilters,
          target.customerCode,
          controller.signal
        );
        if (controller.signal.aborted || detailController.current !== controller) return;
        setDetail(next);
      } catch (requestError) {
        if (controller.signal.aborted || isAbortName(requestError)) return;
        if (detailController.current === controller) {
          setDetailError(describeError(requestError, "Unable to load the supporting records."));
        }
      } finally {
        if (detailController.current === controller) {
          detailController.current = null;
          setIsDetailLoading(false);
        }
      }
    },
    [appliedFilters]
  );

  const closeCustomerDetail = React.useCallback((): void => {
    detailController.current?.abort();
    detailController.current = null;
    setSelectedCustomer(null);
    setDetail(null);
    setDetailError(null);
    setIsDetailLoading(false);
  }, []);

  const value = React.useMemo<CustomerOrderConsumptionReportContextValue>(
    () => ({
      report,
      draftFilters,
      appliedFilters,
      setDraftFilters,
      applyFilters,
      clearFilters,
      refresh,
      isInitialLoading: isLoading && report === null,
      isRefreshing: isLoading && report !== null,
      error,
      selectedCustomer,
      detail,
      isDetailLoading,
      detailError,
      openCustomerDetail,
      closeCustomerDetail,
    }),
    [
      appliedFilters,
      applyFilters,
      clearFilters,
      closeCustomerDetail,
      detail,
      detailError,
      draftFilters,
      error,
      isLoading,
      isDetailLoading,
      openCustomerDetail,
      refresh,
      report,
      selectedCustomer,
    ]
  );

  return (
    <CustomerOrderConsumptionReportContext.Provider value={value}>
      {children}
    </CustomerOrderConsumptionReportContext.Provider>
  );
}

/** AbortError check kept local so the provider needs no server-side import. */
function isAbortName(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}
