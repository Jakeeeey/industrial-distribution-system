// hooks/useBranchOperationalPerformanceFilterOptions.ts
// ──────────────────────────────────────────────────────────────────────────────
// Hook to fetch and format options for SearchableSelect components.
// ──────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { fetchBranchOperationalLookups } from "../services/branch-operational-performance.repo";
import type { LookupOption } from "../types/branch-operational-performance.types";

export function useBranchOperationalPerformanceFilterOptions() {
  const [branches, setBranches] = React.useState<LookupOption[]>([]);
  const [custodians, setCustodians] = React.useState<LookupOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadLookups() {
      setIsLoading(true);
      try {
        const data = await fetchBranchOperationalLookups(controller.signal);
        if (active) {
          setBranches([
            { value: "all", label: "All Authorized Branches" },
            ...data.branches,
          ]);
          setCustodians([
            { value: "all", label: "All Custodians / Customers" },
            ...data.custodians,
          ]);
        }
      } catch (e) {
        console.error("[useFilterOptions] Error loading lookups:", e);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadLookups();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return { branches, custodians, isLoading };
}
