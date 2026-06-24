"use client";

import { useEffect, useMemo, useState } from "react";
import { useInventoryControl } from "./hooks/useInventoryControl";
import { InventorySummaryCards } from "./components/InventorySummaryCards";
import { InventoryCategoryAccordion } from "./components/InventoryCategoryAccordion";
import { InventoryDetailModal } from "./components/InventoryDetailModal";

import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers } from "lucide-react";
import { BranchSelector } from "../../warehouse-management/consolidation/delivery-picking/components/BranchSelector";

import { AlertTriangle, PackageOpen, RefreshCw, Search } from "lucide-react";

export default function InventoryControlModule() {
  const {
    branches,
    selectedBranchId,
    setSelectedBranchId,
    initBranches,
    categoryGroups,
    summary,
    loading,
    error,
    selectedProduct,
    openModal,
    closeModal,
    initialStockFilter,
    setViewMode,
    searchQuery,
    setSearchQuery,
    filteredSerials,
    printOptions,
    setPrintOptions,
    loadData,
  } = useInventoryControl();

  useEffect(() => {
    // load branch list and initial data (loadData only once on mount)
    initBranches();
  }, [initBranches]);

  // load initial data exactly once (safe with linter by including deps)
  useEffect(() => {
    let called = false;
    if (!called) {
      called = true;
      loadData(selectedBranchId ?? 196);
    }
    // we intentionally do not want to re-run this when selectedBranchId changes
    // further changes are handled via setSelectedBranchId in the hook
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);
  const [inventorySearch, setInventorySearch] = useState("");
  const hasData = categoryGroups.length > 0;

  const filteredCategoryGroups = useMemo(() => {
    if (!inventorySearch.trim()) return categoryGroups;

    const query = inventorySearch.toLowerCase();

    return categoryGroups
      .map((group) => ({
        ...group,
        products: group.products.filter(
          (product) =>
            product.productName?.toLowerCase().includes(query) ||
            product.barcode?.toLowerCase().includes(query) ||
            product.serials?.some((serial) =>
              serial.serialNumber?.toLowerCase().includes(query),
            ),
        ),
      }))
      .filter((group) => group.products.length > 0);
  }, [categoryGroups, inventorySearch]);

  const showEmpty =
    !loading &&
    !error &&
    selectedBranchId !== null &&
    filteredCategoryGroups.length === 0;

  const handleRefresh = () => {
    loadData(196);
  };

  const mappedBranches = branches.map((b) => ({
    id: b.id,
    branchName: b.branch_name,
    branchCode: String(b.id),
  }));

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-6 md:space-y-8 bg-background text-foreground min-h-screen pb-20 transition-all duration-500 ease-in-out">
      {/* Modern Header (DeliveryPicking style) */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 xl:gap-6 sticky top-0 z-30 py-2 sm:py-4 bg-background/90 backdrop-blur-md border-b border-border/40 xl:border-transparent transition-all">
        {/* Title & Branch Section */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 shrink-0 w-full xl:w-auto">
          <div className="hidden sm:flex p-3 bg-primary rounded-2xl shadow-xl shadow-primary/20 rotate-3 shrink-0">
            <Layers className="h-6 w-6 lg:h-8 lg:w-8 text-primary-foreground stroke-[2.5px]" />
          </div>
          <div className="space-y-2 sm:space-y-0.5 shrink-0 w-full sm:w-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter uppercase italic leading-none whitespace-nowrap flex items-center gap-2">
              <Layers className="h-5 w-5 sm:hidden text-primary stroke-[3px] -mt-0.5" />
              <span className="text-primary">Inventory Control</span>
            </h2>
            <div className="w-full sm:w-auto">
              <BranchSelector
                branches={mappedBranches}
                selectedBranchId={selectedBranchId ?? undefined}
                onBranchChange={(id) => setSelectedBranchId(id)}
                isLoading={loading}
              />
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
          {/* Search Field */}
          <div className="relative w-full sm:w-64 md:w-72 group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-500/30 blur opacity-0 group-focus-within:opacity-100 transition duration-500 rounded-xl" />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 opacity-50" />
            <Input
              placeholder="Search products, barcode or serial..."
              className="relative w-full pl-10 bg-card/50 border-border/40 h-10 sm:h-12 shadow-inner font-bold placeholder:font-medium text-xs sm:text-sm rounded-xl focus-visible:ring-primary/20 z-10 backdrop-blur-sm"
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
            />
          </div>

          <div className="h-8 w-[1px] bg-border/50 mx-1 hidden sm:block" />

          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto items-center">
            <Button
              variant="outline"
              className="h-10 sm:h-12"
              onClick={() => handleRefresh()}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>

          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <Alert variant="destructive" id="inventory-error-alert">
          <AlertTriangle className="h-4 w-4" />

          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error}</span>

            {selectedBranchId && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                className="gap-1.5 shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Data */}
      {hasData && !loading && (
        <>
          {/* KPI Cards */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <InventorySummaryCards summary={summary} />
          </div>

          {/* Inventory Categories */}
          <InventoryCategoryAccordion
            categoryGroups={filteredCategoryGroups}
            onProductClick={(product, filter) => {
              // Dev-rule: Exclude the search bar from main to modals. Modal search bar is serials only and starts clean.
              openModal(product, filter);
            }}
          />
        </>
      )}

      {/* Empty State */}
      {showEmpty && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 py-16">
          <div className="rounded-full bg-muted p-4">
            <PackageOpen className="h-8 w-8 text-muted-foreground" />
          </div>

          <p className="text-sm font-medium">No inventory records found</p>

          <p className="text-xs text-muted-foreground">
            {inventorySearch
              ? "No products or serial numbers match your search."
              : "No serial on-hand data available for this branch."}
          </p>
        </div>
      )}

      {/* Detail Modal */}
      <InventoryDetailModal
        key={selectedProduct ? selectedProduct.productId : "none"}
        product={selectedProduct}
        open={selectedProduct !== null}
        onClose={closeModal}
        setViewMode={setViewMode}
        filteredSerials={filteredSerials}
        printOptions={printOptions}
        setPrintOptions={setPrintOptions}
        initialStockFilter={initialStockFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </div>
  );
}
