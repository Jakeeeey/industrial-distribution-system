"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CustomerHistoryRecord, CustomerHistoryResponse } from "../types";

export function useCustomerHistory() {
    const [records, setRecords] = useState<CustomerHistoryRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [totalCount, setTotalCount] = useState(0);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [storeTypeFilter, setStoreTypeFilter] = useState("all");
    const [classificationFilter, setClassificationFilter] = useState("all");

    const [storeTypes, setStoreTypes] = useState<{ id: number; store_type: string }[]>([]);
    const [classifications, setClassifications] = useState<{ id: number; classification_name: string }[]>([]);

    const hasLoadedRef = useRef(false);

    // Fetch filters
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [stRes, clRes] = await Promise.all([
                    fetch("/api/ids/crm/customer-management/store-type"),
                    fetch("/api/ids/crm/customer-management/classification")
                ]);
                if (stRes.ok) {
                    const json = await stRes.ok ? await stRes.json() : { ok: false, data: [] };
                    if (json.ok) setStoreTypes(json.data);
                }
                if (clRes.ok) {
                    const json = await clRes.ok ? await clRes.json() : { ok: false, data: [] };
                    if (json.ok) setClassifications(json.data);
                }
            } catch (err) {
                console.error("Failed to load filter options", err);
            }
        };
        fetchFilters();
    }, []);

    const fetchData = useCallback(async (showLoading = false) => {
        try {
            if (showLoading || !hasLoadedRef.current) {
                setIsLoading(true);
            }
            setIsError(false);
            setError(null);

            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
                q: searchQuery,
                status: statusFilter,
                storeType: storeTypeFilter,
                classification: classificationFilter,
                t: Date.now().toString()
            });

            const res = await fetch(`/api/ids/crm/customer-history?${params.toString()}`, { cache: "no-store" });
            if (!res.ok) {
                throw new Error(`HTTP error ${res.status}`);
            }

            const data: CustomerHistoryResponse = await res.json();
            setRecords(data.customers || []);
            setTotalCount(data.metadata?.total_count || 0);
            hasLoadedRef.current = true;
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error("Unknown error"));
            console.error("Customer history fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [page, pageSize, searchQuery, statusFilter, storeTypeFilter, classificationFilter]);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter, storeTypeFilter, classificationFilter]);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    const refetch = useCallback(() => fetchData(true), [fetchData]);

    return {
        records,
        isLoading,
        isError,
        error,
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
        setPageSize,
        setSearchQuery,
        setStatusFilter,
        setStoreTypeFilter,
        setClassificationFilter,
        refetch
    };
}
