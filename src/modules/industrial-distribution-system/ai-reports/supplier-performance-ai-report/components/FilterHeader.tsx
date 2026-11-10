/**
 * Filter and Action Header Component
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Direct PDF/Print trigger calling the high-fidelity document generator with company header
 * - Search Supplier at start of row
 * - Clean title and single-icon AI Copilot
 */

'use client';

import React from 'react';
import { SupplierPerformanceFilter } from '../types';
import { Sparkles, Filter, RefreshCw, Printer, Search } from 'lucide-react';

interface FilterHeaderProps {
    filter: SupplierPerformanceFilter;
    onFilterChange: (newFilter: SupplierPerformanceFilter) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onRefresh: () => void;
    onToggleAi: () => void;
    onPrint: () => void;
    isAiLoading: boolean;
    isReportLoading: boolean;
    branches: Array<{ id: number; branch_name: string }>;
}

export const FilterHeader: React.FC<FilterHeaderProps> = ({
    filter,
    onFilterChange,
    searchTerm,
    onSearchChange,
    onRefresh,
    onToggleAi,
    onPrint,
    isAiLoading,
    isReportLoading,
    branches,
}) => {
    return (
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    {/* Clean Title */}
                    <h1 className="text-xl font-bold text-foreground">Supplier Performance AI Report</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Evaluates OTIF scorecards, Return-To-Supplier (RTS) defect trends, and cost variance with Gemini AI.
                    </p>
                </div>

                {/* Top Action Toolbar */}
                <div className="flex items-center flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onPrint}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-input rounded-lg bg-background hover:bg-muted text-foreground transition-colors shadow-2xs"
                        title="Print or Export Formatted PDF with Company Header"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print / Export PDF
                    </button>

                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isReportLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-input rounded-lg bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isReportLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>

                    {/* AI Copilot Trigger with single colored icon */}
                    <button
                        type="button"
                        onClick={onToggleAi}
                        disabled={isAiLoading || isReportLoading}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-xs transition-all disabled:opacity-50"
                    >
                        <Sparkles className={`h-3.5 w-3.5 ${isAiLoading ? 'animate-spin text-amber-200' : 'text-amber-300'}`} />
                        {isAiLoading ? 'Gemini Analyzing...' : 'AI Copilot'}
                    </button>
                </div>
            </div>

            {/* Filter Controls Row: Searchbar is at Column 1 (Start of the Row) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-border/60">
                {/* 1. Search Bar at Start */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Search Supplier</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Type vendor name..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                        />
                    </div>
                </div>

                {/* 2. Start Date */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Start Date</label>
                    <input
                        type="date"
                        value={filter.startDate || ''}
                        onChange={(e) => onFilterChange({ ...filter, startDate: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                    />
                </div>

                {/* 3. End Date */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">End Date</label>
                    <input
                        type="date"
                        value={filter.endDate || ''}
                        onChange={(e) => onFilterChange({ ...filter, endDate: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                    />
                </div>

                {/* 4. Branch */}
                <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Branch</label>
                    <select
                        value={filter.branchId || ''}
                        onChange={(e) => onFilterChange({ ...filter, branchId: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                    >
                        <option value="">All Branches</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.branch_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 5. Apply Filters */}
                <div className="flex items-end">
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    >
                        <Filter className="h-3.5 w-3.5" />
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
};
