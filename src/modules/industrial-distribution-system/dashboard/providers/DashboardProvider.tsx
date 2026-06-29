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
  activityLogs: any[];
  revenueData: { targetAmount: number; actualAmount: number; revenueTrend: any[] } | null;
  activeDispatches: any[];
  cylinderStock: any[];
  lowStock: any[];
  orderStatusData: { status: string; count: number }[];
  topSalesmen: any[];
  topCustomers: any[];
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
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<{ targetAmount: number; actualAmount: number; revenueTrend: any[] } | null>(null);
  const [activeDispatches, setActiveDispatches] = useState<any[]>([]);
  const [cylinderStock, setCylinderStock] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [orderStatusData, setOrderStatusData] = useState<{ status: string; count: number }[]>([]);
  const [topSalesmen, setTopSalesmen] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
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
      // Fetch BIA RTO, Ops dashboard, branches, activity logs, revenue tracker, dispatches, stock levels, and low stock warnings
      const rtoUrl = new URL("/api/ids/bia/rto-operation", window.location.origin);
      const activityUrl = new URL("/api/ids/dashboard/activity-feed", window.location.origin);
      const revenueUrl = new URL("/api/ids/dashboard/revenue-tracker", window.location.origin);
      const dispatchUrl = new URL("/api/ids/dashboard/active-dispatches", window.location.origin);
      const stockUrl = new URL("/api/ids/dashboard/cylinder-stock", window.location.origin);
      const lowStockUrl = new URL("/api/ids/dashboard/low-stock", window.location.origin);
      const orderStatusUrl = new URL("/api/ids/dashboard/order-status", window.location.origin);
      const topSalesmanUrl = new URL("/api/ids/dashboard/top-salesman", window.location.origin);
      const topCustomerUrl = new URL("/api/ids/dashboard/top-customer", window.location.origin);
      
      activityUrl.searchParams.append("branchId", filters.branchId);
      revenueUrl.searchParams.append("branchId", filters.branchId);
      dispatchUrl.searchParams.append("branchId", filters.branchId);
      stockUrl.searchParams.append("branchId", filters.branchId);
      lowStockUrl.searchParams.append("branchId", filters.branchId);
      orderStatusUrl.searchParams.append("branchId", filters.branchId);
      topSalesmanUrl.searchParams.append("branchId", filters.branchId);
      topCustomerUrl.searchParams.append("branchId", filters.branchId);
      
      const [rtoRes, opsRes, activityRes, revenueRes, dispatchRes, stockRes, lowStockRes, orderStatusRes, topSalesmanRes, topCustomerRes, branchList] = await Promise.all([
        fetch(rtoUrl.toString()),
        fetch("/api/ids/crm/customer-hub/ops-dashboard"),
        fetch(activityUrl.toString()),
        fetch(revenueUrl.toString()),
        fetch(dispatchUrl.toString()),
        fetch(stockUrl.toString()),
        fetch(lowStockUrl.toString()),
        fetch(orderStatusUrl.toString()),
        fetch(topSalesmanUrl.toString()),
        fetch(topCustomerUrl.toString()),
        fetchBranches()
      ]);

      let rtoRecords: any[] = [];
      let opsRecords: any[] = [];
      let activityRecords: any[] = [];
      let revRecords: any = null;
      let dispRecords: any[] = [];
      let stockRecords: any[] = [];
      let lowStockRecords: any[] = [];
      let orderStatusRecords: { status: string; count: number }[] = [];

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

      if (activityRes.ok) {
        activityRecords = await activityRes.json();
      } else {
        console.error("Failed to fetch Dashboard activity logs:", await activityRes.text());
      }

      if (revenueRes.ok) {
        revRecords = await revenueRes.json();
      } else {
        console.error("Failed to fetch Dashboard revenue data:", await revenueRes.text());
      }

      if (dispatchRes.ok) {
        dispRecords = await dispatchRes.json();
      } else {
        console.error("Failed to fetch Dashboard dispatch plans:", await dispatchRes.text());
      }

      if (stockRes.ok) {
        stockRecords = await stockRes.json();
      } else {
        console.error("Failed to fetch Dashboard cylinder stock:", await stockRes.text());
      }

      if (lowStockRes.ok) {
        lowStockRecords = await lowStockRes.json();
      } else {
        console.error("Failed to fetch Dashboard low stock alerts:", await lowStockRes.text());
      }

      if (orderStatusRes.ok) {
        orderStatusRecords = await orderStatusRes.json();
      } else {
        console.error("Failed to fetch Dashboard order status counts:", await orderStatusRes.text());
      }

      let salesmanRecords: any[] = [];
      if (topSalesmanRes.ok) {
        salesmanRecords = await topSalesmanRes.json();
      } else {
        console.error("Failed to fetch Dashboard top salesmen:", await topSalesmanRes.text());
      }

      let customerRecords: any[] = [];
      if (topCustomerRes.ok) {
        customerRecords = await topCustomerRes.json();
      } else {
        console.error("Failed to fetch Dashboard top customers:", await topCustomerRes.text());
      }

      setRtoData(rtoRecords);
      setOpsData(opsRecords);
      setActivityLogs(activityRecords);
      setRevenueData(revRecords);
      setActiveDispatches(dispRecords);
      setCylinderStock(stockRecords);
      setLowStock(lowStockRecords);
      setOrderStatusData(orderStatusRecords);
      setTopSalesmen(salesmanRecords);
      setTopCustomers(customerRecords);

      // Resolve branches
      const branchMap = new Map<string, { id: string; name: string; code: string }>();
      branchList.forEach((b) => branchMap.set(b.id, b));
      
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
  }, [fetchBranches, filters.branchId]);

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
        activityLogs,
        revenueData,
        activeDispatches,
        cylinderStock,
        lowStock,
        orderStatusData,
        topSalesmen,
        topCustomers,
        branches,
        refreshAll,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};


