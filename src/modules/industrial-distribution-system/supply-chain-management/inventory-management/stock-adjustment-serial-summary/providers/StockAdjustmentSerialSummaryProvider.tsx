"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { stockAdjustmentSerialSummaryApi } from "../api/stock-adjustment-serial-summary-api";
import { stockAdjustmentSerialSummaryService } from "../services/stock-adjustment-serial-summary-service";
import {
  SummaryKPIs,
  TrendItem,
  BranchItem,
  ProductItem,
  SupplierItem,
  BranchLookup,
  SupplierLookup
} from "../types/stock-adjustment-serial-summary.types";
import { StockAdjustmentHeader } from "../../stock-adjustment-serial-registration/types/stock-adjustment-serial.schema";

interface StockAdjustmentSerialSummaryContextType {
  // States
  isLoading: boolean;
  error: string | null;
  branches: BranchLookup[];
  suppliers: SupplierLookup[];
  rawData: StockAdjustmentHeader[];
  filteredData: StockAdjustmentHeader[];

  // Action
  refresh: () => Promise<void>;

  // Filters
  search: string;
  setSearch: (s: string) => void;
  branchId: number | undefined;
  setBranchId: (id: number | undefined) => void;
  supplierId: number | undefined;
  setSupplierId: (id: number | undefined) => void;
  type: "IN" | "OUT" | undefined;
  setType: (t: "IN" | "OUT" | undefined) => void;
  status: "Posted" | "Unposted" | undefined;
  setStatus: (s: "Posted" | "Unposted" | undefined) => void;
  fromDate: string | undefined;
  setFromDate: (d: string | undefined) => void;
  toDate: string | undefined;
  setToDate: (d: string | undefined) => void;
  resetFilters: () => void;

  // Computations
  kpis: SummaryKPIs;
  trendData: TrendItem[];
  branchData: BranchItem[];
  productData: ProductItem[];
  supplierData: SupplierItem[];
}

const StockAdjustmentSerialSummaryContext = createContext<StockAdjustmentSerialSummaryContextType | undefined>(undefined);

export function StockAdjustmentSerialSummaryProvider({ children }: { children: React.ReactNode }) {
  const [rawData, setRawData] = useState<StockAdjustmentHeader[]>([]);
  const [branches, setBranches] = useState<BranchLookup[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLookup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState<number | undefined>();
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [type, setType] = useState<"IN" | "OUT" | undefined>();
  const [status, setStatus] = useState<"Posted" | "Unposted" | undefined>();
  const [fromDate, setFromDate] = useState<string | undefined>();
  const [toDate, setToDate] = useState<string | undefined>();

  const resetFilters = () => {
    setSearch("");
    setBranchId(undefined);
    setSupplierId(undefined);
    setType(undefined);
    setStatus(undefined);
    setFromDate(undefined);
    setToDate(undefined);
  };

  // Fetch branches and suppliers once
  useEffect(() => {
    async function loadData() {
      try {
        const [branchData, supplierData] = await Promise.all([
          stockAdjustmentSerialSummaryApi.fetchBranches(),
          stockAdjustmentSerialSummaryApi.fetchSuppliers()
        ]);
        setBranches(branchData);
        setSuppliers(supplierData);
      } catch (err) {
        console.error("Failed to load initial lookups in provider:", err);
      }
    }
    loadData();
  }, []);

  // Refresh adjustments list based on API-level filters
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await stockAdjustmentSerialSummaryApi.fetchAdjustments({
        search,
        branchId,
        type
      });
      setRawData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary details");
      toast.error("Failed to load summary details");
    } finally {
      setIsLoading(false);
    }
  }, [search, branchId, type]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Client-side filtered data calculation (for Status, Supplier and Date Range)
  const filteredData = useMemo(() => {
    return stockAdjustmentSerialSummaryService.filterData(rawData, {
      search,
      branchId,
      supplierId,
      type,
      status,
      fromDate,
      toDate
    });
  }, [rawData, search, branchId, supplierId, type, status, fromDate, toDate]);

  // Calculations
  const kpis = useMemo(() => stockAdjustmentSerialSummaryService.computeKPIs(filteredData), [filteredData]);
  const trendData = useMemo(() => stockAdjustmentSerialSummaryService.computeTrendData(filteredData), [filteredData]);
  const branchData = useMemo(() => stockAdjustmentSerialSummaryService.computeBranchData(filteredData), [filteredData]);
  const productData = useMemo(() => stockAdjustmentSerialSummaryService.computeProductData(filteredData), [filteredData]);
  const supplierData = useMemo(() => stockAdjustmentSerialSummaryService.computeSupplierData(filteredData), [filteredData]);

  const value = {
    isLoading,
    error,
    branches,
    suppliers,
    rawData,
    filteredData,
    refresh,
    search,
    setSearch,
    branchId,
    setBranchId,
    supplierId,
    setSupplierId,
    type,
    setType,
    status,
    setStatus,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    resetFilters,
    kpis,
    trendData,
    branchData,
    productData,
    supplierData
  };

  return (
    <StockAdjustmentSerialSummaryContext.Provider value={value}>
      {children}
    </StockAdjustmentSerialSummaryContext.Provider>
  );
}

export function useStockAdjustmentSerialSummaryContext() {
  const context = useContext(StockAdjustmentSerialSummaryContext);
  if (context === undefined) {
    throw new Error("useStockAdjustmentSerialSummaryContext must be used within a StockAdjustmentSerialSummaryProvider");
  }
  return context;
}
