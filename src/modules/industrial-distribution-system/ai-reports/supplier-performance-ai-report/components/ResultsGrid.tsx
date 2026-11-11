/**
 * Results Grid Component - Supplier Performance Scorecard Table
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Smart Sorting: Automatically floats active vendors (with orders due or RTS events) to the top!
 * - Inactive/blank vendors with 0 orders are placed at the bottom
 * - Interactive column click sorting (Supplier, Orders Due, OTIF, Rejection, Cost Variance, Risk Tier)
 * - Retains client-side pagination (10, 25, 50, 100)
 */

'use client';

import React, { useState, useMemo } from 'react';
import { SupplierSummaryRow } from '../types';
import { ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface ResultsGridProps {
    suppliers: SupplierSummaryRow[];
    selectedSupplierId: number | null;
    onSelectSupplier: (supplier: SupplierSummaryRow) => void;
    isLoading: boolean;
    searchTerm: string;
}

type SortField = 'supplierName' | 'totalOrdersDue' | 'otifPercentage' | 'rejectionRatePercentage' | 'averageCostVariancePercentage' | 'rtsCount' | 'riskLevel';
type SortDirection = 'asc' | 'desc';

export const ResultsGrid: React.FC<ResultsGridProps> = ({
    suppliers,
    selectedSupplierId,
    onSelectSupplier,
    isLoading,
    searchTerm,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Track filter/sort state to reset page without triggering cascading effect renders
    const [prevFiltersKey, setPrevFiltersKey] = useState(
        `${searchTerm}_${sortField}_${sortDirection}_${suppliers.length}`
    );
    const currentFiltersKey = `${searchTerm}_${sortField}_${sortDirection}_${suppliers.length}`;

    if (currentFiltersKey !== prevFiltersKey) {
        setPrevFiltersKey(currentFiltersKey);
        setCurrentPage(1);
    }

    // Filter suppliers by name
    const filteredSuppliers = useMemo(() => {
        return suppliers.filter((s) =>
            s.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [suppliers, searchTerm]);

    // Smart Sorting: Default prioritizes active records over blank/empty ones
    const sortedSuppliers = useMemo(() => {
        const list = [...filteredSuppliers];

        if (sortField) {
            list.sort((a, b) => {
                let aVal = a[sortField];
                let bVal = b[sortField];

                if (sortField === 'riskLevel') {
                    const weight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
                    aVal = weight[a.riskLevel] || 0;
                    bVal = weight[b.riskLevel] || 0;
                }

                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Default Smart Sort: Active vendors (due orders or RTS returns) FIRST, zero-order blank vendors LAST
            list.sort((a, b) => {
                const aActive = a.totalOrdersDue > 0 || a.rtsCount > 0 ? 1 : 0;
                const bActive = b.totalOrdersDue > 0 || b.rtsCount > 0 ? 1 : 0;

                if (aActive !== bActive) {
                    return bActive - aActive; // Active first
                }

                // If both are active, order by highest orders due or highest RTS
                if (a.totalOrdersDue !== b.totalOrdersDue) {
                    return b.totalOrdersDue - a.totalOrdersDue;
                }
                return b.rtsCount - a.rtsCount;
            });
        }

        return list;
    }, [filteredSuppliers, sortField, sortDirection]);

    const handleHeaderClick = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Pagination calculations
    const totalRecords = sortedSuppliers.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const paginatedSuppliers = sortedSuppliers.slice(startIndex, endIndex);

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-3 w-3 opacity-40 ml-1 inline" />;
        }
        return sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />
        ) : (
            <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />
        );
    };

    return (
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
            {/* Table Header */}
            <div className="p-4 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">Supplier Reliability & Quality Scorecard</h2>
                    <p className="text-xs text-muted-foreground">
                        Showing {totalRecords} vendor scorecards based on validated source records (active records prioritized).
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                    <thead>
                        <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                            <th
                                className="py-2.5 px-4 cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleHeaderClick('supplierName')}
                            >
                                Supplier {renderSortIcon('supplierName')}
                            </th>
                            <th
                                className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleHeaderClick('totalOrdersDue')}
                            >
                                Orders Due {renderSortIcon('totalOrdersDue')}
                            </th>
                            <th
                                className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleHeaderClick('otifPercentage')}
                            >
                                OTIF % {renderSortIcon('otifPercentage')}
                            </th>
                            <th
                                className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleHeaderClick('rejectionRatePercentage')}
                            >
                                Rejection % {renderSortIcon('rejectionRatePercentage')}
                            </th>
                            <th
                                className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleHeaderClick('averageCostVariancePercentage')}
                            >
                                Cost Variance {renderSortIcon('averageCostVariancePercentage')}
                            </th>
                            <th
                                className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleHeaderClick('rtsCount')}
                            >
                                RTS Returns {renderSortIcon('rtsCount')}
                            </th>
                            <th
                                className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleHeaderClick('riskLevel')}
                            >
                                Risk Tier {renderSortIcon('riskLevel')}
                            </th>
                            <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                        {isLoading ? (
                            <tr>
                                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                                    Loading supplier scorecards...
                                </td>
                            </tr>
                        ) : paginatedSuppliers.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                                    No supplier performance records found for the selected filter or search term.
                                </td>
                            </tr>
                        ) : (
                            paginatedSuppliers.map((row) => {
                                const isSelected = row.supplierId === selectedSupplierId;
                                return (
                                    <tr
                                        key={row.supplierId}
                                        onClick={() => onSelectSupplier(row)}
                                        className={`cursor-pointer transition-colors hover:bg-muted/40 ${
                                            isSelected ? 'bg-primary/5 font-medium' : ''
                                        }`}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-foreground">{row.supplierName}</div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {row.paymentTerms ? `Terms: ${row.paymentTerms}` : 'No terms registered'}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-center text-muted-foreground font-semibold">
                                            {row.totalOrdersDue}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {row.otifPercentage !== null ? (
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                                        row.otifPercentage >= 85
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                            : row.otifPercentage >= 70
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                                    }`}
                                                >
                                                    {row.otifPercentage}%
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-[11px]">N/A</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {row.rejectionRatePercentage !== null ? (
                                                <span
                                                    className={`text-[11px] font-semibold ${
                                                        row.rejectionRatePercentage > 3
                                                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                                                            : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    {row.rejectionRatePercentage}%
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-[11px]">0.00%</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center text-muted-foreground">
                                            {row.averageCostVariancePercentage !== null ? (
                                                <span
                                                    className={
                                                        row.averageCostVariancePercentage > 0
                                                            ? 'text-amber-600 dark:text-amber-400 font-medium'
                                                            : 'text-emerald-600 dark:text-emerald-400 font-medium'
                                                    }
                                                >
                                                    {row.averageCostVariancePercentage > 0
                                                        ? `+${row.averageCostVariancePercentage}%`
                                                        : `${row.averageCostVariancePercentage}%`}
                                                </span>
                                            ) : (
                                                '0%'
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center text-muted-foreground">
                                            {row.rtsCount > 0 ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200/50">
                                                    {row.rtsCount} RTS
                                                </span>
                                            ) : (
                                                '0'
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                                    row.riskLevel === 'HIGH'
                                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                                        : row.riskLevel === 'MEDIUM'
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                                }`}
                                            >
                                                {row.riskLevel}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectSupplier(row);
                                                }}
                                                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                            >
                                                Details
                                                <ChevronRight className="h-3 w-3" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls Footer */}
            <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-muted/20">
                <div className="text-muted-foreground text-[11px]">
                    {totalRecords > 0 ? (
                        <>
                            Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{' '}
                            <span className="font-semibold text-foreground">{endIndex}</span> of{' '}
                            <span className="font-semibold text-foreground">{totalRecords}</span> entries
                        </>
                    ) : (
                        'No entries to show'
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 rounded border border-input bg-background text-foreground text-xs"
                        >
                            {[10, 25, 50, 100].map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                            title="First Page"
                        >
                            <ChevronsLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                            title="Previous Page"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2 text-[11px] font-medium text-foreground">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                            title="Next Page"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded border border-input bg-background hover:bg-muted text-foreground disabled:opacity-40"
                            title="Last Page"
                        >
                            <ChevronsRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
