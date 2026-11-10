"use client";

import * as React from "react";
import type { Branch, BranchSortKey, BranchStatusFilter, PaginationMeta } from "../types";
import { fetchBranches } from "../providers/fetchProvider";

const SEARCH_DEBOUNCE_MS = 350;

const EMPTY_META: PaginationMeta = { total: 0, page: 1, limit: 10, totalPages: 1 };

/**
 * Custom hook to manage branch management state, filtering, sorting, and pagination.
 * Resets page to 1 on filter or search updates to ensure results stay within valid bounds.
 */
export function useBranchManagement() {
    const [branches, setBranches] = React.useState<Branch[]>([]);
    const [meta, setMeta] = React.useState<PaginationMeta>(EMPTY_META);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQueryRaw] = React.useState("");
    const [filterType, setFilterTypeRaw] = React.useState<BranchStatusFilter>("All");
    const [sortKey, setSortKeyRaw] = React.useState<BranchSortKey>("name");

    // Pagination
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPageRaw] = React.useState(10);
    const [reloadToken, setReloadToken] = React.useState(0);

    const [deferredQuery, setDeferredQuery] = React.useState("");
    React.useEffect(() => {
        const t = setTimeout(() => {
            setDeferredQuery(searchQuery);
            setCurrentPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // Batched filter updates that reset currentPage to 1 synchronously
    const setSearchQuery = React.useCallback((q: string) => {
        setSearchQueryRaw(q);
    }, []);

    const setFilterType = React.useCallback((status: BranchStatusFilter) => {
        setFilterTypeRaw(status);
        setCurrentPage(1);
    }, []);

    const setSortKey = React.useCallback((sort: BranchSortKey) => {
        setSortKeyRaw(sort);
        setCurrentPage(1);
    }, []);

    const setItemsPerPage = React.useCallback((limit: number) => {
        setItemsPerPageRaw(limit);
        setCurrentPage(1);
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchBranches({
                    page: currentPage,
                    limit: itemsPerPage,
                    sort: sortKey,
                    status: filterType,
                    q: deferredQuery,
                });
                if (cancelled) return;
                setBranches(data.branches || []);
                setMeta(data.meta);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load data");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [currentPage, itemsPerPage, sortKey, filterType, deferredQuery, reloadToken]);

    // Deleting the last row of the final page would otherwise strand the table on an empty page.
    React.useEffect(() => {
        if (currentPage > meta.totalPages && meta.totalPages > 0) {
            setCurrentPage(meta.totalPages);
        }
    }, [currentPage, meta.totalPages]);

    const refresh = React.useCallback(() => setReloadToken((t) => t + 1), []);

    return {
        branches,
        meta,
        loading,
        error,
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType,
        sortKey,
        setSortKey,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        refresh,
    };
}
