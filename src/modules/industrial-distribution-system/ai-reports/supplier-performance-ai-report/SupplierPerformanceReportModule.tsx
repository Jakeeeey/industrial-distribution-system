/**
 * Main Container Module for Supplier Performance AI Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Smart sorting prioritizing active vendors
 * - Vibrant chromatic metric cards with glowing hover elevations
 * - High-fidelity print generator incorporating company logo, TIN, and full formatted document
 * - Option A: Slide-over Sheet drawer for vendor evidence details
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    SupplierPerformanceFilter,
    SupplierPerformanceReportPayload,
    SupplierSummaryRow,
    AiInsightResponse,
    AiTierSlug,
} from './types';
import {
    fetchSupplierPerformanceData,
    generateGeminiInsights,
    fetchBranchesList,
    fetchCompanyPdfData,
} from './services/reportService';
import { generateSupplierPerformancePrintHtml } from './utils/generateSupplierPerformancePrintHtml';
import { FilterHeader } from './components/FilterHeader';
import { SummaryCards } from './components/SummaryCards';
import { ResultsGrid } from './components/ResultsGrid';
import { DetailDrawer } from './components/DetailPanel';
import { AiInsightsPanel } from './components/AiInsightsPanel';

export const SupplierPerformanceReportModule: React.FC = () => {
    const [filter, setFilter] = useState<SupplierPerformanceFilter>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [branches, setBranches] = useState<Array<{ id: number; branch_name: string }>>([]);
    const [companyData, setCompanyData] = useState<Record<string, any> | null>(null);
    const [reportData, setReportData] = useState<SupplierPerformanceReportPayload | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummaryRow | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [aiInsight, setAiInsight] = useState<AiInsightResponse | null>(null);
    const [showAiBanner, setShowAiBanner] = useState(false);

    // Under-the-hood resolved tier (defaults to basic if not yet hydrated)
    const [userTier, setUserTier] = useState<{ tierSlug: AiTierSlug; tierName: string }>({
        tierSlug: 'basic',
        tierName: 'Basic',
    });

    const [isReportLoading, setIsReportLoading] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Initial load: Fetch branches & company information for PDF printing
    useEffect(() => {
        const loadInitialData = async () => {
            const [branchList, company] = await Promise.all([
                fetchBranchesList(),
                fetchCompanyPdfData(),
            ]);
            setBranches(branchList);
            setCompanyData(company);
        };
        loadInitialData();
    }, []);

    const loadReport = useCallback(async () => {
        setIsReportLoading(true);
        setErrorMessage(null);
        try {
            const data = await fetchSupplierPerformanceData(filter);
            setReportData(data);
            if (data.userTier) {
                setUserTier({
                    tierSlug: data.userTier.tierSlug,
                    tierName: data.userTier.tierName,
                });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error fetching report';
            setErrorMessage(msg);
        } finally {
            setIsReportLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        loadReport();
    }, []);

    // Handle user clicking 'Details >' on any supplier row
    const handleSelectSupplier = (supplier: SupplierSummaryRow) => {
        setSelectedSupplier(supplier);
        setIsDrawerOpen(true);
    };

    // Trigger AI Copilot analysis
    const handleRunAi = async () => {
        if (!reportData) return;
        setShowAiBanner(true);
        setIsAiLoading(true);
        setErrorMessage(null);
        try {
            const insights = await generateGeminiInsights(reportData, userTier.tierSlug);
            setAiInsight(insights);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to generate AI insights';
            setErrorMessage(msg);
        } finally {
            setIsAiLoading(false);
        }
    };

    // High-Fidelity Printable PDF Generation
    const handlePrint = () => {
        if (!reportData) return;

        const branchLabel = filter.branchId
            ? branches.find((b) => String(b.id) === String(filter.branchId))?.branch_name || 'Branch'
            : 'Consolidated (All Branches)';

        const html = generateSupplierPerformancePrintHtml(
            reportData.suppliers,
            reportData.kpis,
            filter,
            branchLabel,
            companyData
        );

        const printWin = window.open('', '_blank');
        if (printWin) {
            printWin.document.open();
            printWin.document.write(html);
            printWin.document.close();
        }
    };

    return (
        <div className="w-full space-y-4 px-2 sm:px-4 pb-6">
            {/* Filter Header with Search at Column 1 and Print / Export PDF */}
            <FilterHeader
                filter={filter}
                onFilterChange={setFilter}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onRefresh={loadReport}
                onToggleAi={handleRunAi}
                onPrint={handlePrint}
                isAiLoading={isAiLoading}
                isReportLoading={isReportLoading}
                branches={branches}
            />

            {/* AI Copilot Insights Banner */}
            {showAiBanner && (
                <AiInsightsPanel
                    aiInsight={aiInsight}
                    activeTier={userTier.tierSlug}
                    isAiLoading={isAiLoading}
                    onDismiss={() => setShowAiBanner(false)}
                />
            )}

            {/* Error Notification Banner */}
            {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300 rounded-lg text-xs font-medium">
                    {errorMessage}
                </div>
            )}

            {/* High-level KPI Scorecard Summary with Vibrant Theme Colors & Glow */}
            <SummaryCards kpis={reportData?.kpis || null} isLoading={isReportLoading} />

            {/* Main Scorecard Results Grid with Smart Active Sorting & Pagination */}
            <ResultsGrid
                suppliers={reportData?.suppliers || []}
                selectedSupplierId={selectedSupplier?.supplierId || null}
                onSelectSupplier={handleSelectSupplier}
                isLoading={isReportLoading}
                searchTerm={searchTerm}
            />

            {/* Option A: Slide-Over Detail Drawer */}
            <DetailDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                supplier={selectedSupplier}
            />
        </div>
    );
};
