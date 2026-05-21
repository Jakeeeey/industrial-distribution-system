"use client";

import { useCallback, useEffect, useState } from "react";
import type { WalkInTransaction } from "../types";
import { fetchWalkInTransactions } from "../providers/walkInTransactions";

interface UseWalkInTransactionsReturn {
  transactions: WalkInTransaction[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWalkInTransactions(): UseWalkInTransactionsReturn {
  const [transactions, setTransactions] = useState<WalkInTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchWalkInTransactions();
      setTransactions(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load walk-in transactions";
      setError(message);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchData(), 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => fetchData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchData]);

  return { transactions, isLoading, error, refetch: fetchData };
}
