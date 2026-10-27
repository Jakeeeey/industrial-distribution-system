// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/providers/CylinderStockReportProvider.tsx
// ==============================================================================
// Cylinder Stock Report - React Context Provider
// Manages global filter state, server data queries, loading states, and drawer selection.
// ==============================================================================

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type {
  CylinderStockRecord,
  CylinderStockKPISummary,
  CylinderStockReportCharts,
  CylinderStockLookupsResponse,
} from "../types/cylinder-stock-report.types";
import type { CylinderStockFilterInput } from "../types/cylinder-stock-report.schema";

interface CylinderStockContextValue {
  // Data State
  rows: CylinderStockRecord[];
  totalCount: number;
  kpis: CylinderStockKPISummary | null;
  charts: CylinderStockReportCharts | null;
  lookups: CylinderStockLookupsResponse;
  reportingCutoff: string;
  isLoading: boolean;
  error: string | null;

  // Filter State
  filters: CylinderStockFilterInput;
  setFilters: React.Dispatch<React.SetStateAction<CylinderStockFilterInput>>;
  updateFilter: <K extends keyof CylinderStockFilterInput>(key: K, value: CylinderStockFilterInput[K]) => void;
  resetFilters: () => void;
  refreshData: () => void;

  // Drawer Inspection State
  selectedRecord: CylinderStockRecord | null;
  isDrawerOpen: boolean;
  openDrawer: (record: CylinderStockRecord) => void;
  closeDrawer: () => void;
}

const defaultFilters: CylinderStockFilterInput = {
  branchId: undefined,
  productId: undefined,
  variantState: undefined,
  condition: "ALL",
  status: "ALL",
  cutoffDate: undefined,
  search: "",
  page: 1,
  limit: 25,
  sortField: "serialNumber",
  sortOrder: "asc",
};

const CylinderStockContext = createContext<CylinderStockContextValue | undefined>(undefined);

export function CylinderStockReportProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<CylinderStockFilterInput>(defaultFilters);
  const [rows, setRows] = useState<CylinderStockRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<CylinderStockKPISummary | null>(null);
  const [charts, setCharts] = useState<CylinderStockReportCharts | null>(null);
  const [reportingCutoff, setReportingCutoff] = useState("");
  const [lookups, setLookups] = useState<CylinderStockLookupsResponse>({
    branches: [],
    products: [],
    variantStates: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer state
  const [selectedRecord, setSelectedRecord] = useState<CylinderStockRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch Lookups on Mount
  useEffect(() => {
    async function loadLookups() {
      try {
        const res = await fetch("/api/ids/scm/inventory-management/reports/cylinder-stock-report?lookups=true");
        if (res.ok) {
          const json = await res.json();
          if (json.data) setLookups(json.data);
        }
      } catch (err) {
        console.error("Failed to load lookups:", err);
      }
    }
    loadLookups();
  }, []);

  // Fetch Report Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.branchId) q.set("branchId", String(filters.branchId));
      if (filters.productId) q.set("productId", String(filters.productId));
      if (filters.variantState && filters.variantState !== "ALL") q.set("variantState", filters.variantState);
      if (filters.condition && filters.condition !== "ALL") q.set("condition", filters.condition);
      if (filters.status && filters.status !== "ALL") q.set("status", filters.status);
      if (filters.cutoffDate) q.set("cutoffDate", filters.cutoffDate);
      if (filters.search) q.set("search", filters.search);
      q.set("page", String(filters.page || 1));
      q.set("limit", String(filters.limit || 25));
      q.set("sortField", filters.sortField || "serialNumber");
      q.set("sortOrder", filters.sortOrder || "asc");

      const res = await fetch(`/api/ids/scm/inventory-management/reports/cylinder-stock-report?${q.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }
      const data = await res.json();

      setRows(data.rows || []);
      setTotalCount(data.totalCount || 0);
      setKpis(data.kpis || null);
      setCharts(data.charts || null);
      setReportingCutoff(data.reportingCutoff || "");
    } catch (err) {
      console.error("Error fetching Cylinder Stock Report:", err);
      setError(err instanceof Error ? err.message : "Failed to load report data");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateFilter = useCallback(
    <K extends keyof CylinderStockFilterInput>(key: K, value: CylinderStockFilterInput[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
        page: key === "page" ? (value as number) : 1, // Reset page on non-pagination filter changes
      }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const openDrawer = useCallback((record: CylinderStockRecord) => {
    setSelectedRecord(record);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedRecord(null);
  }, []);

  return (
    <CylinderStockContext.Provider
      value={{
        rows,
        totalCount,
        kpis,
        charts,
        lookups,
        reportingCutoff,
        isLoading,
        error,
        filters,
        setFilters,
        updateFilter,
        resetFilters,
        refreshData: fetchData,
        selectedRecord,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </CylinderStockContext.Provider>
  );
}

export function useCylinderStockReport() {
  const context = useContext(CylinderStockContext);
  if (!context) {
    throw new Error("useCylinderStockReport must be used within a CylinderStockReportProvider");
  }
  return context;
}
