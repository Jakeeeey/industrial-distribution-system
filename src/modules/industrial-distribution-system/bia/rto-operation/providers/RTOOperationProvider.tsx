// providers/RTOOperationProvider.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Single Context + Provider + consumer hook for the BIA RTO Operation module.
// Pattern mirrors: CustomerCylinderAgingProvider.tsx
//
// Data lifecycle:
//   - Auto-fetches on mount (no mandatory params required)
//   - Re-fetches when user clicks Apply Filters
//   - Detail view opens a Dialog without re-fetching the list
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { toast } from "sonner";
import type {
  RTODealerRecord,
  RTOFilters,
  RTODealerDetail,
  RTOKPISummary,
} from "../types";
import { computeRTOKPIs } from "../utils/rto-operation.utils";

// ── BFF repo (client-side fetch) ───────────────────────────────────────────────

const BFF_ROUTE = "/api/ids/bia/rto-operation";

async function fetchDealers(filters: RTOFilters): Promise<RTODealerRecord[]> {
  const p = new URLSearchParams();
  if (filters.branchId !== undefined && filters.branchId !== "")
    p.set("branchId", String(filters.branchId));
  // missingStatus and balanceStatus are applied client-side (post-fetch filter)
  // to avoid extra BFF round trips.

  const url = p.toString() ? `${BFF_ROUTE}?${p.toString()}` : BFF_ROUTE;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[RTOOperationProvider] BFF request failed ${res.status}: ${body}`
    );
  }
  const json = await res.json();
  if (Array.isArray(json)) return json as RTODealerRecord[];
  if (Array.isArray(json?.data)) return json.data as RTODealerRecord[];
  return [];
}

// ── Context shape ─────────────────────────────────────────────────────────────

type Ctx = {
  // Data
  records: RTODealerRecord[];
  filteredRecords: RTODealerRecord[];
  kpis: RTOKPISummary;
  isLoading: boolean;
  error: string;

  // View state
  viewMode: "list" | "detail";
  selectedDealerCode: string | null;
  selectedDealer: RTODealerRecord | null;

  // Actions
  selectDealer: (code: string) => void;
  backToList: () => void;

  // Staged filters (not applied until user clicks Apply)
  filters: RTOFilters;
  setFilters: React.Dispatch<React.SetStateAction<RTOFilters>>;
  applyFilters: () => Promise<void>;

  // Client-side text search
  search: string;
  setSearch: (v: string) => void;

  // Pagination
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;

  // Refetch
  refetch: () => Promise<void>;
};

const RTOOperationContext = React.createContext<Ctx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function RTOOperationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Raw records from BFF
  const [records, setRecords] = React.useState<RTODealerRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // View state
  const [viewMode, setViewMode] = React.useState<"list" | "detail">("list");
  const [selectedDealerCode, setSelectedDealerCode] = React.useState<string | null>(null);

  // Staged filters
  const [filters, setFilters] = React.useState<RTOFilters>({});

  // Client-side search
  const [search, setSearch] = React.useState("");

  // Pagination
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  // ── Derived filtered records (client-side) ──────────────────────────────────
  const filteredRecords = React.useMemo(() => {
    let result = records;

    // Missing status filter
    if (filters.missingStatus && filters.missingStatus !== "all") {
      result = result.filter((r) => r.missingStatus === filters.missingStatus);
    }

    // Balance status filter
    if (filters.balanceStatus && filters.balanceStatus !== "all") {
      result = result.filter((r) => r.balanceStatus === filters.balanceStatus);
    }

    // Text search (debounced upstream)
    if (search.trim()) {
      const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter((r) => {
        const hay = [
          r.customerCode,
          r.customerName,
          r.storeName,
          r.customerAddress,
          r.branchName,
          r.branchCode,
          ...r.assignedAgents.map((a) => a.name),
        ]
          .join(" ")
          .toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }

    return result;
  }, [records, filters.missingStatus, filters.balanceStatus, search]);

  // ── KPI computation ─────────────────────────────────────────────────────────
  const kpis = React.useMemo(() => computeRTOKPIs(records), [records]);

  // ── Selected dealer detail (from in-memory records) ────────────────────────
  const selectedDealer = React.useMemo(
    () => records.find((r) => r.customerCode === selectedDealerCode) ?? null,
    [records, selectedDealerCode]
  );

  // ── Core fetch action ───────────────────────────────────────────────────────
  const applyFilters = React.useCallback(async () => {
    setIsLoading(true);
    setError("");
    setPage(1);
    try {
      const data = await fetchDealers(filters);
      setRecords(data);
      if (data.length === 0) {
        toast.info("No dealer records found.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.trim().toLowerCase() !== "fetch failed") {
        setError(msg);
        toast.error("Failed to load RTO dealer data", { description: msg });
      }
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const refetch = React.useCallback(async () => {
    await applyFilters();
  }, [applyFilters]);

  // ── View navigation ─────────────────────────────────────────────────────────
  const selectDealer = React.useCallback((code: string) => {
    setSelectedDealerCode(code);
    setViewMode("detail");
  }, []);

  const backToList = React.useCallback(() => {
    setViewMode("list");
    setSelectedDealerCode(null);
  }, []);

  // ── Auto-fetch on mount ─────────────────────────────────────────────────────
  React.useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Context value ───────────────────────────────────────────────────────────
  const value: Ctx = {
    records,
    filteredRecords,
    kpis,
    isLoading,
    error,
    viewMode,
    selectedDealerCode,
    selectedDealer,
    selectDealer,
    backToList,
    filters,
    setFilters,
    applyFilters,
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    refetch,
  };

  return (
    <RTOOperationContext.Provider value={value}>
      {children}
    </RTOOperationContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * Must be used within <RTOOperationProvider>.
 */
export function useRTOOperationCtx(): Ctx {
  const ctx = React.useContext(RTOOperationContext);
  if (!ctx) {
    throw new Error(
      "useRTOOperationCtx must be used within RTOOperationProvider"
    );
  }
  return ctx;
}

// Re-export the detail type for convenience
export type { RTODealerDetail };
