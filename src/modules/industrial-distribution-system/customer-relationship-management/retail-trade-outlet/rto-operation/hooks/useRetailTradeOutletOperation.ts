import { useState, useCallback, useMemo } from "react";
import { CityDealer } from "../types";
import DUMMY_DATA from "../utils/dummydata";

export type MissingStatusFilter = "all" | "normal" | "warning" | "critical";
export type BalanceStatusFilter = "all" | "paid" | "low" | "high";

function getMissingStatus(missing: number): "normal" | "warning" | "critical" {
  if (missing > 100) return "critical";
  if (missing > 50) return "warning";
  return "normal";
}

function getBalanceStatus(balance: number): "paid" | "low" | "high" {
  if (balance === 0) return "paid";
  if (balance < 60000) return "low";
  return "high";
}

export function useRetailTradeOutletOperation() {
  const [searchQuery, setSearchQuery] = useState("");
  const [missingStatusFilter, setMissingStatusFilter] =
    useState<MissingStatusFilter>("all");
  const [balanceStatusFilter, setBalanceStatusFilter] =
    useState<BalanceStatusFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // For future: replace with real API fetch
  const dealers: CityDealer[] = DUMMY_DATA;

  const refetch = useCallback(async () => {
    setIsLoading(true);
    // Simulate a refresh delay (replace with actual fetch when API is ready)
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsLoading(false);
  }, []);

  const filteredAndSortedDealers = useMemo(() => {
    let result = [...dealers];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.assignedPersonnel.some(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.barangay.toLowerCase().includes(q),
          ),
      );
    }

    // Missing status filter
    if (missingStatusFilter !== "all") {
      result = result.filter(
        (d) => getMissingStatus(d.missingTanks) === missingStatusFilter,
      );
    }

    // Balance status filter
    if (balanceStatusFilter !== "all") {
      result = result.filter(
        (d) => getBalanceStatus(d.unpaidBalance) === balanceStatusFilter,
      );
    }

    // Sort by recent (newest date first)
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return result;
  }, [dealers, searchQuery, missingStatusFilter, balanceStatusFilter]);

  // Paginated dealers
  const paginatedDealers = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredAndSortedDealers.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedDealers, page, pageSize]);

  const totalCount = filteredAndSortedDealers.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const isFiltered =
    searchQuery !== "" ||
    missingStatusFilter !== "all" ||
    balanceStatusFilter !== "all";

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setMissingStatusFilter("all");
    setBalanceStatusFilter("all");
    setPage(1);
  }, []);

  return {
    dealers: paginatedDealers,
    totalCount,
    totalPages,
    page,
    pageSize,
    isLoading,
    isFiltered,
    searchQuery,
    missingStatusFilter,
    balanceStatusFilter,
    setPage,
    setPageSize,
    setSearchQuery,
    setMissingStatusFilter,
    setBalanceStatusFilter,
    resetFilters,
    refetch,
    getMissingStatus,
    getBalanceStatus,
  };
}
