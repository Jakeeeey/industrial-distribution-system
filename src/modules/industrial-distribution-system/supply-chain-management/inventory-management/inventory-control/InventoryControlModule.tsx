"use client";

import { useEffect } from "react";
import { useInventoryControl } from "./hooks/useInventoryControl";
import { InventorySummaryCards } from "./components/InventorySummaryCards";
import { InventoryCategoryAccordion } from "./components/InventoryCategoryAccordion";
import { InventoryDetailModal } from "./components/InventoryDetailModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, PackageOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InventoryControlModule() {
    const {
        selectedBranchId,
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
        loadData(196);
    }, [loadData]);

    const hasData = categoryGroups.length > 0;
    const showEmpty = !loading && !error && selectedBranchId !== null && !hasData;

    return (
        <div className="flex flex-col gap-5 px-4">
            {/* ── Page Title ───────────────────── */}
            <div className="flex flex-col gap-3 py-5 px-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">LPG Inventory Control</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Real-time cylinder on-hand status by product and category
                    </p>
                </div>
            </div>


            {/* ── Loading Skeleton ─────────────────────────────────── */}
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

            {/* ── Error State ──────────────────────────────────────── */}
            {error && !loading && (
                <Alert variant="destructive" id="inventory-error-alert">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{error}</span>
                        {selectedBranchId && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadData(196)}
                                className="gap-1.5 shrink-0"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Retry
                            </Button>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            {/* ── Empty State ──────────────────────────────────────── */}
            {showEmpty && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16 gap-3">
                    <div className="rounded-full bg-muted p-4">
                        <PackageOpen className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No inventory records found</p>
                    <p className="text-xs text-muted-foreground">
                        No serial on-hand data available for this branch.
                    </p>
                </div>
            )}

            {/* ── Data View ────────────────────────────────────────── */}
            {hasData && !loading && (
                <>
                    {/* KPI Cards */}
                    <InventorySummaryCards summary={summary} />

                    {/* Category Accordion */}
                    <InventoryCategoryAccordion
                        categoryGroups={categoryGroups}
                        onProductClick={openModal}
                    />
                </>
            )}

            {/* ── Detail Modal ─────────────────────────────────────── */}
            <InventoryDetailModal
                product={selectedProduct}
                open={selectedProduct !== null}
                onClose={closeModal}
                setViewMode={setViewMode}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filteredSerials={filteredSerials}
                printOptions={printOptions}
                setPrintOptions={setPrintOptions}
                initialStockFilter={initialStockFilter}
            />
        </div>
    );
}
