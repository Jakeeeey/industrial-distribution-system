// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/providers/LostDamagedCylinderProvider.tsx
// ==============================================================================
// Lost and Damaged Cylinder Report - React Context Provider
// Manages state for filters, pagination, lookups, selected incident drawer,
// and background refetching.
// ==============================================================================

"use client";

import * as React from "react";
import type {
  IncidentRecord,
  LostDamagedReportResponse,
  LostDamagedLookupsResponse,
} from "../types/lost-damaged-cylinder.types";
import type { LostDamagedFilterInput } from "../types/lost-damaged-cylinder.schema";
import {
  fetchLostDamagedReportClient,
  fetchLostDamagedLookupsClient,
} from "../services/lost-damaged-cylinder.repo";
import { exportLostDamagedReportToExcel } from "../services/lost-damaged-cylinder.xlsx";

export interface LostDamagedContextValue {
  // State
  filters: Partial<LostDamagedFilterInput>;
  report: LostDamagedReportResponse | null;
  lookups: LostDamagedLookupsResponse | null;
  isLoading: boolean;
  error: string | null;
  selectedIncident: IncidentRecord | null;

  // Pagination state
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  paginatedRows: IncidentRecord[];

  // Actions
  setFilters: (newFilters: Partial<LostDamagedFilterInput>) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSelectedIncident: (incident: IncidentRecord | null) => void;
  refetch: () => Promise<void>;
  exportExcel: () => void;
  triggerPrint: () => void;
}

const LostDamagedContext = React.createContext<LostDamagedContextValue | undefined>(undefined);

const INITIAL_FILTERS: Partial<LostDamagedFilterInput> = {
  branchId: "ALL",
  datePreset: "ALL",
  incidentCategory: "ALL",
  condition: "ALL",
  status: "ALL",
  chargeStatus: "ALL",
  searchQuery: "",
  sortBy: "incidentDate",
  sortOrder: "desc",
};

export function LostDamagedCylinderProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = React.useState<Partial<LostDamagedFilterInput>>(INITIAL_FILTERS);
  const [report, setReport] = React.useState<LostDamagedReportResponse | null>(null);
  const [lookups, setLookups] = React.useState<LostDamagedLookupsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = React.useState<IncidentRecord | null>(null);

  const [page, setPage] = React.useState<number>(1);
  const [pageSize, setPageSizeState] = React.useState<number>(10);

  // Load lookups on mount
  React.useEffect(() => {
    let mounted = true;
    fetchLostDamagedLookupsClient()
      .then((data) => {
        if (mounted) setLookups(data);
      })
      .catch((err) => {
        console.error("Lookups load failed:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch report whenever filters change
  const loadReport = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLostDamagedReportClient(filters);
      setReport(data);
      setPage(1); // Reset to first page on filter change
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error loading report";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    loadReport();
  }, [loadReport]);

  const setFilters = React.useCallback((newFilters: Partial<LostDamagedFilterInput>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = React.useCallback(() => {
    setFiltersState(INITIAL_FILTERS);
  }, []);

  const setPageSize = React.useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  // Compute pagination
  const allRows = report?.rows || [];
  const totalRows = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIndex = (page - 1) * pageSize;
  const paginatedRows = allRows.slice(startIndex, startIndex + pageSize);

  const exportExcel = React.useCallback(() => {
    if (!report) return;
    exportLostDamagedReportToExcel(report);
  }, [report]);

  const triggerPrint = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

  const value: LostDamagedContextValue = {
    filters,
    report,
    lookups,
    isLoading,
    error,
    selectedIncident,
    page,
    pageSize,
    totalRows,
    totalPages,
    paginatedRows,
    setFilters,
    resetFilters,
    setPage,
    setPageSize,
    setSelectedIncident,
    refetch: loadReport,
    exportExcel,
    triggerPrint,
  };

  return <LostDamagedContext.Provider value={value}>{children}</LostDamagedContext.Provider>;
}

export function useLostDamagedCylinder(): LostDamagedContextValue {
  const context = React.useContext(LostDamagedContext);
  if (!context) {
    throw new Error("useLostDamagedCylinder must be used within a LostDamagedCylinderProvider");
  }
  return context;
}
