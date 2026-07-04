// providers/CustomerCylinderAgingProvider.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Single Context + Provider + consumer hook for the Customer Cylinder Aging module.
// Pattern mirrors: PostingOfPoProvider.tsx
//
// Revamped: Data now sourced from Directus (via BFF) instead of Spring Boot.
// Auto-fetch on mount is restored — Directus has no mandatory-param restriction.
// Fetch is triggered on mount AND when user clicks Apply.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { toast } from "sonner";
import { fetchCustomerCylinderAgingSummary, fetchCustomerCylinderDetail } from "../services";
import type {
  CustomerCylinderAgingRecord,
  CustomerCylinderAgingFilters,
  CustomerCylinderAgingSummary,
  CustomerCylinderDetail,
} from "../types/customer-cylinder-aging.types";

// ── Context shape ─────────────────────────────────────────────────────────────
type Ctx = {
  // Data
  records: CustomerCylinderAgingRecord[];
  summaries: CustomerCylinderAgingSummary[];
  isLoading: boolean;
  error: string;

  // View state
  viewMode: "summary" | "detail";
  selectedCustomerCode: string | null;
  customerDetail: CustomerCylinderDetail | null;

  // Actions
  selectCustomer: (customerCode: string) => Promise<void>;
  backToSummary: () => void;

  // Filters — staged (not yet applied)
  filters: CustomerCylinderAgingFilters;
  setFilters: React.Dispatch<React.SetStateAction<CustomerCylinderAgingFilters>>;

  // Apply triggers the fetch
  applyFilters: () => Promise<void>;

  // Client-side search (operates on current records without re-fetching)
  search: string;
  setSearch: (v: string) => void;

  // Pagination
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
};

const CustomerCylinderAgingContext = React.createContext<Ctx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function CustomerCylinderAgingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Data state
  const [records, setRecords] = React.useState<CustomerCylinderAgingRecord[]>([]);
  const [summaries, setSummaries] = React.useState<CustomerCylinderAgingSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // View state
  const [viewMode, setViewMode] = React.useState<"summary" | "detail">("summary");
  const [selectedCustomerCode, setSelectedCustomerCode] = React.useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = React.useState<CustomerCylinderDetail | null>(null);

  // Filter state (staged — not applied until user clicks Apply)
  const [filters, setFilters] = React.useState<CustomerCylinderAgingFilters>({});

  // Client-side search
  const [search, setSearch] = React.useState("");

  // Pagination
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(25);

  /**
   * Fetches records from the BFF using the current staged filters.
   * Resets pagination to page 1 on each fetch.
   */
  const applyFilters = React.useCallback(async () => {
    setIsLoading(true);
    setError("");
    setPage(1);

    try {
      if (viewMode === "summary") {
        const data = await fetchCustomerCylinderAgingSummary(filters);
        setSummaries(data);
        if (data.length === 0) {
          toast.info("No records found for the selected filters.");
        }
      } else if (viewMode === "detail" && selectedCustomerCode) {
        const data = await fetchCustomerCylinderDetail(selectedCustomerCode, filters);
        setCustomerDetail(data);
        setRecords(data.connectedCylinders);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Suppress generic network errors from polluting the UI
      if (msg.trim().toLowerCase() !== "fetch failed") {
        setError(msg);
        toast.error("Failed to fetch cylinder aging data", { description: msg });
      }
      if (viewMode === "summary") {
        setSummaries([]);
      } else {
        setCustomerDetail(null);
        setRecords([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [filters, viewMode, selectedCustomerCode]);

  const selectCustomer = React.useCallback(async (customerCode: string) => {
    setIsLoading(true);
    setError("");
    setSelectedCustomerCode(customerCode);
    setViewMode("detail");
    setPage(1);
    setSearch("");

    try {
      const data = await fetchCustomerCylinderDetail(customerCode, filters);
      setCustomerDetail(data);
      setRecords(data.connectedCylinders);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error("Failed to fetch customer details", { description: msg });
      setCustomerDetail(null);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const backToSummary = React.useCallback(() => {
    setViewMode("summary");
    setSelectedCustomerCode(null);
    setCustomerDetail(null);
    setRecords([]);
    setPage(1);
    setSearch("");
  }, []);

  // Initial load — auto-fetch summaries once on mount.
  React.useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: Ctx = {
    records,
    summaries,
    isLoading,
    error,
    viewMode,
    selectedCustomerCode,
    customerDetail,
    selectCustomer,
    backToSummary,
    filters,
    setFilters,
    applyFilters,
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
  };

  return (
    <CustomerCylinderAgingContext.Provider value={value}>
      {children}
    </CustomerCylinderAgingContext.Provider>
  );
}

/**
 * Consumer hook — must be used within CustomerCylinderAgingProvider.
 */
export function useCustomerCylinderAging(): Ctx {
  const ctx = React.useContext(CustomerCylinderAgingContext);
  if (!ctx) {
    throw new Error(
      "useCustomerCylinderAging must be used within CustomerCylinderAgingProvider"
    );
  }
  return ctx;
}
