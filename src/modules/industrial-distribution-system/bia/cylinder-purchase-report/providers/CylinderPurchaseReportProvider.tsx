"use client";

import * as React from "react";

import { fetchCylinderPurchaseDashboard } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services";
import { getRollingThirtyDayRange } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/services/cylinder-purchase-report.helpers";
import type {
  AppliedFilterContext,
  CustomerPurchaseSummary,
  CylinderPurchaseDashboardResponse,
  CylinderPurchaseDashboardView,
  SalespersonPurchaseSummary,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

export interface CylinderPurchaseReportContextValue {
  report: CylinderPurchaseDashboardResponse | null;
  draftFilters: AppliedFilterContext;
  appliedFilters: AppliedFilterContext;
  tableResetKey: number;
  setDraftFilters: React.Dispatch<
    React.SetStateAction<AppliedFilterContext>
  >;
  applyFilters(): Promise<void>;
  clearFilters(): Promise<void>;
  refresh(): Promise<void>;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  activeView: CylinderPurchaseDashboardView;
  setActiveView(view: CylinderPurchaseDashboardView): void;
  selectedCustomer: CustomerPurchaseSummary | null;
  selectCustomer(customer: CustomerPurchaseSummary): void;
  closeCustomerDetail(): void;
  selectedSalesperson: SalespersonPurchaseSummary | null;
  openSalespersonDetail(salesperson: SalespersonPurchaseSummary): void;
  closeSalespersonDetail(): void;
}

export const CylinderPurchaseReportContext =
  React.createContext<CylinderPurchaseReportContextValue | undefined>(undefined);

export interface CylinderPurchaseReportProviderProps {
  children: React.ReactNode;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

export function CylinderPurchaseReportProvider({
  children,
}: CylinderPurchaseReportProviderProps) {
  const [initialFilters] = React.useState<AppliedFilterContext>(() =>
    getRollingThirtyDayRange(new Date()),
  );
  const [report, setReport] =
    React.useState<CylinderPurchaseDashboardResponse | null>(null);
  const [draftFilters, setDraftFilters] =
    React.useState<AppliedFilterContext>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    React.useState<AppliedFilterContext>(initialFilters);
  const [tableResetKey, setTableResetKey] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeView, setActiveView] =
    React.useState<CylinderPurchaseDashboardView>("customers");
  const [selectedCustomer, setSelectedCustomer] =
    React.useState<CustomerPurchaseSummary | null>(null);
  const [selectedSalesperson, setSelectedSalesperson] =
    React.useState<SalespersonPurchaseSummary | null>(null);
  const requestControllerRef = React.useRef<AbortController | null>(null);

  const requestReport = React.useCallback(
    async (filters: AppliedFilterContext): Promise<void> => {
      requestControllerRef.current?.abort();

      const controller = new AbortController();
      requestControllerRef.current = controller;
      setIsLoading(true);
      setError(null);

      try {
        const nextReport = await fetchCylinderPurchaseDashboard(
          filters,
          controller.signal,
        );
        if (controller.signal.aborted || requestControllerRef.current !== controller) {
          return;
        }
        setSelectedSalesperson(null);
        setReport(nextReport);
      } catch (requestError) {
        if (controller.signal.aborted || isAbortError(requestError)) {
          return;
        }
        if (requestControllerRef.current === controller) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load cylinder purchase report.",
          );
        }
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [],
  );

  React.useEffect(() => {
    void requestReport(initialFilters);

    return () => {
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
    };
  }, [initialFilters, requestReport]);

  const applyFilters = React.useCallback(async (): Promise<void> => {
    setAppliedFilters(draftFilters);
    setTableResetKey((currentKey) => currentKey + 1);
    setSelectedCustomer(null);
    setSelectedSalesperson(null);
    await requestReport(draftFilters);
  }, [draftFilters, requestReport]);

  const clearFilters = React.useCallback(async (): Promise<void> => {
    const nextFilters = getRollingThirtyDayRange(new Date());
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setTableResetKey((currentKey) => currentKey + 1);
    setSelectedCustomer(null);
    setSelectedSalesperson(null);
    await requestReport(nextFilters);
  }, [requestReport]);

  const refresh = React.useCallback(async (): Promise<void> => {
    await requestReport(appliedFilters);
  }, [appliedFilters, requestReport]);

  const selectCustomer = React.useCallback(
    (customer: CustomerPurchaseSummary): void => {
      setSelectedCustomer(customer);
    },
    [],
  );
  const closeCustomerDetail = React.useCallback((): void => {
    setSelectedCustomer(null);
  }, []);
  const openSalespersonDetail = React.useCallback(
    (salesperson: SalespersonPurchaseSummary): void => {
      setSelectedSalesperson(salesperson);
    },
    [],
  );
  const closeSalespersonDetail = React.useCallback((): void => {
    setSelectedSalesperson(null);
  }, []);

  const value = React.useMemo<CylinderPurchaseReportContextValue>(
    () => ({
      report,
      draftFilters,
      appliedFilters,
      tableResetKey,
      setDraftFilters,
      applyFilters,
      clearFilters,
      refresh,
      isInitialLoading: isLoading && report === null,
      isRefreshing: isLoading && report !== null,
      error,
      activeView,
      setActiveView,
      selectedCustomer,
      selectCustomer,
      closeCustomerDetail,
      selectedSalesperson,
      openSalespersonDetail,
      closeSalespersonDetail,
    }),
    [
      activeView,
      appliedFilters,
      applyFilters,
      clearFilters,
      closeCustomerDetail,
      closeSalespersonDetail,
      draftFilters,
      error,
      isLoading,
      refresh,
      report,
      openSalespersonDetail,
      selectCustomer,
      selectedCustomer,
      selectedSalesperson,
      tableResetKey,
    ],
  );

  return (
    <CylinderPurchaseReportContext.Provider value={value}>
      {children}
    </CylinderPurchaseReportContext.Provider>
  );
}
