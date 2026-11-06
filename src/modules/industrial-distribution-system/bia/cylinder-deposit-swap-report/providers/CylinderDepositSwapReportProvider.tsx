// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/providers/CylinderDepositSwapReportProvider.tsx
// ==============================================================================
// State Provider for Cylinder Deposit and Swap Report.
// Manages asynchronous report queries, dynamic lookups, filter synchronization,
// search query filtering, and drill-down audit drawer lifecycle.
// ==============================================================================

"use client";

import * as React from "react";
import type {
  CylinderDepositSwapFilters,
  CylinderDepositSwapLookupOptions,
  CylinderDepositSwapReportResponse,
  CustomerDepositSwapDetailResponse,
} from "../types/cylinder-deposit-swap.types";
import {
  fetchCylinderDepositSwapReport,
  fetchCylinderDepositSwapLookups,
  fetchCustomerDepositSwapDetail,
} from "../services/cylinder-deposit-swap.repo";
import { exportCylinderDepositSwapToExcel } from "../services/cylinder-deposit-swap.xlsx";
import { exportCylinderDepositSwapToPdf } from "../services/cylinder-deposit-swap.pdf";

export interface CylinderDepositSwapContextValue {
  report: CylinderDepositSwapReportResponse | null;
  lookups: CylinderDepositSwapLookupOptions | null;
  filters: CylinderDepositSwapFilters;
  setFilters: React.Dispatch<React.SetStateAction<CylinderDepositSwapFilters>>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  exportExcel: () => void;
  exportPdf: () => void;
  // Audit drawer state
  selectedCustomerCode: string | null;
  customerDetail: CustomerDepositSwapDetailResponse | null;
  isDetailLoading: boolean;
  openCustomerDetail: (customerCode: string) => Promise<void>;
  closeCustomerDetail: () => void;
}

export const CylinderDepositSwapContext = React.createContext<
  CylinderDepositSwapContextValue | undefined
>(undefined);

export function CylinderDepositSwapReportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const now = React.useMemo(() => new Date(), []);
  const initialStartDate = React.useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
    [now]
  );
  const initialEndDate = React.useMemo(() => now.toISOString().split("T")[0], [now]);

  const [filters, setFilters] = React.useState<CylinderDepositSwapFilters>({
    startDate: initialStartDate,
    endDate: initialEndDate,
    branchId: "",
    customerCode: "",
    productId: "",
  });

  const [searchQuery, setSearchQuery] = React.useState("");
  const [report, setReport] = React.useState<CylinderDepositSwapReportResponse | null>(null);
  const [lookups, setLookups] = React.useState<CylinderDepositSwapLookupOptions | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Drill-down states
  const [selectedCustomerCode, setSelectedCustomerCode] = React.useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = React.useState<CustomerDepositSwapDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);

  // Load initial lookups
  React.useEffect(() => {
    let mounted = true;
    fetchCylinderDepositSwapLookups()
      .then((data) => {
        if (mounted) setLookups(data);
      })
      .catch((err) => {
        console.error("[DepositSwapProvider] Failed to load lookups:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch report data
  const loadReport = React.useCallback(async (activeFilters: CylinderDepositSwapFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCylinderDepositSwapReport(activeFilters);
      setReport(data);
    } catch (err) {
      console.error("[DepositSwapProvider] Error fetching report:", err);
      setError(err instanceof Error ? err.message : "Failed to load report dataset");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadReport(filters);
  }, [filters, loadReport]);

  const refresh = React.useCallback(async () => {
    await loadReport(filters);
  }, [filters, loadReport]);

  // Drill-down handler
  const openCustomerDetail = React.useCallback(
    async (customerCode: string) => {
      setSelectedCustomerCode(customerCode);
      setIsDetailLoading(true);
      try {
        const detail = await fetchCustomerDepositSwapDetail(customerCode, {
          startDate: filters.startDate,
          endDate: filters.endDate,
        });
        setCustomerDetail(detail);
      } catch (err) {
        console.error("[DepositSwapProvider] Detail fetch failed:", err);
      } finally {
        setIsDetailLoading(false);
      }
    },
    [filters.startDate, filters.endDate]
  );

  const closeCustomerDetail = React.useCallback(() => {
    setSelectedCustomerCode(null);
    setCustomerDetail(null);
  }, []);

  // Export handlers
  const exportExcel = React.useCallback(() => {
    if (report) {
      exportCylinderDepositSwapToExcel(report);
    }
  }, [report]);

  const exportPdf = React.useCallback(() => {
    if (report) {
      exportCylinderDepositSwapToPdf(report);
    }
  }, [report]);

  const value = React.useMemo<CylinderDepositSwapContextValue>(
    () => ({
      report,
      lookups,
      filters,
      setFilters,
      searchQuery,
      setSearchQuery,
      isLoading,
      error,
      refresh,
      exportExcel,
      exportPdf,
      selectedCustomerCode,
      customerDetail,
      isDetailLoading,
      openCustomerDetail,
      closeCustomerDetail,
    }),
    [
      report,
      lookups,
      filters,
      searchQuery,
      isLoading,
      error,
      refresh,
      exportExcel,
      exportPdf,
      selectedCustomerCode,
      customerDetail,
      isDetailLoading,
      openCustomerDetail,
      closeCustomerDetail,
    ]
  );

  return (
    <CylinderDepositSwapContext.Provider value={value}>
      {children}
    </CylinderDepositSwapContext.Provider>
  );
}
