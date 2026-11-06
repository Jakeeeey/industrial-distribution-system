// providers/CustomerCylinderAgingProvider.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Client state provider for Customer Cylinder Aging Report.
// Manages filter controls, selected cylinder drawer state, active query, and pagination.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import type {
  CustomerCylinderAgingFilters,
  CustomerCylinderAgingReportResponse,
  CustomerCylinderAgingLookupsResponse,
  CustomerCylinderAgingItem,
} from "../types/customer-cylinder-aging.types";

interface CustomerCylinderAgingContextValue {
  filters: CustomerCylinderAgingFilters;
  setFilters: React.Dispatch<React.SetStateAction<CustomerCylinderAgingFilters>>;
  updateFilter: <K extends keyof CustomerCylinderAgingFilters>(
    key: K,
    val: CustomerCylinderAgingFilters[K]
  ) => void;
  resetFilters: () => void;
  reportData: CustomerCylinderAgingReportResponse | null;
  lookups: CustomerCylinderAgingLookupsResponse | null;
  isLoading: boolean;
  error: string | null;
  selectedItem: CustomerCylinderAgingItem | null;
  setSelectedItem: (item: CustomerCylinderAgingItem | null) => void;
  refresh: () => void;
}

const defaultFilters: CustomerCylinderAgingFilters = {
  asOfDate: new Date().toISOString().split("T")[0],
  branchId: "",
  customerCode: "",
  productId: "",
  agingBucket: "ALL",
  agingThreshold: 30,
  searchQuery: "",
};

const CustomerCylinderAgingContext = React.createContext<
  CustomerCylinderAgingContextValue | undefined
>(undefined);

export function CustomerCylinderAgingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [filters, setFilters] = React.useState<CustomerCylinderAgingFilters>(defaultFilters);
  const [reportData, setReportData] = React.useState<CustomerCylinderAgingReportResponse | null>(null);
  const [lookups, setLookups] = React.useState<CustomerCylinderAgingLookupsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<CustomerCylinderAgingItem | null>(null);

  const updateFilter = React.useCallback(
    <K extends keyof CustomerCylinderAgingFilters>(
      key: K,
      val: CustomerCylinderAgingFilters[K]
    ) => {
      setFilters((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  const resetFilters = React.useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  // Fetch Lookups
  React.useEffect(() => {
    let active = true;
    async function loadLookups() {
      try {
        const res = await fetch(
          "/api/ids/bia/cylinder-analytics/customer-cylinder-aging-report?mode=lookups"
        );
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.success) {
          setLookups(json.data);
        }
      } catch (err) {
        console.error("Failed to load lookups", err);
      }
    }
    loadLookups();
    return () => {
      active = false;
    };
  }, []);

  // Fetch Report Data
  const fetchReport = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.asOfDate) q.set("asOfDate", filters.asOfDate);
      if (filters.branchId) q.set("branchId", String(filters.branchId));
      if (filters.customerCode) q.set("customerCode", filters.customerCode);
      if (filters.productId) q.set("productId", String(filters.productId));
      if (filters.agingBucket) q.set("agingBucket", filters.agingBucket);
      if (filters.agingThreshold) q.set("agingThreshold", String(filters.agingThreshold));
      if (filters.searchQuery) q.set("searchQuery", filters.searchQuery);

      const res = await fetch(
        `/api/ids/bia/cylinder-analytics/customer-cylinder-aging-report?${q.toString()}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load cylinder aging report");
      }
      setReportData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading report");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchReport();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchReport]);

  return (
    <CustomerCylinderAgingContext.Provider
      value={{
        filters,
        setFilters,
        updateFilter,
        resetFilters,
        reportData,
        lookups,
        isLoading,
        error,
        selectedItem,
        setSelectedItem,
        refresh: fetchReport,
      }}
    >
      {children}
    </CustomerCylinderAgingContext.Provider>
  );
}

export function useCustomerCylinderAging() {
  const ctx = React.useContext(CustomerCylinderAgingContext);
  if (!ctx) {
    throw new Error(
      "useCustomerCylinderAging must be used within a CustomerCylinderAgingProvider"
    );
  }
  return ctx;
}
