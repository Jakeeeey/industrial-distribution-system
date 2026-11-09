"use client";

import React, { useMemo, useState } from "react";
import { useCustomerHistory } from "./hooks/useCustomerHistory";
import { HistoryTable } from "./components/HistoryTable";
import { HistoryDetailsModal } from "./components/HistoryDetailsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Search,
    RefreshCcw,
    History,
    X,
} from "lucide-react";
import { CustomerHistoryRecord } from "./types";
import { cn } from "@/lib/utils";

const filterTriggerClass = (active: boolean) =>
    cn(
        "h-10 w-full justify-between rounded-lg border px-3 text-sm font-medium shadow-none transition-colors sm:w-[170px]",
        active
            ? "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10"
            : "border-border/60 bg-background text-foreground hover:bg-muted/50",
    );

export default function CustomerHistoryModule() {
    const {
        records,
        isLoading,
        totalCount,
        page,
        pageSize,
        searchQuery,
        statusFilter,
        storeTypeFilter,
        classificationFilter,
        storeTypes,
        classifications,
        hasActiveFilters,
        setPage,
        setSearchQuery,
        setStatusFilter,
        setStoreTypeFilter,
        setClassificationFilter,
        resetFilters,
        refetch
    } = useCustomerHistory();

    const [selectedRecord, setSelectedRecord] = useState<CustomerHistoryRecord | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const storeTypeLabels = useMemo(
        () => Object.fromEntries(storeTypes.map((st) => [String(st.id), st.store_type])),
        [storeTypes],
    );
    const classificationLabels = useMemo(
        () => Object.fromEntries(classifications.map((cl) => [String(cl.id), cl.classification_name])),
        [classifications],
    );

    const handleViewRecord = (record: CustomerHistoryRecord) => {
        setSelectedRecord(record);
        setDetailsOpen(true);
    };

    return (
        <div className="flex min-h-full flex-col gap-6 bg-background/50 p-4 md:p-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
                        <History className="h-6 w-6 shrink-0 text-primary" />
                        Customer History Logs
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Registration files and contact details for every customer.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => refetch()}
                    disabled={isLoading}
                    className="h-10 gap-2 rounded-lg border-border/60 bg-background text-sm shadow-sm hover:bg-muted/50"
                >
                    <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            {/* Filter bar */}
            <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3 shadow-sm lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, code, contact, or email"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 rounded-lg border-border/60 pl-9 pr-9 text-sm"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                    <SearchableSelect
                        value={storeTypeFilter}
                        onValueChange={setStoreTypeFilter}
                        options={[
                            { value: "all", label: "All Store Types" },
                            ...storeTypes.map(st => ({ value: st.id.toString(), label: st.store_type }))
                        ]}
                        placeholder="Store Type"
                        className={filterTriggerClass(storeTypeFilter !== "all")}
                    />

                    <SearchableSelect
                        value={classificationFilter}
                        onValueChange={setClassificationFilter}
                        options={[
                            { value: "all", label: "All Classifications" },
                            ...classifications.map(cl => ({ value: cl.id.toString(), label: cl.classification_name }))
                        ]}
                        placeholder="Classification"
                        className={filterTriggerClass(classificationFilter !== "all")}
                    />

                    <SearchableSelect
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                        options={[
                            { value: "all", label: "All Statuses" },
                            { value: "active", label: "Active" },
                            { value: "inactive", label: "Inactive" }
                        ]}
                        placeholder="Status"
                        className={filterTriggerClass(statusFilter !== "all")}
                    />

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            onClick={resetFilters}
                            className="h-10 gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            {/* Table Section */}
            <div className="flex-1">
                <HistoryTable
                    data={records}
                    isLoading={isLoading}
                    onView={handleViewRecord}
                    page={page}
                    setPage={setPage}
                    totalCount={totalCount}
                    pageSize={pageSize}
                />
            </div>

            {/* Details Modal */}
            <HistoryDetailsModal
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                record={selectedRecord}
                storeTypeLabel={storeTypeLabels[String(selectedRecord?.store_type ?? "")]}
                classificationLabel={classificationLabels[String(selectedRecord?.classification ?? "")]}
            />
        </div>
    );
}
