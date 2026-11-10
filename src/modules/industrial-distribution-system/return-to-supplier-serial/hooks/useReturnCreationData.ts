"use client";

// =============================================================================
// useReturnCreationData — Manages reference data + inventory for Create/Edit
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { getReferences, getInventory } from "../providers/fetchProviders";
import type {
  ReferenceData,
  InventoryRecord,
} from "../types/rts.schema";

/** Default empty reference data to prevent null checks in components. */
const EMPTY_REFS: ReferenceData = {
  suppliers: [],
  branches: [],
  products: [],
  units: [],
  lineDiscounts: [],
  connections: [],
  returnTypes: [],
  discountTypes: [],
  linePerDiscountType: [],
};

/**
 * Hook for managing reference data and running inventory for the
 * Return-to-Supplier create/edit workflows.
 *
 * - Loads references on mount (when `isActive` is true).
 * - Exposes `loadInventory(branchId, supplierId)` to fetch stock on demand.
 * - Returns standardized `{ refs, inventory, loadInventory, isLoading, error }`.
 *
 * @param isActive - Gate flag; references are only fetched when true.
 */
export function useReturnCreationData(isActive: boolean, initialRefs?: ReferenceData) {
  const [refs, setRefs] = useState<ReferenceData>(initialRefs || EMPTY_REFS);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if preloaded references update (guard with ref to prevent render loops)
  const initialRefsRef = useRef<ReferenceData | undefined>(initialRefs);
  useEffect(() => {
    if (initialRefs && initialRefs !== initialRefsRef.current) {
      initialRefsRef.current = initialRefs;
      setRefs(initialRefs);
    }
  }, [initialRefs]);

  // Fetch reference data when dialog opens (only if not pre-loaded)
  useEffect(() => {
    if (!isActive || initialRefs) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getReferences();
        if (!cancelled) setRefs(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load reference data.";
        if (!cancelled) {
          setError(msg);
          toast.error("Reference Error", { description: msg });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isActive, initialRefs]);

  // AG-COMMENT: Track last loaded branchId-supplierId key to avoid redundant fetch requests
  const lastLoadedKeyRef = useRef<string>("");
  // AG-COMMENT: AbortController ref to cancel previous in-flight requests and prevent simultaneous queries
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetches display-ready inventory for a specific branch + supplier.
   * Automatically aborts any existing in-flight request before launching a new one.
   * Stable callback reference (empty deps) prevents triggering infinite re-render loops in consumers.
   */
  const loadInventory = useCallback(
    async (branchId: number, supplierId: number, forceRefresh = false) => {
      // AG-COMMENT: Guard against missing or invalid IDs to prevent triggering 400 Bad Request
      if (!branchId || !supplierId || isNaN(branchId) || isNaN(supplierId)) {
        return;
      }

      const key = `${branchId}-${supplierId}`;
      // AG-COMMENT: If this key has already been queried, skip unless forceRefresh is requested
      if (!forceRefresh && lastLoadedKeyRef.current === key) {
        return;
      }

      // AG-COMMENT: Immediately abort previous in-flight request to stop simultaneous queries
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      lastLoadedKeyRef.current = key;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getInventory(branchId, supplierId, forceRefresh, controller.signal);
        if (!controller.signal.aborted) {
          setInventory(data);
        }
      } catch (err: unknown) {
        // AG-COMMENT: Silently ignore AbortError since a newer request superseded it
        if (err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"))) {
          return;
        }
        if (controller.signal.aborted) {
          return;
        }
        const msg = err instanceof Error ? err.message : "Failed to load inventory.";
        setError(msg);
        toast.error("Inventory Error", { description: msg });
        setInventory([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  // AG-COMMENT: Reset last loaded key and abort requests when modal closes
  useEffect(() => {
    if (!isActive) {
      lastLoadedKeyRef.current = "";
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isActive]);

  return { refs, inventory, loadInventory, isLoading, error };
}
