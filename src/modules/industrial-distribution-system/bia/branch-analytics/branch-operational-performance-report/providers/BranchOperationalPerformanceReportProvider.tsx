// providers/BranchOperationalPerformanceReportProvider.tsx
// ──────────────────────────────────────────────────────────────────────────────
// React Context Provider for managing the branch operational report lifecycle.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { fetchBranchOperationalReport } from "../services/branch-operational-performance.repo";
import type {
  BranchOperationalFilters,
  BranchOperationalReportResponse,
  IncidentRecord,
} from "../types/branch-operational-performance.types";

export interface BranchOperationalReportContextValue {
  report: BranchOperationalReportResponse | null;
  draftFilters: BranchOperationalFilters;
  appliedFilters: BranchOperationalFilters;
  isLoading: boolean;
  error: string | null;
  selectedIncident: IncidentRecord | null;
  setDraftFilters: React.Dispatch<React.SetStateAction<BranchOperationalFilters>>;
  applyFilters: () => Promise<void>;
  clearFilters: () => Promise<void>;
  refresh: () => Promise<void>;
  selectIncidentForDrillDown: (incident: IncidentRecord | null) => void;
}

export const BranchOperationalReportContext = React.createContext<
  BranchOperationalReportContextValue | undefined
>(undefined);

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export function BranchOperationalPerformanceReportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const defaultDates = React.useMemo(() => getDefaultDateRange(), []);
  const initialFilters: BranchOperationalFilters = React.useMemo(
    () => ({
      branchId: "",
      custodianCode: "",
      incidentType: "all",
      recoveryStatus: "all",
      chargeStatus: "all",
      startDate: defaultDates.startDate,
      endDate: defaultDates.endDate,
    }),
    [defaultDates]
  );

  const [draftFilters, setDraftFilters] = React.useState<BranchOperationalFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = React.useState<BranchOperationalFilters>(initialFilters);
  const [report, setReport] = React.useState<BranchOperationalReportResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = React.useState<IncidentRecord | null>(null);

  const controllerRef = React.useRef<AbortController | null>(null);

  const loadReport = React.useCallback(async (filtersToUse: BranchOperationalFilters) => {
    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchBranchOperationalReport(filtersToUse, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setReport(data);
      }
    } catch (err: unknown) {
      if (!ctrl.signal.aborted) {
        const isAbort =
          typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError";
        if (!isAbort) {
          const msg = err instanceof Error ? err.message : "Failed to load operational report.";
          setError(msg);
        }
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadReport(initialFilters);
    return () => {
      controllerRef.current?.abort();
    };
  }, [initialFilters, loadReport]);

  const applyFilters = React.useCallback(async () => {
    setAppliedFilters(draftFilters);
    setSelectedIncident(null);
    await loadReport(draftFilters);
  }, [draftFilters, loadReport]);

  const clearFilters = React.useCallback(async () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSelectedIncident(null);
    await loadReport(initialFilters);
  }, [initialFilters, loadReport]);

  const refresh = React.useCallback(async () => {
    await loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  const selectIncidentForDrillDown = React.useCallback((incident: IncidentRecord | null) => {
    setSelectedIncident(incident);
  }, []);

  const value = React.useMemo<BranchOperationalReportContextValue>(
    () => ({
      report,
      draftFilters,
      appliedFilters,
      isLoading,
      error,
      selectedIncident,
      setDraftFilters,
      applyFilters,
      clearFilters,
      refresh,
      selectIncidentForDrillDown,
    }),
    [
      report,
      draftFilters,
      appliedFilters,
      isLoading,
      error,
      selectedIncident,
      applyFilters,
      clearFilters,
      refresh,
      selectIncidentForDrillDown,
    ]
  );

  return (
    <BranchOperationalReportContext.Provider value={value}>
      {children}
    </BranchOperationalReportContext.Provider>
  );
}
