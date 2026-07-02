"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { CompetitorPriceListFetchProvider } from "./providers/fetchproviders";
import { useCompetitorPriceList } from "./hooks/useCompetitorPriceList";
import { PriceListFilters } from "./components/PriceListFilters";
import { PriceListTable } from "./components/PriceListTable";
import { MarketSnapshotPanel } from "./components/MarketSnapshotPanel";
import { PriceTrendChart } from "./components/PriceTrendChart";
import {
  computeMarketSnapshot,
  computeProvinceStats,
  computeSourceStats,
} from "./utils/analytics";

// ─── Inner Content (inside provider) ─────────────────────────────────────────

function CompetitorPriceListContent() {
  const {
    competitors,
    products,
    isLoading,
    isError,
    error,
    refetch,
    filters,
    appliedFilters,
    setFilter,
    resetFilters,
    applyFilters,
    hasActiveFilters,
    filteredEntries,
    chartFilteredEntries,
    provinces,
    municipalities,
    barangays,
  } = useCompetitorPriceList();

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [chartFocusCompetitorId, setChartFocusCompetitorId] =
    React.useState<string>("");
  const [chartFocusProductId, setChartFocusProductId] =
    React.useState<string>("");
  // Tracks what kind of row was last clicked so the chart auto-configures:
  // "competitor" → product mode (show all products of that competitor)
  // "product"    → all-competitors mode (show all competitors for that product)
  const [chartFocusMode, setChartFocusMode] = React.useState<
    "competitor" | "product" | null
  >(null);

  // Sync chartFocusCompetitorId with appliedFilters.competitorId when filter is set explicitly
  React.useEffect(() => {
    if (appliedFilters.competitorId) {
      setChartFocusCompetitorId(appliedFilters.competitorId);
    }
  }, [appliedFilters.competitorId]);

  // Sync chartFocusProductId with appliedFilters.productId when filter is set explicitly
  React.useEffect(() => {
    if (appliedFilters.productId) {
      setChartFocusProductId(appliedFilters.productId);
    }
  }, [appliedFilters.productId]);

  // Clear focus when filters are reset
  React.useEffect(() => {
    if (!appliedFilters.competitorId && !appliedFilters.productId && !appliedFilters.search) {
      setChartFocusCompetitorId("");
      setChartFocusProductId("");
      setChartFocusMode(null);
    }
  }, [appliedFilters.competitorId, appliedFilters.productId, appliedFilters.search]);

  const selectedCompetitorId = React.useMemo(() => {
    return appliedFilters.competitorId || chartFocusCompetitorId || "";
  }, [appliedFilters.competitorId, chartFocusCompetitorId]);

  const selectedCompetitorName = React.useMemo(() => {
    if (!selectedCompetitorId) return undefined;
    return competitors.find((c) => String(c.id) === selectedCompetitorId)?.name;
  }, [selectedCompetitorId, competitors]);

  const selectedProductName = React.useMemo(() => {
    return appliedFilters.productId || chartFocusProductId;
  }, [appliedFilters.productId, chartFocusProductId]);

  // Filter down entries for the Chart and Snapshot Panel based on focused product and competitor
  const chartAndAnalyticsEntries = React.useMemo(() => {
    let result = filteredEntries;

    // 1. Filter by focused product (only when a product is explicitly selected or focused)
    const activeProd = selectedProductName;
    if (activeProd) {
      result = result.filter((e) => e.product_name === activeProd);
    }

    // 2. Filter by focused competitor
    const activeCompId = appliedFilters.competitorId || chartFocusCompetitorId;
    if (activeCompId) {
      result = result.filter((entry) => {
        const id =
          typeof entry.competitor_id === "object" &&
            entry.competitor_id !== null
            ? String(entry.competitor_id.id)
            : String(entry.competitor_id);
        return id === activeCompId;
      });
    }

    return result;
  }, [
    filteredEntries,
    selectedProductName,
    appliedFilters.competitorId,
    chartFocusCompetitorId,
  ]);

  // Filter down entries for the Chart (we do NOT filter by competitor here so we can see all competitors and calculate average correctly)
  const chartEntries = React.useMemo(() => {
    let result = chartFilteredEntries;

    // Filter by focused product (only when a product is explicitly selected or focused)
    const activeProd = selectedProductName;
    if (activeProd) {
      result = result.filter((e) => e.product_name === activeProd);
    }

    return result;
  }, [chartFilteredEntries, selectedProductName]);

  // Compute focused metrics for the MarketSnapshotPanel
  const scopedMarketSnapshot = React.useMemo(() => {
    return computeMarketSnapshot(chartAndAnalyticsEntries);
  }, [chartAndAnalyticsEntries]);

  const scopedProvinceStats = React.useMemo(() => {
    return computeProvinceStats(chartAndAnalyticsEntries);
  }, [chartAndAnalyticsEntries]);

  const scopedSourceStats = React.useMemo(() => {
    return computeSourceStats(chartAndAnalyticsEntries);
  }, [chartAndAnalyticsEntries]);

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>
            Failed to load competitor price data:{" "}
            {error?.message || "Unknown error"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="ml-4 shrink-0"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!mounted) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 animate-pulse">
        {/* Skeleton header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-9 w-24 bg-muted rounded" />
        </div>
        <div className="h-[1px] w-full bg-muted my-4" />
        {/* Skeleton body — stacks on mobile, side-by-side on lg */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="flex-1 min-w-0 space-y-4 w-full">
            <div className="h-32 bg-muted rounded" />
            <div className="h-96 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
          <div className="w-full lg:w-72 shrink-0 h-48 lg:h-[600px] bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    // 🚀 STANDARD SHADCN DASHBOARD LAYOUT — mobile-responsive
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
        <div>
          {/* Smaller heading on mobile to avoid overflow */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Competitor Price Intelligence
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm sm:text-base">
            Market pricing data by competitor, location, and source type.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="self-start sm:self-auto"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      <Separator className="my-4" />

      {/* ─── Main Layout: Table + Analytics ──────────────────────────── */}
      {/* On mobile: stacked (flex-col). On lg+: side-by-side (flex-row). */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Left: Filters + Chart + Table — always full-width on mobile */}
        <div className="flex-1 min-w-0 space-y-4 w-full">
          <PriceListFilters
            filters={filters}
            activeProductId={filters.productId || ""}
            setFilter={setFilter}
            resetFilters={resetFilters}
            applyFilters={applyFilters}
            hasActiveFilters={hasActiveFilters}
            competitors={competitors}
            products={products}
            provinces={provinces}
            municipalities={municipalities}
            barangays={barangays}
          />

          <PriceTrendChart
            data={chartEntries}
            competitorId={selectedCompetitorId}
            competitorName={selectedCompetitorName}
            dateFrom={appliedFilters.dateFrom}
            dateTo={appliedFilters.dateTo}
            focusMode={chartFocusMode}
          />

          <PriceListTable
            data={filteredEntries}
            isLoading={isLoading}
            onRowClick={(competitorId, productName, groupMode) => {
              if (competitorId && !productName) {
                // ── Competitor group header expanded ──────────────────────────
                // Chart: show all products of this competitor vs our price
                setChartFocusCompetitorId(competitorId);
                setChartFocusProductId("");
                setFilter("productId", "");
                setFilter("competitorId", "");
                setChartFocusMode("competitor");
              } else if (!competitorId && productName) {
                // ── Product group header expanded ─────────────────────────────
                // Chart: show all competitors for this product vs our price
                setChartFocusProductId(productName);
                setChartFocusCompetitorId("");
                setFilter("productId", "");
                setChartFocusMode("product");
              } else if (competitorId && productName) {
                // ── Sub-row clicked (specific competitor + product) ───────────
                setChartFocusProductId(productName);
                setChartFocusCompetitorId(competitorId);
                setFilter("productId", "");
                setFilter("competitorId", "");
                setChartFocusMode(groupMode === "product" ? "product" : "competitor");
              } else {
                // ── Collapsed / cleared ───────────────────────────────────────
                setChartFocusCompetitorId("");
                setChartFocusProductId("");
                setChartFocusMode(null);
              }
            }}
          />
        </div>

        {/* Right: Analytics Panel — full-width on mobile, fixed on desktop */}
        <div className="w-full lg:w-72 shrink-0">
          <MarketSnapshotPanel
            snapshot={scopedMarketSnapshot}
            provinceStats={scopedProvinceStats}
            sourceStats={scopedSourceStats}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Module Root (with Provider) ─────────────────────────────────────────────

export default function CompetitorPriceListModule() {
  return (
    <CompetitorPriceListFetchProvider>
      <CompetitorPriceListContent />
    </CompetitorPriceListFetchProvider>
  );
}
