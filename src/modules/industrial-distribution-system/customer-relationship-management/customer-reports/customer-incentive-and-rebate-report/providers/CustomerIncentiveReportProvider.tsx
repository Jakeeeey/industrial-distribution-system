"use client";

// ============================================================
// CustomerIncentiveReportProvider.tsx
// Owns the report state: draft vs applied filters, the abortable request,
// and the drill-down for one customer. Components read through the hook.
// ============================================================

import * as React from "react";

import {
  CustomerIncentiveApiError,
  requestCustomerIncentiveDetail,
  requestCustomerIncentiveReport,
} from "../api/customer-incentive.client";
import {
  getCurrentQuarterRange,
} from "../services/customer-incentive.helpers";
import type {
  AppliedFilterContext,
  CustomerIncentiveDetail,
  CustomerIncentiveReportResponse,
} from "../types/customer-incentive.types";

export interface SelectedCustomerTarget {
  customerCode: string;
  customerName: string;
}

export interface CustomerIncentiveReportContextValue {
  report: CustomerIncentiveReportResponse | null;
  draftFilters: AppliedFilterContext;
  /** Null until the reader clicks Apply; nothing is read before that. */
  appliedFilters: AppliedFilterContext | null;
  setDraftFilters: React.Dispatch<React.SetStateAction<AppliedFilterContext>>;
  applyFilters(): Promise<void>;
  /** Returns the form to the opening window. It does not re-read. */
  resetFilters(): void;
  refresh(): Promise<void>;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  selectedCustomer: SelectedCustomerTarget | null;
  detail: CustomerIncentiveDetail | null;
  isDetailLoading: boolean;
  detailError: string | null;
  openCustomerDetail(target: SelectedCustomerTarget): Promise<void>;
  closeCustomerDetail(): void;
}

export const CustomerIncentiveReportContext =
  React.createContext<CustomerIncentiveReportContextValue | undefined>(
    undefined
  );

export interface CustomerIncentiveReportProviderProps {
  children: React.ReactNode;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof CustomerIncentiveApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** A rebate scheme is assessed per period, so the quarter is the opening view. */
function initialFilters(): AppliedFilterContext {
  return {
    ...getCurrentQuarterRange(new Date()),
  };
}

export function CustomerIncentiveReportProvider({
  children,
}: CustomerIncentiveReportProviderProps): React.ReactElement {
  // Pre-filled so the first Apply is one click away, but never read from.
  const [draftFilters, setDraftFilters] =
    React.useState<AppliedFilterContext>(initialFilters);
  const [report, setReport] =
    React.useState<CustomerIncentiveReportResponse | null>(null);
  const [appliedFilters, setAppliedFilters] =
    React.useState<AppliedFilterContext | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] =
    React.useState<SelectedCustomerTarget | null>(null);
  const [detail, setDetail] = React.useState<CustomerIncentiveDetail | null>(null);
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
      // A new window makes an open drawer meaningless; it would show records
      // that are no longer part of the table behind it.
      setSelectedCustomer(null);
      setDetail(null);
      setIsDetailLoading(false);

      try {
        const next = await requestCustomerIncentiveReport(
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

  // Nothing is read on mount. The opening screen is a prompt, not a figure a
  // reader might mistake for this quarter's answer.
  React.useEffect(
    () => () => {
      reportController.current?.abort();
      reportController.current = null;
      detailController.current?.abort();
      detailController.current = null;
    },
    []
  );

  const applyFilters = React.useCallback(async (): Promise<void> => {
    const next: AppliedFilterContext = {
      ...draftFilters,
      sizeKg: draftFilters.sizeKg,
    };
    setDraftFilters(next);
    setAppliedFilters(next);
    await requestReport(next);
  }, [draftFilters, requestReport]);

  // The form returns to its opening window. The table keeps whatever Apply last
  // loaded, so a reset can never be mistaken for a re-read.
  const resetFilters = React.useCallback((): void => {
    setDraftFilters(initialFilters());
  }, []);

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!appliedFilters) return;
    await requestReport(appliedFilters);
  }, [appliedFilters, requestReport]);

  const openCustomerDetail = React.useCallback(
    async (target: SelectedCustomerTarget): Promise<void> => {
      if (!appliedFilters) return;
      detailController.current?.abort();
      const controller = new AbortController();
      detailController.current = controller;

      setSelectedCustomer(target);
      setDetail(null);
      setDetailError(null);
      setIsDetailLoading(true);

      try {
        const next = await requestCustomerIncentiveDetail(
          appliedFilters,
          target.customerCode,
          controller.signal
        );
        if (controller.signal.aborted || detailController.current !== controller) return;
        setDetail(next);
      } catch (requestError) {
        if (controller.signal.aborted || isAbortName(requestError)) return;
        if (detailController.current === controller) {
          setDetailError(
            describeError(requestError, "Unable to load the supporting records.")
          );
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

  const value = React.useMemo<CustomerIncentiveReportContextValue>(
    () => ({
      report,
      draftFilters,
      appliedFilters,
      setDraftFilters,
      applyFilters,
      resetFilters,
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
      resetFilters,
      selectedCustomer,
    ]
  );

  return (
    <CustomerIncentiveReportContext.Provider value={value}>
      {children}
    </CustomerIncentiveReportContext.Provider>
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
