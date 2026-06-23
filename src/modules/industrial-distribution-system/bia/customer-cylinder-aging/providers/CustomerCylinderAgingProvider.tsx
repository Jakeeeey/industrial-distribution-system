// providers/CustomerCylinderAgingProvider.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Single Context + Provider + consumer hook for the Customer Cylinder Aging module.
// Pattern mirrors: PostingOfPoProvider.tsx
//
// Design decisions:
// - Fetch does NOT auto-fire on every filter change — user must click "Apply"
//   to avoid hammering the Spring endpoint on every keystroke.
// - Client-side search (debounced) operates on the already-fetched records array.
// - Pagination is handled client-side on the filtered result set.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { toast } from "sonner";
import { fetchCylinderAging } from "../services";
import type {
  CustomerCylinderAgingRecord,
  CustomerCylinderAgingFilters,
} from "../types/customer-cylinder-aging.types";

// ── Context shape ─────────────────────────────────────────────────────────────
type Ctx = {
  // Data
  records: CustomerCylinderAgingRecord[];
  isLoading: boolean;
  error: string;

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
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

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
      const data = await fetchCylinderAging(filters);
      setRecords(data);

      if (data.length === 0) {
        toast.info("No records found for the selected filters.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Suppress generic network errors from polluting the UI
      if (msg.trim().toLowerCase() !== "fetch failed") {
        setError(msg);
        toast.error("Failed to fetch cylinder aging data", { description: msg });
      }
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Initial load — fetch with empty filters on mount
  React.useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: Ctx = {
    records,
    isLoading,
    error,
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
