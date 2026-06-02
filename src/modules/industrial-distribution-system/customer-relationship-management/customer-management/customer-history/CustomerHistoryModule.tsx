"use client";

import React, { useState } from "react";
import { useCustomerHistory } from "./hooks/useCustomerHistory";
import { HistoryTable } from "./components/HistoryTable";
import { HistoryDetailsModal } from "./components/HistoryDetailsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { 
    Search, 
    RefreshCcw,
    History
} from "lucide-react";
import { CustomerHistoryRecord } from "./types";
import { cn } from "@/lib/utils";

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
        setPage,
        setSearchQuery,
        setStatusFilter,
        setStoreTypeFilter,
        setClassificationFilter,
        refetch
    } = useCustomerHistory();

    const [selectedRecord, setSelectedRecord] = useState<CustomerHistoryRecord | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const handleViewRecord = (record: CustomerHistoryRecord) => {
        setSelectedRecord(record);
        setDetailsOpen(true);
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500 p-4 md:p-10 bg-background/50 h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
            {/* Header Section */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                        <History className="h-7 w-7 text-primary" />
                        Customer History Logs
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        View historical log entries, registration files, and contact details for customers.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => refetch()}
                    className="h-10 rounded-lg border-border/60 bg-background shadow-sm hover:bg-muted/50 transition-all flex items-center gap-2 text-xs font-medium"
                >
                    <RefreshCcw className={cn("h-4 w-4 text-muted-foreground", isLoading && "animate-spin")} />
                    Refresh logs
                </Button>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
                <div className="relative w-full md:w-[350px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                        placeholder="Search logs by name, code, contact..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 bg-background border-border/60 rounded-lg shadow-sm focus-visible:ring-primary/20 text-sm"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <SearchableSelect
                            value={storeTypeFilter}
                            onValueChange={setStoreTypeFilter}
                            options={[
                                { value: "all", label: "All Store Types" },
                                ...storeTypes.map(st => ({ value: st.id.toString(), label: st.store_type }))
                            ]}
                            placeholder="Store Type"
                            className="h-11 w-[160px] rounded-lg border-border/60 text-[10px] font-black uppercase tracking-widest px-4 shadow-sm bg-background"
                        />

                        <SearchableSelect
                            value={classificationFilter}
                            onValueChange={setClassificationFilter}
                            options={[
                                { value: "all", label: "All Classifications" },
                                ...classifications.map(cl => ({ value: cl.id.toString(), label: cl.classification_name }))
                            ]}
                            placeholder="Classification"
                            className="h-11 w-[160px] rounded-lg border-border/60 text-[10px] font-black uppercase tracking-widest px-4 shadow-sm bg-background"
                        />

                        <SearchableSelect
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                            options={[
                                { value: "all", label: "All Status" },
                                { value: "active", label: "Active" },
                                { value: "inactive", label: "Inactive" }
                            ]}
                            placeholder="Status"
                            className="h-11 w-[140px] rounded-lg border-border/60 text-[10px] font-black uppercase tracking-widest px-4 shadow-sm bg-background"
                        />
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="min-h-[500px] flex-1">
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
            />
        </div>
    );
}
