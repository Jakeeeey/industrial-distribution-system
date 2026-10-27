// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/providers/CustomerProfitabilityProvider.tsx
// ==============================================================================
// Customer Profitability Report - React Context Provider
// Manages filter states, pagination, sorting, data fetching, print, and drilldown.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import type {
  CustomerProfitabilityRow,
  CustomerProfitabilityReportResponse,
  CustomerDrilldownDetails,
  ProfitabilityTier,
  DatePreset,
} from "../types/customer-profitability.types";
import { generateCustomerProfitabilityPrintHtml } from "../utils/generateCustomerProfitabilityPrintHtml";
import { exportCustomerProfitabilityCsv } from "../utils/exportCustomerProfitabilityCsv";

interface BranchOption {
  id: number;
  branch_code: string;
  branch_name: string;
}

interface CustomerProfitabilityContextValue {
  // State
  data: CustomerProfitabilityReportResponse | null;
  isLoading: boolean;
  error: string | null;

  // Filter values
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  datePreset: DatePreset;
  setDatePreset: (preset: DatePreset) => void;
  branchId: number | "all";
  setBranchId: (val: number | "all") => void;
  tier: ProfitabilityTier | "all";
  setTier: (val: ProfitabilityTier | "all") => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;

  // Pagination & Sorting
  page: number;
  setPage: (val: number) => void;
  pageSize: number;
  setPageSize: (val: number) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  sortOrder: "asc" | "desc";
  setSortOrder: (val: "asc" | "desc") => void;
  handleSort: (column: string) => void;

  // Lookup options
  branches: BranchOption[];

  // Drilldown Drawer State
  selectedCustomerCode: string | null;
  drilldownDetails: CustomerDrilldownDetails | null;
  isDrilldownLoading: boolean;
  openDrilldown: (customerCode: string) => void;
  closeDrilldown: () => void;

  // Actions
  refreshReport: () => void;
  handleExportCsv: () => void;
  handlePrintReport: () => void;
}

const CustomerProfitabilityContext = React.createContext<
  CustomerProfitabilityContextValue | undefined
>(undefined);

function getPresetDates(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const toIso = (d: Date) => d.toISOString().substring(0, 10);

  if (preset === "this_month") {
    return {
      start: toIso(new Date(y, m, 1)),
      end: toIso(new Date(y, m + 1, 0)),
    };
  } else if (preset === "last_month") {
    return {
      start: toIso(new Date(y, m - 1, 1)),
      end: toIso(new Date(y, m, 0)),
    };
  } else if (preset === "qtd") {
    const qStartMonth = Math.floor(m / 3) * 3;
    return {
      start: toIso(new Date(y, qStartMonth, 1)),
      end: toIso(now),
    };
  } else if (preset === "ytd") {
    return {
      start: toIso(new Date(y, 0, 1)),
      end: toIso(now),
    };
  }
  return { start: "", end: "" };
}

export function CustomerProfitabilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setData] = React.useState<CustomerProfitabilityReportResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const initialPreset = "this_month";
  const { start: initStart, end: initEnd } = getPresetDates(initialPreset);
  const [datePreset, setDatePresetState] = React.useState<DatePreset>(initialPreset);
  const [startDate, setStartDate] = React.useState<string>(initStart);
  const [endDate, setEndDate] = React.useState<string>(initEnd);
  const [branchId, setBranchId] = React.useState<number | "all">("all");
  const [tier, setTier] = React.useState<ProfitabilityTier | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState<string>("");

  // Debounce search query changes by 350ms
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Pagination & Sorting
  const [page, setPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [sortBy, setSortBy] = React.useState<string>("contributionMargin");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  // Lookups
  const [branches, setBranches] = React.useState<BranchOption[]>([]);

  // Drilldown
  const [selectedCustomerCode, setSelectedCustomerCode] = React.useState<string | null>(null);
  const [drilldownDetails, setDrilldownDetails] =
    React.useState<CustomerDrilldownDetails | null>(null);
  const [isDrilldownLoading, setIsDrilldownLoading] = React.useState<boolean>(false);

  const setDatePreset = (preset: DatePreset) => {
    setDatePresetState(preset);
    if (preset !== "custom") {
      const { start, end } = getPresetDates(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Fetch Lookups on Mount
  React.useEffect(() => {
    async function loadLookups() {
      try {
        const res = await fetch(
          "/api/ids/fm/profitability-reports/customer-profitability-report?mode=lookups"
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.branches) {
            setBranches(json.data.branches);
          }
        }
      } catch {
        // Lookups silent fallback
      }
    }
    loadLookups();
  }, []);

  // Fetch Main Report (fetches all rows for the period/branch/search; pagination is handled instantly in memory)
  const fetchReport = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        datePreset,
        branchId: String(branchId),
        tier,
        searchQuery: debouncedSearchQuery,
        pageSize: "-1",
      });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(
        `/api/ids/fm/profitability-reports/customer-profitability-report?${params.toString()}`
      );
      if (!res.ok) {
        throw new Error(`Failed to load profitability report (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Unknown error occurred while generating report");
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, datePreset, branchId, tier, debouncedSearchQuery]);

  React.useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Client-side sorting and pagination: 0ms instant response without network latency or reloads
  const sortedAndPaginatedData = React.useMemo(() => {
    if (!data) return null;
    const all = data.allRows || data.rows || [];

    // Sort in memory
    const sorted = [...all].sort((a, b) => {
      const key = sortBy as keyof CustomerProfitabilityRow;
      const valA = a[key];
      const valB = b[key];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
      const strA = String(valA ?? "");
      const strB = String(valB ?? "");
      return sortOrder === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    const totalRows = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const startIdx = (page - 1) * pageSize;
    const pageRows = sorted.slice(startIdx, startIdx + pageSize);

    return {
      ...data,
      rows: pageRows,
      totalRows,
      totalPages,
      page,
      pageSize,
    };
  }, [data, page, pageSize, sortBy, sortOrder]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  // Drilldown Fetching
  const openDrilldown = async (customerCode: string) => {
    setSelectedCustomerCode(customerCode);
    setIsDrilldownLoading(true);
    try {
      const params = new URLSearchParams({
        mode: "drilldown",
        customerCode,
      });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (branchId !== "all") params.set("branchId", String(branchId));

      const res = await fetch(
        `/api/ids/fm/profitability-reports/customer-profitability-report?${params.toString()}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setDrilldownDetails(json.data);
        }
      }
    } catch {
      // Drilldown fallback
    } finally {
      setIsDrilldownLoading(false);
    }
  };

  const closeDrilldown = () => {
    setSelectedCustomerCode(null);
    setDrilldownDetails(null);
  };

  // Print Action
  const handlePrintReport = () => {
    if (!data) return;
    const branchLabel =
      branchId === "all"
        ? "All Branches"
        : branches.find((b) => b.id === branchId)?.branch_name || "Branch";
    const html = generateCustomerProfitabilityPrintHtml(data, branchLabel);

    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
    }
  };

  // CSV Export Action
  const handleExportCsv = () => {
    if (!data || !data.rows.length) return;
    exportCustomerProfitabilityCsv(data.rows);
  };

  const value: CustomerProfitabilityContextValue = {
    data: sortedAndPaginatedData,
    isLoading,
    error,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    datePreset,
    setDatePreset,
    branchId,
    setBranchId,
    tier,
    setTier,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    handleSort,
    branches,
    selectedCustomerCode,
    drilldownDetails,
    isDrilldownLoading,
    openDrilldown,
    closeDrilldown,
    refreshReport: fetchReport,
    handleExportCsv,
    handlePrintReport,
  };

  return (
    <CustomerProfitabilityContext.Provider value={value}>
      {children}
    </CustomerProfitabilityContext.Provider>
  );
}

export function useCustomerProfitability(): CustomerProfitabilityContextValue {
  const context = React.useContext(CustomerProfitabilityContext);
  if (!context) {
    throw new Error(
      "useCustomerProfitability must be used within a CustomerProfitabilityProvider"
    );
  }
  return context;
}
