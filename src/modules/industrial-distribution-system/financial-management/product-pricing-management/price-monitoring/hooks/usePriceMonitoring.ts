"use client";

// =============================================================================
// Price Monitoring — State + Orchestration Hook
// Layer   : hooks (state management only — calls providers, not UI)
// =============================================================================

import * as React from "react";
import { toast } from "sonner";
import type { PriceMonitoringQuery, ViewPriceMonitoringRow } from "../types";
import { fetchPriceHistory } from "../providers/priceMonitoringApi";
import { getUniqueYears } from "../utils/matrixUtils";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UsePriceMonitoringReturn {
  /** Current filter state. */
  query: PriceMonitoringQuery;
  /** Update a subset of the filter state. */
  setQuery: React.Dispatch<React.SetStateAction<PriceMonitoringQuery>>;
  /** Raw rows returned from the API — all approved history for the selected product. */
  rows: ViewPriceMonitoringRow[];
  /** State setter to clear/update rows. */
  setRows: React.Dispatch<React.SetStateAction<ViewPriceMonitoringRow[]>>;
  /** True while the API request is in-flight. */
  loading: boolean;
  /** Non-null when the last fetch failed. */
  error: string | null;
  /**
   * Manually trigger a fetch.
   * Called by FilterBar's Apply button — not auto-triggered on query change
   * to avoid excess requests while the user is still typing/selecting.
   */
  refresh: () => Promise<void>;
  /**
   * Sorted list of years derived from priceChangeDatetime across all returned rows.
   * Used to build year tabs. Most recent year is first.
   */
  availableYears: number[];
}

// ---------------------------------------------------------------------------
// Initial query state
// ---------------------------------------------------------------------------

const INITIAL_QUERY: PriceMonitoringQuery = {
  productId: "",
  productCode: null,
  productLabel: null,
  supplierId: "",
  supplierLabel: null,
  // Default to the current calendar year range
  dateFrom: `${new Date().getFullYear()}-01-01`,
  dateTo: `${new Date().getFullYear()}-12-31`,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages filter state and data fetching for the Price Monitoring module.
 *
 * Design decisions:
 * - Fetch is NOT triggered automatically on query change. The user must click
 *   Apply. This matches the spec §8.1 "Refresh / Apply button" requirement.
 * - productId validation is the caller's responsibility (FilterBar).
 * - Years are derived client-side from priceChangeDatetime (spec §8.2).
 */
export function usePriceMonitoring(): UsePriceMonitoringReturn {
  const [query, setQuery] = React.useState<PriceMonitoringQuery>(INITIAL_QUERY);
  const [rows, setRows] = React.useState<ViewPriceMonitoringRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Derive available years from returned rows whenever rows change.
   * Most recent year first (DESC) for tab ordering.
   */
  const availableYears = React.useMemo(() => {
    const years = getUniqueYears(rows);
    return years.slice().sort((a, b) => b - a);
  }, [rows]);

  const refresh = React.useCallback(async () => {
    // Guard: productId is required
    const productId = Number(query.productId);
    if (!productId || !Number.isFinite(productId) || productId <= 0) {
      toast.error("Please select a product before applying the filter.");
      return;
    }

    const supplierId =
      query.supplierId && Number(query.supplierId) > 0
        ? Number(query.supplierId)
        : null;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchPriceHistory(productId, supplierId);
      setRows(data);

      if (data.length === 0) {
        toast.info("No approved price history found for the selected filters.");
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to load price history.");
      setError(msg);
      toast.error(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [query.productId, query.supplierId]);

  return {
    query,
    setQuery,
    rows,
    setRows,
    loading,
    error,
    refresh,
    availableYears,
  };
}
