// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/providers/SalesPerformanceProvider.tsx
// ==============================================================================
// Sales Performance Report - React Context Provider
// Manages reactive filter state, debounce queries, data fetching, lookups, and drawer.
// ==============================================================================

"use client";

import * as React from "react";
import type { SalesPerformanceFilterInput } from "../types/sales-performance.schema";
import type {
  SalesPerformanceReportResponse,
  SalesPerformanceLookupsResponse,
  SalesPerformanceRecord,
  DatePresetType,
} from "../types/sales-performance.types";
import {
  fetchSalesPerformanceReportClient,
  fetchSalesPerformanceLookupsClient,
} from "../services/sales-performance.repo";
import { exportSalesPerformanceToExcel } from "../services/sales-performance.export";

interface SalesPerformanceContextValue {
  report: SalesPerformanceReportResponse | null;
  lookups: SalesPerformanceLookupsResponse | null;
  filters: SalesPerformanceFilterInput;
  isLoading: boolean;
  isLoadingLookups: boolean;
  error: string | null;
  selectedRecord: SalesPerformanceRecord | null;
  isPrintModalOpen: boolean;
  setFilter: <K extends keyof SalesPerformanceFilterInput>(
    key: K,
    val: SalesPerformanceFilterInput[K]
  ) => void;
  setDatePreset: (preset: DatePresetType) => void;
  applyFilters: (newFilters: SalesPerformanceFilterInput) => void;
  resetFilters: () => void;
  refreshData: () => Promise<void>;
  exportExcel: () => void;
  setSelectedRecord: (r: SalesPerformanceRecord | null) => void;
  setIsPrintModalOpen: (open: boolean) => void;
}

const SalesPerformanceContext = React.createContext<SalesPerformanceContextValue | null>(null);

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return {
    startDate: `${y}-${m}-01`,
    endDate: `${y}-${m}-${d}`,
  };
}

const defaultRange = getDefaultDateRange();

const initialFilters: SalesPerformanceFilterInput = {
  branchId: "ALL",
  customerCode: "ALL",
  productId: "ALL",
  salesmanId: "ALL",
  startDate: defaultRange.startDate,
  endDate: defaultRange.endDate,
  datePreset: "this_month",
  taxTreatment: "ALL",
  searchQuery: "",
  page: 1,
  pageSize: 10,
  sortBy: "invoiceDate",
  sortOrder: "desc",
};

export function SalesPerformanceProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = React.useState<SalesPerformanceFilterInput>(initialFilters);
  const [report, setReport] = React.useState<SalesPerformanceReportResponse | null>(null);
  const [lookups, setLookups] = React.useState<SalesPerformanceLookupsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = React.useState<SalesPerformanceRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false);

  // Load initial dropdown lookups
  React.useEffect(() => {
    let mounted = true;
    setIsLoadingLookups(true);
    fetchSalesPerformanceLookupsClient()
      .then((data) => {
        if (mounted) setLookups(data);
      })
      .catch((err) => {
        console.warn("[SalesPerformanceProvider] Failed to fetch lookups:", err);
      })
      .finally(() => {
        if (mounted) setIsLoadingLookups(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch report data on filter changes
  const loadReport = React.useCallback(async (appliedFilters: SalesPerformanceFilterInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSalesPerformanceReportClient(appliedFilters);
      setReport(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadReport(filters);
  }, [filters, loadReport]);

  const setFilter = React.useCallback(
    <K extends keyof SalesPerformanceFilterInput>(key: K, val: SalesPerformanceFilterInput[K]) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: val };
        // Reset page to 1 when changing query parameters
        if (key !== "page") {
          next.page = 1;
        }
        return next;
      });
    },
    []
  );

  const setDatePreset = React.useCallback((preset: DatePresetType) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    let start = todayStr;
    const end = todayStr;

    if (preset === "today") {
      start = todayStr;
    } else if (preset === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const mon = new Date(now.setDate(diff));
      start = mon.toISOString().split("T")[0];
    } else if (preset === "this_month") {
      start = `${y}-${m}-01`;
    }

    setFilters((prev) => ({
      ...prev,
      datePreset: preset,
      startDate: start,
      endDate: end,
      page: 1,
    }));
  }, []);

  // DEV-RULE: Explicit Apply Filters function called only upon clicking 'Apply Filter' button
  const applyFilters = React.useCallback((newFilters: SalesPerformanceFilterInput) => {
    setFilters({ ...newFilters, page: 1 });
  }, []);

  const resetFilters = React.useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const refreshData = React.useCallback(async () => {
    await loadReport(filters);
  }, [filters, loadReport]);

  const exportExcel = React.useCallback(() => {
    if (!report) return;
    exportSalesPerformanceToExcel(report, filters);
  }, [report, filters]);

  const value: SalesPerformanceContextValue = {
    report,
    lookups,
    filters,
    isLoading,
    isLoadingLookups,
    error,
    selectedRecord,
    isPrintModalOpen,
    setFilter,
    setDatePreset,
    applyFilters,
    resetFilters,
    refreshData,
    exportExcel,
    setSelectedRecord,
    setIsPrintModalOpen,
  };

  return (
    <SalesPerformanceContext.Provider value={value}>
      {children}
    </SalesPerformanceContext.Provider>
  );
}

export function useSalesPerformance() {
  const ctx = React.useContext(SalesPerformanceContext);
  if (!ctx) {
    throw new Error("useSalesPerformance must be used within a SalesPerformanceProvider");
  }
  return ctx;
}
