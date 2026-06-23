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
  LineChart as LineChartIcon,
  BarChart2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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
import type { ViewPriceMonitoringRow } from "./types";

// ---------------------------------------------------------------------------
// Module component
// ---------------------------------------------------------------------------

/**
 * PriceMonitoringModule — top-level Phase 1 read-only price history monitor.
 *
 * Architecture: thin orchestration layer — delegates all logic to hooks/utils,
 * and all UI to components. This component only wires them together.
 */
export default function PriceMonitoringModule({userName}: {userName?: string}) {
  // ── Supplier options (loaded once on mount for the filter bar) ─────────
  const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
  const serializedAndDiv1Only = true;

  React.useEffect(() => {
    fetchSupplierOptions()
      .then(setSuppliers)
      .catch(() => {
        // Non-critical — supplier filter will just be empty
      });
  }, []);

  // ── Data hook ───────────────────────────────────────────────────────────
  const { query, setQuery, rows, setRows, loading, error, refresh } =
    usePriceMonitoring();

  // ── Auto-clear rows when product filter is cleared/empty ────────────────
  const [selectedRow, setSelectedRow] = React.useState<
    ViewPriceMonitoringRow | ViewPriceMonitoringRow[] | null
  >(null);

  React.useEffect(() => {
    if (!query.productId) {
      setRows([]);
      setSelectedRow(null);
    }
  }, [query.productId, setRows]);

  // ── Year tab state ──────────────────────────────────────────────────────
  const [selectedYear, setSelectedYear] = React.useState<number | null>(null);

  // ── Granularity state for Trend Chart ───────────────────────────────────
  const [granularity, setGranularity] = React.useState<
    "daily" | "weekly" | "monthly" | "yearly"
  >("monthly");
  const [chartType, setChartType] = React.useState<"line" | "bar">("line");

  // ── Mounted state to avoid hydration mismatch ───────────────────────────
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // ── Product-required validation ─────────────────────────────────────────
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
    const currentYear = new Date().getFullYear();
    setQuery({
      productId: "",
      productCode: null,
      productLabel: null,
      supplierId: "",
      supplierLabel: null,
      dateFrom: `${currentYear}-01-01`,
      dateTo: `${currentYear}-12-31`,
    });
    setShowProductError(false);
  }, [setQuery]);

  // ── Enrich rows with supplier details from suppliers lookup ─────────────
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

  // ── Date range from query ───────────────────────────────────────────────
  const filterDateFrom = React.useMemo(() => {
    if (!query.dateFrom) return undefined;
    const d = new Date(query.dateFrom);
    if (isNaN(d.getTime())) return undefined;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [query.dateFrom]);

  const filterDateTo = React.useMemo(() => {
    if (!query.dateTo) return undefined;
    const d = new Date(query.dateTo);
    if (isNaN(d.getTime())) return undefined;
    d.setHours(23, 59, 59, 999);
    return d;
  }, [query.dateTo]);

  // ── Client-side date filtering ──────────────────────────────────────────
  const filteredEnrichedRows = React.useMemo(() => {
    if (!filterDateFrom && !filterDateTo) return enrichedRows;
    return enrichedRows.filter((row) => {
      const dt = row.priceChangeDatetime ?? row.approvedAt;
      if (!dt) return false;
      const rowTime = new Date(dt).getTime();
      if (filterDateFrom && rowTime < filterDateFrom.getTime()) return false;
      if (filterDateTo && rowTime > filterDateTo.getTime()) return false;
      return true;
    });
  }, [enrichedRows, filterDateFrom, filterDateTo]);

  // ── Years list ──────────────────────────────────────────────────────────
  const derivedAvailableYears = React.useMemo(() => {
    if (!query.dateFrom || !query.dateTo) {
      const years = getUniqueYears(enrichedRows);
      return years.length > 0
        ? years.slice().sort((a, b) => b - a)
        : [new Date().getFullYear()];
    }
    const startYear = new Date(query.dateFrom).getFullYear();
    const endYear = new Date(query.dateTo).getFullYear();
    if (isNaN(startYear) || isNaN(endYear)) {
      const years = getUniqueYears(enrichedRows);
      return years.length > 0
        ? years.slice().sort((a, b) => b - a)
        : [new Date().getFullYear()];
    }
    const years = [];
    for (let y = endYear; y >= startYear; y--) {
      years.push(y);
    }
    return years;
  }, [query.dateFrom, query.dateTo, enrichedRows]);

  React.useEffect(() => {
    if (derivedAvailableYears.length > 0) {
      setSelectedYear((prev) =>
        prev && derivedAvailableYears.includes(prev)
          ? prev
          : derivedAvailableYears[0],
      );
    } else {
      setSelectedYear(null);
    }
  }, [derivedAvailableYears]);

  // ── Export ──────────────────────────────────────────────────────────────
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
      },
      userName,
    );
    toast.success(`Exported ${filteredEnrichedRows.length} record(s) to Excel.`);
  }, [
    filteredEnrichedRows,
    query.productCode,
    query.productLabel,
    query.supplierLabel,
    userName,
  ]);

  // ── Derived data for the selected year ──────────────────────────────────
  const priceTypeGroups = React.useMemo(
    () => groupByPriceType(enrichedRows),
    [enrichedRows],
  );

  const matrixEntries = React.useMemo(() => {
    if (!selectedYear) return [];
    const yearStart = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    const tabDateFrom =
      filterDateFrom && filterDateFrom.getFullYear() === selectedYear
        ? filterDateFrom > yearStart
          ? filterDateFrom
          : yearStart
        : yearStart;
    const tabDateTo =
      filterDateTo && filterDateTo.getFullYear() === selectedYear
        ? filterDateTo < yearEnd
          ? filterDateTo
          : yearEnd
        : yearEnd;

    return priceTypeGroups.map((group) =>
      buildMonthlyMatrix(group, selectedYear, enrichedRows, tabDateFrom, tabDateTo),
    );
  }, [priceTypeGroups, selectedYear, enrichedRows, filterDateFrom, filterDateTo]);

  const overallSummary = React.useMemo(
    () => computeOverallSummary(filteredEnrichedRows),
    [filteredEnrichedRows],
  );

  // ── Render states ───────────────────────────────────────────────────────
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-1 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Price Monitoring
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Monitor approved historical product price changes.
          </p>
        </div>
      </div>
      <Separator className="my-4" />

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* Filter Card */}
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
              serializedAndDiv1Only={serializedAndDiv1Only}
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
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 sm:py-16 text-center">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-muted">
                <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
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
          <KpiBar overallSummary={overallSummary} loading={loading} />
        )}

        {/* Year Tabs & Content cards */}
        {(hasData || loading) && hasYears && selectedYear && (
          <Tabs
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(Number(val))}
          >
            {derivedAvailableYears.length > 1 && (
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                {/* Scrollable tabs on mobile if many years */}
                <div className="overflow-x-auto w-full">
                  <TabsList className="flex-nowrap sm:flex-wrap h-auto gap-1 w-max sm:w-auto">
                    {derivedAvailableYears.map((year) => (
                      <TabsTrigger
                        key={year}
                        value={String(year)}
                        className="text-xs sm:text-sm"
                      >
                        {year}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>
            )}

            {derivedAvailableYears.map((year) => {
              const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
              const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
              const tabDateFrom =
                filterDateFrom && filterDateFrom.getFullYear() === year
                  ? filterDateFrom > yearStart
                    ? filterDateFrom
                    : yearStart
                  : yearStart;
              const tabDateTo =
                filterDateTo && filterDateTo.getFullYear() === year
                  ? filterDateTo < yearEnd
                    ? filterDateTo
                    : yearEnd
                  : yearEnd;

              const tabRows = enrichedRows.filter((row) => {
                const dt = row.priceChangeDatetime ?? row.approvedAt;
                if (!dt) return false;
                const rowTime = new Date(dt).getTime();
                return (
                  rowTime >= tabDateFrom.getTime() &&
                  rowTime <= tabDateTo.getTime()
                );
              });

              return (
                <TabsContent
                  key={year}
                  value={String(year)}
                  className="space-y-4 focus-visible:outline-none"
                >
                  {/* Trend chart card */}
                  <Card className="border shadow-sm">
                    <CardHeader className="flex flex-col gap-3 pb-3">
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm sm:text-base font-bold">
                          Price Trend — {year}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                          One line per price type. X-axis ={" "}
                          {granularity === "daily"
                            ? "day"
                            : granularity === "weekly"
                              ? "week"
                              : granularity === "monthly"
                                ? "month"
                                : "year"}
                          . Carry-forward pricing applied.
                        </CardDescription>
                      </div>

                      {/* Controls — wrap on mobile */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Chart Type Toggle */}
                        <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs">
                          <Button
                            variant={chartType === "line" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2 sm:px-2.5 text-xs font-medium gap-1"
                            onClick={() => setChartType("line")}
                            title="Line Chart View"
                          >
                            <LineChartIcon className="h-3.5 w-3.5" />
                            <span className="hidden xs:inline">Line</span>
                          </Button>
                          <Button
                            variant={chartType === "bar" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-2 sm:px-2.5 text-xs font-medium gap-1"
                            onClick={() => setChartType("bar")}
                            title="Bar Chart View"
                          >
                            <BarChart2 className="h-3.5 w-3.5" />
                            <span className="hidden xs:inline">Bar</span>
                          </Button>
                        </div>

                        {/* Granularity Selector */}
                        <div className="flex items-center border rounded-md p-0.5 bg-muted/40 text-xs">
                          {(
                            ["daily", "weekly", "monthly", "yearly"] as const
                          ).map((g) => (
                            <Button
                              key={g}
                              variant={granularity === g ? "secondary" : "ghost"}
                              size="sm"
                              className="h-7 px-2 sm:px-2.5 text-xs font-medium capitalize"
                              onClick={() => setGranularity(g)}
                              title={`${g.charAt(0).toUpperCase() + g.slice(1)} View`}
                            >
                              {/* Abbreviate on very small screens */}
                              {/* <span className="sm:hidden">
                                {g === "daily"
                                  ? "D"
                                  : g === "weekly"
                                    ? "W"
                                    : g === "monthly"
                                      ? "M"
                                      : "Y"}
                              </span> */}
                              <span>{g}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <PriceTrendChart
                        allRows={enrichedRows}
                        filteredRows={tabRows}
                        selectedYear={year}
                        loading={loading}
                        dateFrom={tabDateFrom}
                        dateTo={tabDateTo}
                        granularity={granularity}
                        chartType={chartType}
                      />
                    </CardContent>
                  </Card>

                  {/* Monthly matrix Table card */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm sm:text-base font-bold">
                        Monthly Price Matrix — {year}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Highlighted cells indicate a price change occurred that month.
                        Outlines show the current live price.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <MonthlyMatrixTable
                        matrixEntries={matrixEntries}
                        selectedYear={year}
                        loading={loading}
                        onSelectRow={setSelectedRow}
                      />
                    </CardContent>
                  </Card>

                  {/* Audit detail grid card */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm sm:text-base font-bold">
                        Audit Detail — {year}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        All approved price change events. Unmapped supplier warnings
                        are shown but records are never hidden.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <AuditDetailGrid
                        rows={tabRows}
                        allRows={enrichedRows}
                        selectedYear={year}
                        loading={loading}
                        selectedRow={selectedRow}
                        onSelectedRowChange={setSelectedRow}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        )}

        {loading && !hasYears && (
          <div className="space-y-4">
            <KpiBar
              overallSummary={{
                currentPrice: null,
                lastUpdated: null,
                highestPrice: null,
                highestPriceYear: null,
                lowestPrice: null,
                lowestPriceYear: null,
                averagePrice: null,
                totalChanges: 0,
              }}
              loading={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}