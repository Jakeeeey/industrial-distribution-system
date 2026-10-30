// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/providers/StockMovementVarianceReportProvider.tsx
// ==============================================================================
// State Provider for Stock Movement and Variance Report.
// Owns filter state, dynamic lookups, the reconciled report fetch, search
// narrowing and the supporting-record drill-down lifecycle.
//
// The report is only meaningful inside one branch, so the first authorized branch
// resolved from the lookups becomes the default scope.
// ==============================================================================

"use client";

import * as React from "react";
import type {
  StockMovementVarianceFilters,
  StockMovementVarianceLookupOptions,
  StockMovementVarianceReportResponse,
  StockMovementVarianceRow,
} from "../types/stock-movement-variance.types";
import {
  fetchStockMovementVarianceReport,
  fetchStockMovementVarianceLookups,
} from "../services/stock-movement-variance.repo";
import { exportStockMovementVarianceToExcel } from "../services/stock-movement-variance.xlsx";
import { exportStockMovementVarianceToPdf } from "../services/stock-movement-variance.pdf";

export interface StockMovementVarianceContextValue {
  report: StockMovementVarianceReportResponse | null;
  lookups: StockMovementVarianceLookupOptions | null;
  filters: StockMovementVarianceFilters;
  setFilters: React.Dispatch<React.SetStateAction<StockMovementVarianceFilters>>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onlyExceptions: boolean;
  setOnlyExceptions: (value: boolean) => void;
  isLoading: boolean;
  isLookingUp: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  exportExcel: () => void;
  exportPdf: () => void;
  // Supporting-record drill-down state
  selectedRow: StockMovementVarianceRow | null;
  openRowDetail: (row: StockMovementVarianceRow) => void;
  closeRowDetail: () => void;
}

export const StockMovementVarianceContext = React.createContext<
  StockMovementVarianceContextValue | undefined
>(undefined);

/** First day of the current month, expressed as the natural period start. */
function startOfMonth(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0];
}

export function StockMovementVarianceReportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const now = React.useMemo(() => new Date(), []);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filters, setFilters] = React.useState<StockMovementVarianceFilters>(() => ({
    startDate: startOfMonth(now),
    endDate: now.toISOString().split("T")[0],
    branchId: "",
  }));

  const [searchQuery, setSearchQuery] = React.useState("");
  const [onlyExceptions, setOnlyExceptions] = React.useState(false);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [report, setReport] = React.useState<StockMovementVarianceReportResponse | null>(null);
  const [lookups, setLookups] = React.useState<StockMovementVarianceLookupOptions | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLookingUp, setIsLookingUp] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // ── Drill-down state ────────────────────────────────────────────────────────
  const [selectedRow, setSelectedRow] = React.useState<StockMovementVarianceRow | null>(null);

  // Branch scope is required before the ledger can be queried at all.
  const branchChosen = filters.branchId !== undefined && filters.branchId !== "";

  // ── Lookups ─────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLookingUp(true);
      try {
        const options = await fetchStockMovementVarianceLookups();
        if (cancelled) return;
        setLookups(options);

        // Default the scope so the page renders something on first load.
        setFilters((current) =>
          current.branchId === "" && options.branches.length > 0
            ? { ...current, branchId: options.branches[0].id }
            : current
        );
      } catch (err) {
        console.error("[StockMovementVarianceProvider] Lookup failure:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load filter options");
        }
      } finally {
        if (!cancelled) setIsLookingUp(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Report fetch ────────────────────────────────────────────────────────────
  const loadReport = React.useCallback(async (activeFilters: StockMovementVarianceFilters) => {
    if (activeFilters.branchId === undefined || activeFilters.branchId === "") return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchStockMovementVarianceReport(activeFilters);
      setReport(data);
    } catch (err) {
      console.error("[StockMovementVarianceProvider] Report failure:", err);
      setError(err instanceof Error ? err.message : "Failed to load the variance dataset");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!branchChosen) return;
    loadReport(filters);
  }, [filters, branchChosen, loadReport]);

  const refresh = React.useCallback(async () => {
    await loadReport(filters);
  }, [filters, loadReport]);

  // ── Exports ─────────────────────────────────────────────────────────────────
  const exportExcel = React.useCallback(() => {
    if (!report) return;
    exportStockMovementVarianceToExcel(report);
  }, [report]);

  const exportPdf = React.useCallback(() => {
    if (!report) return;
    exportStockMovementVarianceToPdf(report);
  }, [report]);

  // ── Drill-down ──────────────────────────────────────────────────────────────
  const openRowDetail = React.useCallback((row: StockMovementVarianceRow) => {
    setSelectedRow(row);
  }, []);

  const closeRowDetail = React.useCallback(() => {
    setSelectedRow(null);
  }, []);

  const value = React.useMemo<StockMovementVarianceContextValue>(
    () => ({
      report,
      lookups,
      filters,
      setFilters,
      searchQuery,
      setSearchQuery,
      onlyExceptions,
      setOnlyExceptions,
      isLoading,
      isLookingUp,
      error,
      refresh,
      exportExcel,
      exportPdf,
      selectedRow,
      openRowDetail,
      closeRowDetail,
    }),
    [
      report,
      lookups,
      filters,
      searchQuery,
      onlyExceptions,
      isLoading,
      isLookingUp,
      error,
      refresh,
      exportExcel,
      exportPdf,
      selectedRow,
      openRowDetail,
      closeRowDetail,
    ]
  );

  return (
    <StockMovementVarianceContext.Provider value={value}>
      {children}
    </StockMovementVarianceContext.Provider>
  );
}
