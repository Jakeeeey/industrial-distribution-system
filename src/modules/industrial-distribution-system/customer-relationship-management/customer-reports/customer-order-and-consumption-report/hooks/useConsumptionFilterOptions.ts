"use client";

// ============================================================
// useConsumptionFilterOptions.ts
// Loads all filter options (customers, branches, salesmen, classifications)
// and caches them locally in sessionStorage. Cached records remain valid
// throughout the browser session until the user closes the browser/tab.
//
// In-memory caching + local client-side search ensures that:
// 1. All customers and records are visible and searchable (no 50-item cutoff).
// 2. Typing into the search bar filters instantaneously without debounce lag.
// 3. Dropdowns re-open instantly without redundant server round-trips.
// ============================================================

import * as React from "react";

import { requestReportLookupOptions } from "../api/customer-order-consumption.client";
import type { ReportLookupOption } from "../types/customer-order-consumption.types";

export type ReportLookupKind =
  | "customers"
  | "branches"
  | "salesmen"
  | "classifications";

const STORAGE_KEY_PREFIX = "ids_cocr_lookup_options_v2_";

// Fast in-memory cache for the current React execution context
const memoryCache = new Map<ReportLookupKind, ReportLookupOption[]>();

// Deduplicate in-flight fetch requests for the same lookup kind
const inFlightRequests = new Map<
  ReportLookupKind,
  Promise<ReportLookupOption[]>
>();

/** Read cached options from browser sessionStorage (survives page refreshes until browser is closed) */
function getSessionCache(kind: ReportLookupKind): ReportLookupOption[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${kind}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReportLookupOption[]) : null;
  } catch {
    return null;
  }
}

/** Store loaded options into browser sessionStorage until the browser is closed */
function setSessionCache(
  kind: ReportLookupKind,
  data: ReportLookupOption[]
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${STORAGE_KEY_PREFIX}${kind}`,
      JSON.stringify(data)
    );
  } catch {
    // Gracefully handle private browsing or quota limits
  }
}

/** Fetches the complete list of options from the server and populates both memory & session caches */
async function fetchAllOptions(
  kind: ReportLookupKind,
  signal?: AbortSignal
): Promise<ReportLookupOption[]> {
  // 1. Check in-memory cache
  const inMemory = memoryCache.get(kind);
  if (inMemory && inMemory.length > 0) return inMemory;

  // 2. Check browser sessionStorage
  const inSession = getSessionCache(kind);
  if (inSession && inSession.length > 0) {
    memoryCache.set(kind, inSession);
    return inSession;
  }

  // 3. Check deduplicated in-flight request
  const existing = inFlightRequests.get(kind);
  if (existing) return existing;

  // 4. Request all options from server without term filter (server returns full list with limit -1)
  const req = requestReportLookupOptions(kind, undefined, signal)
    .then((data) => {
      memoryCache.set(kind, data);
      setSessionCache(kind, data);
      inFlightRequests.delete(kind);
      return data;
    })
    .catch((err) => {
      inFlightRequests.delete(kind);
      throw err;
    });

  inFlightRequests.set(kind, req);
  return req;
}

export interface UseConsumptionFilterOptionsResult {
  options: ReportLookupOption[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Loads all options for a given filter kind and caches them in sessionStorage
 * until the browser is closed. Provides instant client-side searching across
 * the complete set of records so all customers and options are always available.
 */
export function useConsumptionFilterOptions(
  kind: ReportLookupKind,
  term: string
): UseConsumptionFilterOptionsResult {
  // Initialize with cached data if already present
  const [allOptions, setAllOptions] = React.useState<ReportLookupOption[]>(() => {
    const mem = memoryCache.get(kind);
    if (mem && mem.length > 0) return mem;
    const sess = getSessionCache(kind);
    if (sess && sess.length > 0) {
      memoryCache.set(kind, sess);
      return sess;
    }
    return [];
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Check if options are already loaded in memory or session
    const mem = memoryCache.get(kind);
    if (mem && mem.length > 0) {
      if (allOptions.length === 0) setAllOptions(mem);
      return;
    }

    const sess = getSessionCache(kind);
    if (sess && sess.length > 0) {
      memoryCache.set(kind, sess);
      if (allOptions.length === 0) setAllOptions(sess);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchAllOptions(kind)
      .then((data) => {
        if (cancelled) return;
        setAllOptions(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Filter options are unavailable."
        );
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, allOptions.length]);

  // Instant client-side filtering across the complete dataset
  const options = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchCode = opt.code ? opt.code.toLowerCase().includes(q) : false;
      const matchVal = opt.value.toLowerCase().includes(q);
      return matchLabel || matchCode || matchVal;
    });
  }, [allOptions, term]);

  return { options, isLoading, error };
}
