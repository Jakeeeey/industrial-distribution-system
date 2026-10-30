// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/providers/DeliverPerformanceProvider.tsx
// ==============================================================================
// Delivery Performance Report - React Context Provider
// Manages filters, date range presets, active report data, loading states,
// with AbortController for in-flight query cancellation to prevent race conditions.
// ==============================================================================

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type {
  DeliverPerformanceResponse,
  DeliverPerformanceLookups,
  DeliveryRecordItem,
} from "../types/deliver-performance.types";
import type { DeliverPerformanceFilterInput } from "../types/deliver-performance.schema";
import { exportDeliveryPerformanceCSV } from "../services/deliver-performance.export";
import { exportDeliveryPerformancePDF, fetchCompanyProfile } from "../services/deliver-performance.pdf";
import { generateDeliverPerformancePrintHtml } from "../utils/generateDeliverPerformancePrintHtml";

export type DatePeriodPreset = "today" | "this_week" | "this_month" | "this_year" | "custom";

interface DeliverPerformanceContextType {
  filters: DeliverPerformanceFilterInput;
  setFilters: React.Dispatch<React.SetStateAction<DeliverPerformanceFilterInput>>;
  updateFilter: (key: keyof DeliverPerformanceFilterInput, val: unknown) => void;
  periodPreset: DatePeriodPreset;
  setPeriodPreset: (preset: DatePeriodPreset) => void;
  resetFilters: () => void;
  report: DeliverPerformanceResponse | null;
  lookups: DeliverPerformanceLookups | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  selectedRecord: DeliveryRecordItem | null;
  setSelectedRecord: (r: DeliveryRecordItem | null) => void;
  handleExportCSV: () => void;
  handleExportPDF: () => Promise<void>;
  handlePrintBrowser: () => Promise<void>;
}

const defaultFilters: DeliverPerformanceFilterInput = {
  startDate: "",
  endDate: "",
  branchId: "all",
  customerCode: "all",
  driverId: "all",
  status: "all",
  search: "",
  page: 1,
  pageSize: 20,
  sortBy: "dispatch_date",
  sortOrder: "desc",
};

function getDateRangeForPreset(preset: DatePeriodPreset): { startDate: string; endDate: string } {
  const now = new Date();
  const formatIso = (d: Date) => d.toISOString().split("T")[0];
  const endDate = formatIso(now);

  switch (preset) {
    case "today":
      return { startDate: endDate, endDate };
    case "this_week": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      return { startDate: formatIso(monday), endDate };
    }
    case "this_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatIso(firstDay), endDate };
    }
    case "this_year": {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return { startDate: formatIso(startOfYear), endDate };
    }
    case "custom":
    default:
      return { startDate: "", endDate: "" };
  }
}

const DeliverPerformanceContext = createContext<DeliverPerformanceContextType | null>(null);

export function DeliverPerformanceProvider({ children }: { children: React.ReactNode }) {
  const [periodPreset, setPeriodPresetState] = useState<DatePeriodPreset>("this_month");

  const [filters, setFilters] = useState<DeliverPerformanceFilterInput>(() => {
    const range = getDateRangeForPreset("this_month");
    return {
      ...defaultFilters,
      startDate: range.startDate,
      endDate: range.endDate,
    };
  });

  const [report, setReport] = useState<DeliverPerformanceResponse | null>(null);
  const [lookups, setLookups] = useState<DeliverPerformanceLookups | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DeliveryRecordItem | null>(null);

  // Ref to hold the current in-flight AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Fetch lookups on mount
  useEffect(() => {
    let isMounted = true;
    async function loadLookups() {
      try {
        const res = await fetch("/api/ids/scm/fleet-and-logistics/delivery-performance-report?mode=lookups");
        if (!res.ok) throw new Error("Failed to load lookups");
        const json = await res.json();
        if (isMounted && json.success) {
          setLookups(json.data);
        }
      } catch (err) {
        console.warn("Lookups fetch error:", err);
      }
    }
    loadLookups();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch report data whenever filters change, with AbortController
  const fetchReport = useCallback(async () => {
    // Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.startDate) q.set("startDate", filters.startDate);
      if (filters.endDate) q.set("endDate", filters.endDate);
      if (filters.branchId && filters.branchId !== "all") q.set("branchId", filters.branchId);
      if (filters.customerCode && filters.customerCode !== "all") q.set("customerCode", filters.customerCode);
      if (filters.driverId && filters.driverId !== "all") q.set("driverId", filters.driverId);
      if (filters.status && filters.status !== "all") q.set("status", filters.status);
      if (filters.search) q.set("search", filters.search);
      if (filters.page) q.set("page", String(filters.page));
      if (filters.pageSize) q.set("pageSize", String(filters.pageSize));

      const res = await fetch(`/api/ids/scm/fleet-and-logistics/delivery-performance-report?${q.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Report API error: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success) {
        setReport(json.data);
      } else {
        throw new Error(json.error || "Failed to generate report");
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Request was aborted due to new filter change - ignore
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    fetchReport();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchReport]);

  const updateFilter = useCallback((key: keyof DeliverPerformanceFilterInput, val: unknown) => {
    setFilters((prev) => ({
      ...prev,
      [key]: val,
      page: key === "page" ? (val as number) : 1,
    }));
  }, []);

  const setPeriodPreset = useCallback((preset: DatePeriodPreset) => {
    setPeriodPresetState(preset);
    if (preset !== "custom") {
      const { startDate, endDate } = getDateRangeForPreset(preset);
      setFilters((prev) => ({
        ...prev,
        startDate,
        endDate,
        page: 1,
      }));
    }
  }, []);

  const resetFilters = useCallback(() => {
    setPeriodPresetState("this_month");
    const { startDate, endDate } = getDateRangeForPreset("this_month");
    setFilters({
      ...defaultFilters,
      startDate,
      endDate,
    });
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!report?.records.length) return;
    exportDeliveryPerformanceCSV(report.records);
  }, [report]);

  const handleExportPDF = useCallback(async () => {
    if (!report) return;
    const branchName =
      lookups?.branches.find((b) => String(b.id) === filters.branchId)?.branch_name || "All Branches";
    await exportDeliveryPerformancePDF(report, filters, branchName);
  }, [report, filters, lookups]);

  const handlePrintBrowser = useCallback(async () => {
    if (!report) return;
    const company = await fetchCompanyProfile();
    const branchName =
      lookups?.branches.find((b) => String(b.id) === filters.branchId)?.branch_name || "All Branches";
    const html = generateDeliverPerformancePrintHtml(report, filters, company, branchName);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }, [report, filters, lookups]);

  return (
    <DeliverPerformanceContext.Provider
      value={{
        filters,
        setFilters,
        updateFilter,
        periodPreset,
        setPeriodPreset,
        resetFilters,
        report,
        lookups,
        loading,
        error,
        refresh: fetchReport,
        selectedRecord,
        setSelectedRecord,
        handleExportCSV,
        handleExportPDF,
        handlePrintBrowser,
      }}
    >
      {children}
    </DeliverPerformanceContext.Provider>
  );
}

export function useDeliverPerformance() {
  const context = useContext(DeliverPerformanceContext);
  if (!context) {
    throw new Error("useDeliverPerformance must be used within DeliverPerformanceProvider");
  }
  return context;
}
