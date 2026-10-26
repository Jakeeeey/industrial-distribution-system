// providers/CustomerCylinderTurnaroundProvider.tsx
// ──────────────────────────────────────────────────────────────────────────────
// React Context & State Management Provider for Customer Cylinder Turnaround Ratio (CTR).
// Handles filter synchronization, data fetching, drawer selection, and workflow updates.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import type {
  CustomerCylinderTurnaroundItem,
  CustomerCylinderTurnaroundKPIs,
  CustomerCylinderTurnaroundAuditLog,
  LookupOption,
  AssessmentStatus,
} from "../types/customer-cylinder-turnaround.types";
import type { CustomerCylinderTurnaroundFilterInput } from "../types/customer-cylinder-turnaround.schema";

interface TurnaroundContextValue {
  // Filter States
  filters: CustomerCylinderTurnaroundFilterInput;
  setFilter: <K extends keyof CustomerCylinderTurnaroundFilterInput>(
    key: K,
    val: CustomerCylinderTurnaroundFilterInput[K]
  ) => void;
  resetFilters: () => void;

  // Data States
  items: CustomerCylinderTurnaroundItem[];
  kpis: CustomerCylinderTurnaroundKPIs | null;
  auditLogs: CustomerCylinderTurnaroundAuditLog[];
  assessmentNo: string;
  status: AssessmentStatus;
  isLoading: boolean;
  error: string | null;

  // Lookups
  customersLookup: LookupOption[];
  branchesLookup: LookupOption[];
  yearsLookup: number[];

  // Drawer / Selection
  selectedItem: CustomerCylinderTurnaroundItem | null;
  setSelectedItem: (item: CustomerCylinderTurnaroundItem | null) => void;

  // Actions
  refreshReport: () => Promise<void>;
  exportToCsv: () => void;
}

const TurnaroundContext = React.createContext<TurnaroundContextValue | undefined>(undefined);

const defaultFilters: CustomerCylinderTurnaroundFilterInput = {
  datePreset: "THIS_YEAR",
  startDate: "",
  endDate: "",
  periodYear: new Date().getFullYear(),
  periodStartMonth: 1,
  periodEndMonth: 12,
  branchId: "",
  customerCode: "",
  grade: "ALL",
  status: "ALL",
  searchQuery: "",
};

export function CustomerCylinderTurnaroundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [filters, setFilters] = React.useState<CustomerCylinderTurnaroundFilterInput>(defaultFilters);
  const [items, setItems] = React.useState<CustomerCylinderTurnaroundItem[]>([]);
  const [kpis, setKpis] = React.useState<CustomerCylinderTurnaroundKPIs | null>(null);
  const [auditLogs, setAuditLogs] = React.useState<CustomerCylinderTurnaroundAuditLog[]>([]);
  const [assessmentNo, setAssessmentNo] = React.useState<string>("CTR-2026");
  const [status, setStatus] = React.useState<AssessmentStatus>("APPROVED");

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [customersLookup, setCustomersLookup] = React.useState<LookupOption[]>([]);
  const [branchesLookup, setBranchesLookup] = React.useState<LookupOption[]>([]);
  const [yearsLookup, setYearsLookup] = React.useState<number[]>([2026, 2025, 2024]);

  const [selectedItem, setSelectedItem] = React.useState<CustomerCylinderTurnaroundItem | null>(null);

  const setFilter = <K extends keyof CustomerCylinderTurnaroundFilterInput>(
    key: K,
    val: CustomerCylinderTurnaroundFilterInput[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  // Load Lookups on mount
  React.useEffect(() => {
    async function loadLookups() {
      try {
        const res = await fetch("/api/ids/bia/cylinder-analytics/customer-cylinder-turnaround-ratio?mode=lookups");
        const json = await res.json();
        if (json.success && json.data) {
          setCustomersLookup(json.data.customers || []);
          setBranchesLookup(json.data.branches || []);
          if (json.data.years) setYearsLookup(json.data.years);
        }
      } catch (err) {
        console.error("Failed to load lookups", err);
      }
    }
    loadLookups();
  }, []);

  // Fetch Report Data
  const refreshReport = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.datePreset) q.set("datePreset", filters.datePreset);
      if (filters.startDate) q.set("startDate", filters.startDate);
      if (filters.endDate) q.set("endDate", filters.endDate);
      q.set("periodYear", String(filters.periodYear));
      q.set("periodStartMonth", String(filters.periodStartMonth));
      q.set("periodEndMonth", String(filters.periodEndMonth));
      if (filters.branchId) q.set("branchId", String(filters.branchId));
      if (filters.customerCode) q.set("customerCode", filters.customerCode);
      if (filters.grade && filters.grade !== "ALL") q.set("grade", filters.grade);
      if (filters.searchQuery) q.set("searchQuery", filters.searchQuery);

      const res = await fetch(`/api/ids/bia/cylinder-analytics/customer-cylinder-turnaround-ratio?${q.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setItems(json.data.items || []);
        setKpis(json.data.kpis || null);
        setAuditLogs(json.data.auditLogs || []);
        setAssessmentNo(json.data.assessmentNo || "CTR-CURRENT");
        setStatus(json.data.status || "APPROVED");
      } else {
        setError(json.error || "Failed to load report");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    refreshReport();
  }, [refreshReport]);

  // CSV Export utility
  const exportToCsv = React.useCallback(() => {
    if (items.length === 0) return;

    const headers = [
      "Customer Code",
      "Customer Name",
      "Branch",
      "Period",
      "Cylinder Base",
      "Repeat Orders",
      "Deposit Cylinders",
      "Annual Turns",
      "Months Per Turn",
      "Grade",
      "Eligible 11kg Refills",
      "Eligible kg",
      "Incentive Rate/kg",
      "Total Incentive (PHP)",
    ];

    const rows = items.map((i) => [
      `"${i.customerCode}"`,
      `"${i.customerName}"`,
      `"${i.branchName}"`,
      `"${i.periodLabel}"`,
      i.cylinderBase,
      i.repeatOrderQty,
      i.depositCylinderQty,
      i.annualTurns,
      i.monthsPerTurn,
      i.grade,
      i.eligibleRefill11kgQty,
      i.eligibleKilograms,
      i.incentiveRatePerKg,
      i.totalIncentiveAmount,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Customer_Cylinder_Turnaround_Ratio_${assessmentNo}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [items, assessmentNo]);

  const value = React.useMemo(
    () => ({
      filters,
      setFilter,
      resetFilters,
      items,
      kpis,
      auditLogs,
      assessmentNo,
      status,
      isLoading,
      error,
      customersLookup,
      branchesLookup,
      yearsLookup,
      selectedItem,
      setSelectedItem,
      refreshReport,
      exportToCsv,
    }),
    [
      filters,
      items,
      kpis,
      auditLogs,
      assessmentNo,
      status,
      isLoading,
      error,
      customersLookup,
      branchesLookup,
      yearsLookup,
      selectedItem,
      refreshReport,
      exportToCsv,
    ]
  );

  return (
    <TurnaroundContext.Provider value={value}>
      {children}
    </TurnaroundContext.Provider>
  );
}

export function useCustomerCylinderTurnaround() {
  const ctx = React.useContext(TurnaroundContext);
  if (!ctx) {
    throw new Error(
      "useCustomerCylinderTurnaround must be used within CustomerCylinderTurnaroundProvider"
    );
  }
  return ctx;
}
