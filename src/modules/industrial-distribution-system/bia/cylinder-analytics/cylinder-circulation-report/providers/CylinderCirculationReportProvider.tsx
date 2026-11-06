// providers/CylinderCirculationReportProvider.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Centralized React Context Provider for Cylinder Circulation Report.
// Manages filter states, lookup data, report data fetching, pagination, and drilldown modal state.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import type {
  CylinderCirculationFilters,
  CylinderCirculationReportResponse,
  CylinderCirculationItem,
  LookupOption,
} from "../types/cylinder-circulation.types";
import {
  fetchCylinderCirculationReport,
  fetchCylinderCirculationLookups,
} from "../services/cylinder-circulation.repo";

interface CylinderCirculationContextValue {
  filters: CylinderCirculationFilters;
  setFilters: React.Dispatch<React.SetStateAction<CylinderCirculationFilters>>;
  updateFilter: <K extends keyof CylinderCirculationFilters>(
    key: K,
    value: CylinderCirculationFilters[K]
  ) => void;
  resetFilters: () => void;
  reportData: CylinderCirculationReportResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  branches: LookupOption[];
  products: LookupOption[];
  lookupsLoading: boolean;
  selectedCylinder: CylinderCirculationItem | null;
  setSelectedCylinder: (item: CylinderCirculationItem | null) => void;
}

const defaultFilters: CylinderCirculationFilters = {
  branchId: "",
  productId: "",
  circulationStatus: "ALL",
  serialNumber: "",
  startDate: "",
  endDate: "",
};

const CylinderCirculationContext = React.createContext<
  CylinderCirculationContextValue | undefined
>(undefined);

export function CylinderCirculationReportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [filters, setFilters] = React.useState<CylinderCirculationFilters>(defaultFilters);
  const [reportData, setReportData] = React.useState<CylinderCirculationReportResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [branches, setBranches] = React.useState<LookupOption[]>([]);
  const [products, setProducts] = React.useState<LookupOption[]>([]);
  const [lookupsLoading, setLookupsLoading] = React.useState<boolean>(true);

  const [selectedCylinder, setSelectedCylinder] = React.useState<CylinderCirculationItem | null>(null);

  // Load dropdown lookups on initial mount
  React.useEffect(() => {
    let isMounted = true;
    async function loadLookups() {
      try {
        setLookupsLoading(true);
        const data = await fetchCylinderCirculationLookups();
        if (isMounted) {
          setBranches(data.branches || []);
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error("Failed to load cylinder circulation lookups:", err);
      } finally {
        if (isMounted) setLookupsLoading(false);
      }
    }
    loadLookups();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadReport = React.useCallback(async (appliedFilters: CylinderCirculationFilters) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCylinderCirculationReport(appliedFilters);
      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch report whenever filters change
  React.useEffect(() => {
    loadReport(filters);
  }, [filters, loadReport]);

  const updateFilter = React.useCallback(
    <K extends keyof CylinderCirculationFilters>(
      key: K,
      value: CylinderCirculationFilters[K]
    ) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const resetFilters = React.useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const refresh = React.useCallback(async () => {
    await loadReport(filters);
  }, [filters, loadReport]);

  const value = React.useMemo<CylinderCirculationContextValue>(
    () => ({
      filters,
      setFilters,
      updateFilter,
      resetFilters,
      reportData,
      loading,
      error,
      refresh,
      branches,
      products,
      lookupsLoading,
      selectedCylinder,
      setSelectedCylinder,
    }),
    [
      filters,
      updateFilter,
      resetFilters,
      reportData,
      loading,
      error,
      refresh,
      branches,
      products,
      lookupsLoading,
      selectedCylinder,
    ]
  );

  return (
    <CylinderCirculationContext.Provider value={value}>
      {children}
    </CylinderCirculationContext.Provider>
  );
}

export function useCylinderCirculationReport(): CylinderCirculationContextValue {
  const context = React.useContext(CylinderCirculationContext);
  if (!context) {
    throw new Error(
      "useCylinderCirculationReport must be used within a CylinderCirculationReportProvider"
    );
  }
  return context;
}
