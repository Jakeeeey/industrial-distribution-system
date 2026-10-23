// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/providers/CustomerCylinderAccountabilityProvider.tsx
// ==============================================================================
// State Provider for Customer Cylinder Accountability Report (VoSync BIA Subsystem)
// Manages global filter parameters, server data orchestration, customer drilldown,
// pagination, and export dispatchers.
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// - High resilience: defensive state fallback and null-safety
// ==============================================================================

"use client";

import * as React from "react";
import type {
  CustomerAccountabilityFilters,
  CustomerAccountabilityReportResponse,
  CustomerAccountabilityDetailResponse,
  AccountabilityLookupOptions,
  CustomerAccountabilityRow,
} from "../types/customer-cylinder-accountability.types";
import {
  fetchCustomerAccountabilityReport,
  fetchAccountabilityLookups,
  fetchCustomerAccountabilityDetail,
} from "../services/customer-cylinder-accountability.repo";
import { exportAccountabilityToExcel } from "../services/customer-cylinder-accountability.xlsx";
import { exportAccountabilityToPdf } from "../services/customer-cylinder-accountability.pdf";
import { filterAccountabilityRows } from "../services/customer-cylinder-accountability.calc";

interface CustomerAccountabilityContextValue {
  // Filters & State
  filters: CustomerAccountabilityFilters;
  setFilters: (updated: Partial<CustomerAccountabilityFilters>) => void;
  resetFilters: () => void;
  reportData: CustomerAccountabilityReportResponse | null;
  filteredRows: CustomerAccountabilityRow[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  // Lookups
  lookups: AccountabilityLookupOptions;
  isLookupsLoading: boolean;

  // Drilldown Drawer State
  selectedCustomerCode: string | null;
  customerDetail: CustomerAccountabilityDetailResponse | null;
  isDetailLoading: boolean;
  openCustomerDetail: (code: string) => void;
  closeCustomerDetail: () => void;

  // Pagination
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Export Actions
  exportExcel: () => void;
  exportPdf: () => void;
}

const CustomerAccountabilityContext = React.createContext<CustomerAccountabilityContextValue | null>(null);

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1).toISOString().split("T")[0];
  const end = now.toISOString().split("T")[0];
  return { startDate: start, endDate: end };
}

export function CustomerCylinderAccountabilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const defaults = React.useMemo(() => getDefaultDateRange(), []);

  const [filters, setFiltersState] = React.useState<CustomerAccountabilityFilters>({
    startDate: defaults.startDate,
    endDate: defaults.endDate,
    branchId: "ALL",
    customerCode: "",
    ownership: "ALL",
    searchQuery: "",
  });

  const [reportData, setReportData] = React.useState<CustomerAccountabilityReportResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [lookups, setLookups] = React.useState<AccountabilityLookupOptions>({
    branches: [],
    customers: [],
    ownerships: [
      { code: "ALL", label: "All Ownerships" },
      { code: "COMPANY", label: "Company Owned" },
      { code: "CUSTOMER", label: "Customer Owned" },
    ],
  });
  const [isLookupsLoading, setIsLookupsLoading] = React.useState<boolean>(true);

  // Drill-down drawer state
  const [selectedCustomerCode, setSelectedCustomerCode] = React.useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = React.useState<CustomerAccountabilityDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = React.useState<boolean>(false);

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(20);

  // 1. Fetch Lookups on Mount
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLookupsLoading(true);
        const data = await fetchAccountabilityLookups();
        if (mounted) setLookups(data);
      } catch (err: any) {
        console.error("[AccountabilityProvider] Failed to fetch lookups:", err);
      } finally {
        if (mounted) setIsLookupsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Fetch Report Data on Filter Change
  const loadReport = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchCustomerAccountabilityReport(filters);
      setReportData(res);
      setCurrentPage(1); // Reset to first page
    } catch (err: any) {
      console.error("[AccountabilityProvider] Failed to load report:", err);
      setError(err?.message || "Failed to load customer cylinder accountability report.");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    loadReport();
  }, [loadReport]);

  // 3. Load Customer Drilldown detail when selected
  React.useEffect(() => {
    if (!selectedCustomerCode) {
      setCustomerDetail(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setIsDetailLoading(true);
        const detail = await fetchCustomerAccountabilityDetail(selectedCustomerCode, {
          startDate: filters.startDate,
          endDate: filters.endDate,
        });
        if (mounted) setCustomerDetail(detail);
      } catch (err: any) {
        console.error("[AccountabilityProvider] Failed to load customer detail:", err);
      } finally {
        if (mounted) setIsDetailLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedCustomerCode, filters.startDate, filters.endDate]);

  // Derived filtered rows (search, branch, ownership)
  const filteredRows = React.useMemo(() => {
    if (!reportData?.rows) return [];
    return filterAccountabilityRows(
      reportData.rows,
      filters.searchQuery,
      filters.branchId,
      filters.ownership
    );
  }, [reportData?.rows, filters.searchQuery, filters.branchId, filters.ownership]);

  const setFilters = React.useCallback((updated: Partial<CustomerAccountabilityFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...updated }));
  }, []);

  const resetFilters = React.useCallback(() => {
    setFiltersState({
      startDate: defaults.startDate,
      endDate: defaults.endDate,
      branchId: "ALL",
      customerCode: "",
      ownership: "ALL",
      searchQuery: "",
    });
  }, [defaults]);

  const openCustomerDetail = React.useCallback((code: string) => {
    setSelectedCustomerCode(code);
  }, []);

  const closeCustomerDetail = React.useCallback(() => {
    setSelectedCustomerCode(null);
  }, []);

  const exportExcel = React.useCallback(() => {
    if (!reportData) return;
    exportAccountabilityToExcel(reportData);
  }, [reportData]);

  const exportPdf = React.useCallback(() => {
    if (!reportData) return;
    exportAccountabilityToPdf(reportData);
  }, [reportData]);

  const value: CustomerAccountabilityContextValue = {
    filters,
    setFilters,
    resetFilters,
    reportData,
    filteredRows,
    isLoading,
    error,
    refresh: loadReport,
    lookups,
    isLookupsLoading,
    selectedCustomerCode,
    customerDetail,
    isDetailLoading,
    openCustomerDetail,
    closeCustomerDetail,
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    exportExcel,
    exportPdf,
  };

  return (
    <CustomerAccountabilityContext.Provider value={value}>
      {children}
    </CustomerAccountabilityContext.Provider>
  );
}

export function useCustomerCylinderAccountabilityContext(): CustomerAccountabilityContextValue {
  const ctx = React.useContext(CustomerAccountabilityContext);
  if (!ctx) {
    throw new Error(
      "useCustomerCylinderAccountability must be used within a CustomerCylinderAccountabilityProvider"
    );
  }
  return ctx;
}
