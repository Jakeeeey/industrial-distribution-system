// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/providers/CylinderInspectionHydrotestProvider.tsx
// ==============================================================================
// State Management Context for Cylinder Inspection and Hydrotest Due Report
// Performance Enhancements:
// 1. Instant client-side pagination: navigating pages or rows-per-page never triggers network reload.
// 2. Network fetch triggers ONLY when core criteria change (branch, status, condition, horizon, search, retired).
// ==============================================================================

"use client";

import * as React from "react";
import type {
  CylinderInspectionRecord,
  CylinderInspectionReportResponse,
  CylinderInspectionLookupsResponse,
} from "../types/cylinder-inspection-hydrotest.types";
import type { CylinderInspectionFilterInput } from "../types/cylinder-inspection-hydrotest.schema";
import { toast } from "sonner";

interface CylinderInspectionContextType {
  report: CylinderInspectionReportResponse | null;
  paginatedRows: CylinderInspectionRecord[];
  totalCount: number;
  lookups: CylinderInspectionLookupsResponse | null;
  filters: CylinderInspectionFilterInput;
  setFilters: (newFilters: Partial<CylinderInspectionFilterInput>) => void;
  resetFilters: () => void;
  selectedRecord: CylinderInspectionRecord | null;
  setSelectedRecord: (record: CylinderInspectionRecord | null) => void;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const defaultFilters: CylinderInspectionFilterInput = {
  branchId: undefined,
  complianceStatus: "ALL",
  condition: "ALL",
  warningDays: 30,
  productId: undefined,
  searchQuery: "",
  includeRetired: false,
  page: 1,
  pageSize: 10,
  sortBy: "expirationDate",
  sortOrder: "asc",
};

const CylinderInspectionContext = React.createContext<CylinderInspectionContextType | undefined>(undefined);

export function CylinderInspectionHydrotestProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = React.useState<CylinderInspectionFilterInput>(defaultFilters);
  const [report, setReport] = React.useState<CylinderInspectionReportResponse | null>(null);
  const [lookups, setLookups] = React.useState<CylinderInspectionLookupsResponse | null>(null);
  const [selectedRecord, setSelectedRecord] = React.useState<CylinderInspectionRecord | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Load lookup options on mount
  React.useEffect(() => {
    async function loadLookups() {
      try {
        const res = await fetch("/api/ids/arf/cylinder-condition-and-compliance/cylinder-inspection-due-report?mode=lookups");
        const json = await res.json();
        if (json.success && json.data) {
          setLookups(json.data);
        }
      } catch (err) {
        console.error("Failed to load inspection report lookups:", err);
      }
    }
    loadLookups();
  }, []);

  // Fetch report data on core filter changes (excluding page / pageSize)
  const fetchReport = React.useCallback(async (appliedFilters: CylinderInspectionFilterInput) => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams();
      if (appliedFilters.branchId) q.set("branchId", appliedFilters.branchId);
      if (appliedFilters.complianceStatus) q.set("complianceStatus", appliedFilters.complianceStatus);
      if (appliedFilters.condition) q.set("condition", appliedFilters.condition);
      if (appliedFilters.warningDays) q.set("warningDays", String(appliedFilters.warningDays));
      if (appliedFilters.productId) q.set("productId", String(appliedFilters.productId));
      if (appliedFilters.searchQuery) q.set("searchQuery", appliedFilters.searchQuery);
      if (appliedFilters.includeRetired) q.set("includeRetired", "true");
      q.set("sortBy", appliedFilters.sortBy || "expirationDate");
      q.set("sortOrder", appliedFilters.sortOrder || "asc");

      const res = await fetch(`/api/ids/arf/cylinder-condition-and-compliance/cylinder-inspection-due-report?${q.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setReport(json.data);
      } else {
        toast.error(json.error || "Failed to load cylinder inspection report");
      }
    } catch (err) {
      console.error("Error fetching cylinder inspection report:", err);
      toast.error("Network error while loading inspection report");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Track criteria signature to only fetch when server criteria changes
  const criteriaKey = React.useMemo(() => {
    return [
      filters.branchId,
      filters.complianceStatus,
      filters.condition,
      filters.warningDays,
      filters.productId,
      filters.searchQuery,
      filters.includeRetired,
      filters.sortBy,
      filters.sortOrder,
    ].join("::");
  }, [
    filters.branchId,
    filters.complianceStatus,
    filters.condition,
    filters.warningDays,
    filters.productId,
    filters.searchQuery,
    filters.includeRetired,
    filters.sortBy,
    filters.sortOrder,
  ]);

  // Keep a ref to the latest filters to avoid stale closure issues during fetch calls
  const filtersRef = React.useRef(filters);
  filtersRef.current = filters;

  React.useEffect(() => {
    fetchReport(filtersRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteriaKey]);

  // Zero-latency in-memory pagination: instant page transitions without loading spinners
  const allRows = report?.rows || [];
  const totalCount = report?.totalCount ?? allRows.length;

  const paginatedRows = React.useMemo(() => {
    const page = filters.page || 1;
    const size = filters.pageSize || 10;
    const startIndex = (page - 1) * size;
    return allRows.slice(startIndex, startIndex + size);
  }, [allRows, filters.page, filters.pageSize]);

  const setFilters = React.useCallback((newFilters: Partial<CylinderInspectionFilterInput>) => {
    setFiltersState((prev) => {
      // Reset page to 1 when non-pagination filters are modified
      const isPaginationOnly = Object.keys(newFilters).every((k) => k === "page" || k === "pageSize");
      return {
        ...prev,
        ...newFilters,
        page: isPaginationOnly ? (newFilters.page ?? prev.page) : 1,
      };
    });
  }, []);

  const resetFilters = React.useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  const refresh = React.useCallback(async () => {
    await fetchReport(filters);
  }, [fetchReport, filters]);

  return (
    <CylinderInspectionContext.Provider
      value={{
        report,
        paginatedRows,
        totalCount,
        lookups,
        filters,
        setFilters,
        resetFilters,
        selectedRecord,
        setSelectedRecord,
        isLoading,
        refresh,
      }}
    >
      {children}
    </CylinderInspectionContext.Provider>
  );
}

export function useCylinderInspection() {
  const ctx = React.useContext(CylinderInspectionContext);
  if (!ctx) {
    throw new Error("useCylinderInspection must be used within a CylinderInspectionHydrotestProvider");
  }
  return ctx;
}
