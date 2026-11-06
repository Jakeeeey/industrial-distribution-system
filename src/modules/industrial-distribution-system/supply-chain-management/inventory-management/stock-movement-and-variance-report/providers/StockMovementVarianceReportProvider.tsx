// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/providers/StockMovementVarianceReportProvider.tsx
// ==============================================================================
// State Provider for Stock Movement and Variance Report.
// Owns the filter form, dynamic lookups, the reconciled report fetch, search
// narrowing and the supporting-record drill-down lifecycle.
//
// Loading discipline (platform-wide report convention): the form opens with a
// default window but NOTHING is fetched until Apply is clicked, and the figures
// only ever change on Apply. Draft edits, Reset and the local search box must
// never trigger a ledger read on their own — these numbers are read as an answer
// about the period shown, so an auto-loaded period would be indistinguishable
// from a deliberate one.
//
// Branch scope: an empty branchId means "All branches" and is a valid scope; the
// BFF reconciles each branch separately and merges the lines.
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
  /** Live form values. Changing these never reads the ledger. */
  draft: StockMovementVarianceFilters;
  setDraft: React.Dispatch<React.SetStateAction<StockMovementVarianceFilters>>;
  /** The parameter set the displayed figures were produced from, until Apply. */
  appliedFilters: StockMovementVarianceFilters | null;
  /** Draft differs from what is on screen, so Apply is pending. */
  isDirty: boolean;
  /** Draft cannot produce a report, e.g. an inverted period. */
  isApplyBlocked: boolean;
  apply: () => void;
  reset: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
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

/** Opening window of the form: the current month, with no branch narrowing. */
function defaultFilters(): StockMovementVarianceFilters {
  const now = new Date();
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;

  return {
    startDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: iso(now),
    branchId: "", // "" is the All-branches scope
  };
}

/** Compares a draft against the applied set so Apply can show a pending state. */
function isSameFilters(
  a: StockMovementVarianceFilters | null,
  b: StockMovementVarianceFilters
): boolean {
  if (!a) return false;
  return (
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    String(a.branchId ?? "") === String(b.branchId ?? "") &&
    String(a.categoryId ?? "") === String(b.categoryId ?? "") &&
    String(a.productId ?? "") === String(b.productId ?? "")
  );
}

export function StockMovementVarianceReportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Filter state ────────────────────────────────────────────────────────────
  const [draft, setDraft] = React.useState<StockMovementVarianceFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    React.useState<StockMovementVarianceFilters | null>(null);

  const [searchQuery, setSearchQuery] = React.useState("");

  // ── Data state ──────────────────────────────────────────────────────────────
  const [report, setReport] = React.useState<StockMovementVarianceReportResponse | null>(null);
  const [lookups, setLookups] = React.useState<StockMovementVarianceLookupOptions | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLookingUp, setIsLookingUp] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // ── Drill-down state ────────────────────────────────────────────────────────
  const [selectedRow, setSelectedRow] = React.useState<StockMovementVarianceRow | null>(null);

  // Apply is blocked while the period is incomplete or inverted: a blank date is
  // never a deliberate answer, and the BFF would reject the request anyway.
  const periodInvalid =
    !draft.startDate || !draft.endDate || draft.startDate > draft.endDate;

  // ── Lookups ─────────────────────────────────────────────────────────────────
  // Only the dropdown option lists load on mount; the report itself waits for Apply.
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLookingUp(true);
      try {
        const options = await fetchStockMovementVarianceLookups();
        if (!cancelled) setLookups(options);
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
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchStockMovementVarianceReport(activeFilters);
      setReport(data);
      // A new dataset invalidates whatever line was open in the panel.
      setSelectedRow(null);
    } catch (err) {
      console.error("[StockMovementVarianceProvider] Report failure:", err);
      setError(err instanceof Error ? err.message : "Failed to load the variance dataset");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!appliedFilters) return;
    void loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  const apply = React.useCallback(() => {
    if (periodInvalid) return;
    setAppliedFilters((current) =>
      current && isSameFilters(current, draft) ? { ...current } : { ...draft }
    );
  }, [draft, periodInvalid]);

  // Reset restores the opening window of the form but deliberately keeps the
  // figures already on screen until Apply is pressed again.
  const reset = React.useCallback(() => {
    setDraft(defaultFilters());
    setSearchQuery("");
  }, []);

  const refresh = React.useCallback(async () => {
    if (!appliedFilters) return;
    await loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

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
      draft,
      setDraft,
      appliedFilters,
      isDirty: appliedFilters !== null && !isSameFilters(appliedFilters, draft),
      isApplyBlocked: periodInvalid,
      apply,
      reset,
      searchQuery,
      setSearchQuery,
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
      draft,
      appliedFilters,
      periodInvalid,
      apply,
      reset,
      searchQuery,
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
