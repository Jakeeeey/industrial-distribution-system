/* eslint-disable @typescript-eslint/no-explicit-any */
// src/modules/industrial-distribution-system/dashboard/providers/DashboardProvider.tsx

"use client";


import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { DashboardFilters, DateRange } from "../types";
import { toast } from "sonner";

interface DashboardContextProps {
  filters: DashboardFilters;
  setBranchId: (branchId: string) => void;
  setDateRange: (range: DateRange) => void;
  
  // Data states
  loading: boolean;
  rtoData: any[];
  opsData: any[];
  branches: { id: string; name: string; code: string }[];
  
  // Refresh mechanisms
  refreshAll: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<DashboardFilters>({
    branchId: "all",
    dateRange: { from: null, to: null },
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [rtoData, setRtoData] = useState<any[]>([]);
  const [opsData, setOpsData] = useState<any[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);

  const setBranchId = (branchId: string) => {
    setFilters((prev) => ({ ...prev, branchId }));
  };

  const setDateRange = (dateRange: DateRange) => {
    setFilters((prev) => ({ ...prev, dateRange }));
  };

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch("/api/ids/scm/warehouse-management/consolidation/branches");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((b: any) => ({
            id: String(b.id || b.branchId || ""),
            name: String(b.branchName || b.branch_name || ""),
            code: String(b.branchCode || b.branch_code || ""),
          })).filter((b) => b.id);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch consolidation branches. Deriving from records.", e);
    }
    return [];
  }, []);

  const fetchData = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      // 1. Fetch BIA RTO Operation data
      const rtoUrl = new URL("/api/ids/bia/rto-operation", window.location.origin);
      // branchId can be appended if the API supports it, otherwise post-filtered on client
      
      const [rtoRes, opsRes, branchList] = await Promise.all([
        fetch(rtoUrl.toString()),
        fetch("/api/ids/crm/customer-hub/ops-dashboard"),
        fetchBranches()
      ]);

      let rtoRecords: any[] = [];
      let opsRecords: any[] = [];

      if (rtoRes.ok) {
        rtoRecords = await rtoRes.json();
      } else {
        console.error("Failed to fetch RTO operation data:", await rtoRes.text());
      }

      if (opsRes.ok) {
        opsRecords = await opsRes.json();
      } else {
        console.error("Failed to fetch Ops dashboard data:", await opsRes.text());
      }

      setRtoData(rtoRecords);
      setOpsData(opsRecords);

      // Resolve branches: combine fetched branches with any branches found inside RTO data
      const branchMap = new Map<string, { id: string; name: string; code: string }>();
      
      // Seed with fetched consolidation branches
      branchList.forEach((b) => branchMap.set(b.id, b));
      
      // Collect from RTO data as fallback/enrichment
      rtoRecords.forEach((item: any) => {
        if (item.branchId && item.branchName) {
          const idStr = String(item.branchId);
          if (!branchMap.has(idStr)) {
            branchMap.set(idStr, {
              id: idStr,
              name: item.branchName,
              code: item.branchCode || `BR-${idStr}`,
            });
          }
        }
      });

      const uniqueBranches = Array.from(branchMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      setBranches(uniqueBranches);

      if (showToast) {
        toast.success("Dashboard data refreshed successfully!");
      }
    } catch (error) {
      console.error("Error refreshing dashboard data:", error);
      toast.error("Failed to refresh dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [fetchBranches]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshAll = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return (
    <DashboardContext.Provider
      value={{
        filters,
        setBranchId,
        setDateRange,
        loading,
        rtoData,
        opsData,
        branches,
        refreshAll,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};
