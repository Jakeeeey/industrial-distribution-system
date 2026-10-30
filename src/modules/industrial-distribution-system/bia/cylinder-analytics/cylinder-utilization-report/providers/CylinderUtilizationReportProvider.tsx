// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/providers/CylinderUtilizationReportProvider.tsx
// ==============================================================================
// State Provider for the Cylinder Utilization Report (IDS BIA Subsystem)
//
// Owns filter parameters, the report fetch lifecycle, the branch × size drill-down,
// client-side search, pagination and export dispatch. Components stay view-only and
// read everything through the consumer hook, per the Logic Layering Standard.
//
// Refetch discipline: the report re-runs only when a parameter the BFF actually
// consumes changes (period, branch, size). Typing in the search box filters the rows
// already in memory and never hits Directus.
//
// Complies with VoSync standards:
// - Defensive state fallback so a failed fetch renders an empty, retryable grid
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  fetchCylinderUtilizationDetail,
  fetchCylinderUtilizationReport,
  fetchUtilizationLookups,
  exportUtilizationToExcel,
  exportUtilizationToPdf,
} from "../services";
import type {
  CylinderUtilizationDetailResponse,
  CylinderUtilizationFilters,
  CylinderUtilizationReportResponse,
  CylinderUtilizationRow,
  UtilizationBucket,
  UtilizationLookupOptions,
} from "../types/cylinder-utilization-report.types";

/** Identifies the results-grid row the details panel is currently expanded on. */
export interface UtilizationGroupingSelection {
  branchId: number | null;
  productId: number | null;
  branchName: string;
  sizeLabel: string;
}

interface CylinderUtilizationContextValue {
  // Filters
  filters: CylinderUtilizationFilters;
  setFilters: (updated: Partial<CylinderUtilizationFilters>) => void;
  resetFilters: () => void;

  // Report dataset
  reportData: CylinderUtilizationReportResponse | null;
  filteredRows: CylinderUtilizationRow[];
  visibleRows: CylinderUtilizationRow[];
  totalRows: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  // Filter vocabulary
  lookups: UtilizationLookupOptions;
  isLookupsLoading: boolean;

  // In-memory search over the loaded grid
  search: string;
  setSearch: (value: string) => void;

  // Drill-down details panel
  selection: UtilizationGroupingSelection | null;
  selectedBucket: UtilizationBucket | null;
  detail: CylinderUtilizationDetailResponse | null;
  isDetailLoading: boolean;
  openDetail: (row: CylinderUtilizationRow, bucket?: UtilizationBucket | null) => void;
  filterDetailByBucket: (bucket: UtilizationBucket | null) => void;
  closeDetail: () => void;

  // Pagination
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Exports
  exportExcel: () => void;
  exportPdf: () => void;
}

const CylinderUtilizationContext = React.createContext<CylinderUtilizationContextValue | null>(null);

/**
 * Default period: month-to-date, matching the other BIA cylinder reports.
 * Both ends are derived from the Manila calendar day. The opening day is taken as a
 * string slice rather than a Date built in the browser's own timezone, because
 * passing a Manila midnight through toISOString() shifted the default back one day.
 */
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
}

/** Builds the initial filter object so reset and mount cannot drift apart. */
function buildDefaultFilters(): CylinderUtilizationFilters {
  const { startDate, endDate } = getDefaultDateRange();
  return { startDate, endDate, branchId: "ALL", productId: "" };
}

export function CylinderUtilizationReportProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = React.useState<CylinderUtilizationFilters>(buildDefaultFilters);
  const [reportData, setReportData] = React.useState<CylinderUtilizationReportResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [lookups, setLookups] = React.useState<UtilizationLookupOptions>({ branches: [], sizes: [] });
  const [isLookupsLoading, setIsLookupsLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");

  const [selection, setSelection] = React.useState<UtilizationGroupingSelection | null>(null);
  const [selectedBucket, setSelectedBucket] = React.useState<UtilizationBucket | null>(null);
  const [detail, setDetail] = React.useState<CylinderUtilizationDetailResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  // Latest filters without making them a dependency of the fetch callback.
  const filtersRef = React.useRef(filters);
  filtersRef.current = filters;

  /**
   * Only the server-consumed parameters belong in this key. Search is deliberately
   * excluded so filtering the grid never triggers a Directus round-trip.
   */
  const queryKey = React.useMemo(
    () =>
      JSON.stringify({
        startDate: filters.startDate,
        endDate: filters.endDate,
        branchId: filters.branchId ?? "ALL",
        productId: filters.productId ?? "",
      }),
    [filters.startDate, filters.endDate, filters.branchId, filters.productId]
  );

  // ── 1. Filter vocabulary once on mount ────────────────────────────────────
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLookupsLoading(true);
        const data = await fetchUtilizationLookups();
        if (mounted) setLookups(data);
      } catch (err) {
        // Lookups are additive: an empty vocabulary still leaves the report usable.
        console.error("[CylinderUtilizationProvider] Lookups failed:", err);
      } finally {
        if (mounted) setIsLookupsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ── 2. Report dataset on every consumed filter change ─────────────────────
  const loadReport = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchCylinderUtilizationReport(filtersRef.current);
      setReportData(res);
      setCurrentPage(1);
      if (res.rows.length === 0) {
        toast.info("No cylinder assets matched the selected period and branch.");
      }
    } catch (err) {
      console.error("[CylinderUtilizationProvider] Report load failed:", err);
      setError(err instanceof Error && err.message ? err.message : "Failed to load the cylinder utilization report.");
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
    // queryKey is the intentional trigger; the live values are read through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  React.useEffect(() => {
    loadReport();
  }, [loadReport]);

  // ── 3. Search / branch / size narrowing applied in memory ────────────────
  const filteredRows = React.useMemo(() => {
    const rows = reportData?.rows ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) => row.branchName.toLowerCase().includes(term) || row.sizeLabel.toLowerCase().includes(term)
    );
  }, [reportData?.rows, search]);

  const visibleRows = React.useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRows, currentPage, pageSize]
  );

  /** Pulls the supporting cylinders behind one grouping (spec §5). */
  const loadDetail = React.useCallback(
    async (target: UtilizationGroupingSelection, bucket: UtilizationBucket | null) => {
      setIsDetailLoading(true);
      try {
        const res = await fetchCylinderUtilizationDetail(
          { branchId: target.branchId, productId: target.productId, bucket },
          { startDate: filtersRef.current.startDate, endDate: filtersRef.current.endDate }
        );
        setDetail(res);
      } catch (err) {
        console.error("[CylinderUtilizationProvider] Drill-down failed:", err);
        toast.error("Failed to load supporting cylinder records.");
        setDetail(null);
      } finally {
        setIsDetailLoading(false);
      }
    },
    []
  );

  const openDetail = React.useCallback(
    (row: CylinderUtilizationRow, bucket: UtilizationBucket | null = null) => {
      const target: UtilizationGroupingSelection = {
        branchId: row.branchId,
        productId: row.productId,
        branchName: row.branchName,
        sizeLabel: row.sizeLabel,
      };
      setSelection(target);
      setSelectedBucket(bucket);
      void loadDetail(target, bucket);
    },
    [loadDetail]
  );

  /** Re-queries the panel against a single bucket without reopening it. */
  const filterDetailByBucket = React.useCallback(
    (bucket: UtilizationBucket | null) => {
      if (!selection) return;
      setSelectedBucket(bucket);
      void loadDetail(selection, bucket);
    },
    [selection, loadDetail]
  );

  const closeDetail = React.useCallback(() => {
    setSelection(null);
    setSelectedBucket(null);
    setDetail(null);
  }, []);

  const setFilters = React.useCallback((updated: Partial<CylinderUtilizationFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...updated }));
  }, []);

  const resetFilters = React.useCallback(() => {
    setFiltersState(buildDefaultFilters());
    setSearch("");
  }, []);

  const exportExcel = React.useCallback(() => {
    if (!reportData) return;
    exportUtilizationToExcel(reportData);
  }, [reportData]);

  const exportPdf = React.useCallback(() => {
    if (!reportData) return;
    exportUtilizationToPdf(reportData);
  }, [reportData]);

  const value: CylinderUtilizationContextValue = {
    filters,
    setFilters,
    resetFilters,
    reportData,
    filteredRows,
    visibleRows,
    totalRows: filteredRows.length,
    isLoading,
    error,
    refresh: loadReport,
    lookups,
    isLookupsLoading,
    search,
    setSearch,
    selection,
    selectedBucket,
    detail,
    isDetailLoading,
    openDetail,
    filterDetailByBucket,
    closeDetail,
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    exportExcel,
    exportPdf,
  };

  return (
    <CylinderUtilizationContext.Provider value={value}>{children}</CylinderUtilizationContext.Provider>
  );
}

/** Consumer hook — must be used inside CylinderUtilizationReportProvider. */
export function useCylinderUtilizationReportContext(): CylinderUtilizationContextValue {
  const ctx = React.useContext(CylinderUtilizationContext);
  if (!ctx) {
    throw new Error(
      "useCylinderUtilizationReport must be used within a CylinderUtilizationReportProvider"
    );
  }
  return ctx;
}
