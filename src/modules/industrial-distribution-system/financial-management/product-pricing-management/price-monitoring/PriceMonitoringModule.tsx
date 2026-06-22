"use client";

// =============================================================================
// Price Monitoring — Main Module
// Phase 1: Read-only approved price history monitoring
// Spec   : Implementation Specification v1.0 | 22 June 2026
//
// Layout:
//   [Card: Filter Bar]
//   [Year Tabs (dynamic from API data)]
//     [KPI Bar]
//     [Trend Chart]
//     [Monthly Matrix Table]
//     [Export Button]
//     [Audit Detail Grid]
//   [Empty State when no product selected / no data]
// =============================================================================

import * as React from "react";
import {
  Activity,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// Layer imports
import { FilterBar } from "./components/FilterBar";
import { KpiBar } from "./components/KpiBar";
import { PriceTrendChart } from "./components/PriceTrendChart";
import { MonthlyMatrixTable } from "./components/MonthlyMatrixTable";
import { AuditDetailGrid } from "./components/AuditDetailGrid";
import { usePriceMonitoring } from "./hooks/usePriceMonitoring";
import { fetchSupplierOptions } from "./providers/priceMonitoringApi";
import type { SupplierOption } from "./providers/priceMonitoringApi";
import {
  groupByPriceType,
  buildMonthlyMatrix,
  computeOverallSummary,
  getUniqueYears,
} from "./utils/matrixUtils";
import { exportToExcel, buildExportFilename } from "./utils/exportUtils";

// ---------------------------------------------------------------------------
// Module component
// ---------------------------------------------------------------------------

/**
 * PriceMonitoringModule — top-level Phase 1 read-only price history monitor.
 *
 * Architecture: thin orchestration layer — delegates all logic to hooks/utils,
 * and all UI to components. This component only wires them together.
 */
export default function PriceMonitoringModule() {
  // ── Supplier options (loaded once on mount for the filter bar) ──────────
  const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
  React.useEffect(() => {
    fetchSupplierOptions()
      .then(setSuppliers)
      .catch(() => {
        // Non-critical — supplier filter will just be empty
      });
  }, []);

  // ── Data hook ────────────────────────────────────────────────────────────
  const {
    query,
    setQuery,
    rows,
    setRows,
    loading,
    error,
    refresh,
  } = usePriceMonitoring();

  // ── Auto-clear rows when product filter is cleared/empty ───────────────────
  React.useEffect(() => {
    if (!query.productId) {
      setRows([]);
    }
  }, [query.productId, setRows]);

  // ── Year tab state ────────────────────────────────────────────────────────
  // Default to the most recent year when data loads. Reset when product changes.
  const [selectedYear, setSelectedYear] = React.useState<number | null>(null);

  // ── Granularity state for Trend Chart ──────────────────────────────────────
  const [granularity, setGranularity] = React.useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");

  // ── Mounted state to avoid hydration mismatch ─────────────────────────────
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // ── Product-required validation (show error if Apply clicked without product) ──
  const [showProductError, setShowProductError] = React.useState(false);

  const handleApply = React.useCallback(() => {
    if (!query.productId) {
      setShowProductError(true);
      return;
    }
    setShowProductError(false);
    void refresh();
  }, [query.productId, refresh]);

  const handleClear = React.useCallback(() => {
    setQuery({
      productId: "",
      productCode: null,
      productLabel: null,
      supplierId: "",
      supplierLabel: null,
      dateFrom: undefined,
      dateTo: undefined,
    });
    setShowProductError(false);
    // Note: rows are cleared automatically via useEffect when productId becomes empty.
  }, [setQuery]);

  // ── Enrich rows with supplier details from suppliers lookup ──────────────
  const enrichedRows = React.useMemo(() => {
    if (suppliers.length === 0 || rows.length === 0) return rows;
    return rows.map((row) => {
      if (row.supplierName && row.supplierShortcut) return row;
      const found = suppliers.find((s) => Number(s.id) === Number(row.supplierId));
      if (!found) return row;
      return {
        ...row,
        supplierName: row.supplierName || found.supplier_name,
        supplierShortcut: row.supplierShortcut || found.supplier_shortcut || null,
      };
    });
  }, [rows, suppliers]);

  // ── Client-side date range filtering on enriched rows ─────────────────────
  const filteredEnrichedRows = React.useMemo(() => {
    if (!query.dateFrom && !query.dateTo) return enrichedRows;

    return enrichedRows.filter((row) => {
      const dt = row.priceChangeDatetime ?? row.approvedAt;
      if (!dt) return false;
      const rowTime = new Date(dt).getTime();

      if (query.dateFrom) {
        const fromTime = query.dateFrom.getTime();
        if (rowTime < fromTime) return false;
      }
      if (query.dateTo) {
        const toTime = new Date(query.dateTo.getTime()).setHours(23, 59, 59, 999);
        if (rowTime > toTime) return false;
      }
      return true;
    });
  }, [enrichedRows, query.dateFrom, query.dateTo]);

  // ── Years list derived from date-filtered range or raw rows ────────────────
  const derivedAvailableYears = React.useMemo(() => {
    if (query.dateFrom || query.dateTo) {
      const yearsFromHistory = getUniqueYears(enrichedRows);
      if (yearsFromHistory.length === 0) return [];

      const minHistoryYear = Math.min(...yearsFromHistory);
      const maxHistoryYear = Math.max(...yearsFromHistory);

      const startYear = query.dateFrom ? query.dateFrom.getFullYear() : minHistoryYear;
      const endYear = query.dateTo ? query.dateTo.getFullYear() : maxHistoryYear;

      const years: number[] = [];
      const minY = Math.min(startYear, endYear);
      const maxY = Math.max(startYear, endYear);
      for (let y = minY; y <= maxY; y++) {
        years.push(y);
      }
      return years.slice().sort((a, b) => b - a);
    }

    const years = getUniqueYears(enrichedRows);
    return years.slice().sort((a, b) => b - a);
  }, [enrichedRows, query.dateFrom, query.dateTo]);

  // Update selectedYear to the most recent available year when data arrives
  React.useEffect(() => {
    if (derivedAvailableYears.length > 0) {
      // Most recent year first
      setSelectedYear((prev) =>
        prev && derivedAvailableYears.includes(prev) ? prev : derivedAvailableYears[0],
      );
    } else {
      setSelectedYear(null);
    }
  }, [derivedAvailableYears]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = React.useCallback(() => {
    if (filteredEnrichedRows.length === 0) {
      toast.info("No data to export.");
      return;
    }

    exportToExcel(
      filteredEnrichedRows,
      buildExportFilename(query.productCode, null),
      {
        productLabel: query.productLabel,
        supplierLabel: query.supplierLabel,
      }
    );
    toast.success(`Exported ${filteredEnrichedRows.length} record(s) to Excel.`);
  }, [filteredEnrichedRows, query.productCode, query.productLabel, query.supplierLabel]);

  // ── Derived data for the selected year ───────────────────────────────────
  const priceTypeGroups = React.useMemo(
    () => groupByPriceType(enrichedRows),
    [enrichedRows],
  );

  const matrixEntries = React.useMemo(() => {
    if (!selectedYear) return [];
    return priceTypeGroups.map((group) =>
      buildMonthlyMatrix(group, selectedYear, enrichedRows, query.dateFrom, query.dateTo),
    );
  }, [priceTypeGroups, selectedYear, enrichedRows, query.dateFrom, query.dateTo]);



  const overallSummary = React.useMemo(
    () => computeOverallSummary(filteredEnrichedRows),
    [filteredEnrichedRows],
  );

  // ── Render states ─────────────────────────────────────────────────────────
  const hasData = rows.length > 0;
  const hasYears = derivedAvailableYears.length > 0;

  if (!mounted) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-9 w-24 bg-muted rounded" />
        </div>
        <div className="h-[1px] w-full bg-muted my-4" />
        <div className="space-y-4">
          <div className="h-32 bg-muted rounded" />
          <div className="h-96 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
        <div>

          <h1 className="text-3xl font-bold tracking-tight">Price Monitoring</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Monitor approved historical product price changes.
          </p>
        </div>
      </div>
      <Separator className="my-4" />

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* Bare Filter card with just CardContent */}
          <Card className="border shadow-sm">
            <CardContent className="pt-4 pb-4">
              <FilterBar
                query={query}
                onQueryChange={(updates) =>
                  setQuery((prev) => ({ ...prev, ...updates }))
                }
                onApply={handleApply}
                onClear={handleClear}
                onExport={handleExport}
                hasData={hasData}
                loading={loading}
                suppliers={suppliers}
                showProductError={showProductError}
              />
            </CardContent>
          </Card>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Empty State */}
          {!hasData && !loading && !error && (
            <Card className="border border-dashed shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">No data to display</p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Select a product above and click{" "}
                    <span className="font-medium">Apply</span> to load its approved
                    price change history.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overall KPI Bar (above Year Tabs) */}
          {(hasData || loading) && (
            <KpiBar
              overallSummary={overallSummary}
              loading={loading}
            />
          )}

          {/* Year Tabs & Content cards */}
          {(hasData || loading) && hasYears && selectedYear && (
            <Tabs
              value={String(selectedYear)}
              onValueChange={(val) => setSelectedYear(Number(val))}
            >
              {/* <div className="flex items-center justify-between mb-4">
                <TabsList className="flex-wrap h-auto gap-1">
                  {derivedAvailableYears.map((year) => (
                    <TabsTrigger key={year} value={String(year)} className="text-sm">
                      {year}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div> */}

              {derivedAvailableYears.map((year) => (
                <TabsContent key={year} value={String(year)} className="space-y-4 focus-visible:outline-none">
                  {/* Trend chart card */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-bold">
                        Price Trend — {year}
                      </CardTitle>
                            <div className="flex justify-end">
                              <Tabs defaultValue="monthly" value={granularity} onValueChange={(v) => setGranularity(v as "daily" | "weekly" | "monthly" | "yearly")}>
                                <TabsList className="grid w-[280px] grid-cols-4 h-8 p-0.5">
                                  <TabsTrigger value="daily" className="text-xs h-7">Daily</TabsTrigger>
                                  <TabsTrigger value="weekly" className="text-xs h-7">Weekly</TabsTrigger>
                                  <TabsTrigger value="monthly" className="text-xs h-7">Monthly</TabsTrigger>
                                  <TabsTrigger value="yearly" className="text-xs h-7">Yearly</TabsTrigger>
                                </TabsList>
                              </Tabs>
                            </div>
                      <CardDescription className="text-xs text-muted-foreground">
                        One line per price type. X-axis = month. Carry-forward pricing applied.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <PriceTrendChart
                        allRows={enrichedRows}
                        filteredRows={filteredEnrichedRows}
                        selectedYear={year}
                        loading={loading}
                        dateFrom={query.dateFrom}
                        dateTo={query.dateTo}
                        granularity={granularity}
                      />
                    </CardContent>
                  </Card>

                  {/* Monthly matrix Table card */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-bold">
                        Monthly Price Matrix — {year}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Highlighted cells indicate a price change occurred that month. Outlines show the current live price (may differ from history).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <MonthlyMatrixTable
                        matrixEntries={matrixEntries}
                        selectedYear={year}
                        loading={loading}
                      />
                    </CardContent>
                  </Card>

                  {/* Audit detail grid card */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-bold">
                        Audit Detail — {year}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        All approved price change events. Unmapped supplier warnings are shown but records are never hidden.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <AuditDetailGrid
                        rows={filteredEnrichedRows}
                        selectedYear={year}
                        loading={loading}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          )}

          {loading && !hasYears && (
            <div className="space-y-4">
              <KpiBar overallSummary={{ currentPrice: null, lastUpdated: null, highestPrice: null, highestPriceYear: null, lowestPrice: null, lowestPriceYear: null, averagePrice: null, totalChanges: 0 }} loading={true} />
            </div>
          )}
        </div>
      </div>
  );
}