/**
 * Summary KPI Metric Cards
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Revisions:
 * - Upgraded to vibrant theme colors and rich hover elevations
 * - Enterprise OTIF: Emerald theme with glowing hover lift
 * - Avg Rejection Rate: Amber theme with warning elevation
 * - High-Risk Vendors: Rose/Crimson theme with vivid counter
 * - RTS Events: Indigo/Blue theme with live pulse
 * - Zero dull gray hovers
 */

'use client';

import React from 'react';
import { ReportExecutiveKPIs } from '../types';
import { CheckCircle2, TrendingDown, Clock, ShieldAlert } from 'lucide-react';

interface SummaryCardsProps {
    kpis: ReportExecutiveKPIs | null;
    isLoading: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ kpis, isLoading }) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 bg-muted/40 animate-pulse rounded-2xl border border-border" />
                ))}
            </div>
        );
    }

    const otifRate = kpis?.averageOtifRate;
    const rejectionRate = kpis?.averageRejectionRate;
    const highRiskCount = kpis?.highRiskVendorsCount ?? 0;
    const rtsCount = kpis?.totalRtsReturns ?? 0;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Enterprise OTIF - Emerald Theme */}
            <div className="group relative bg-card border border-emerald-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/50 hover:ring-1 hover:ring-emerald-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Enterprise OTIF
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {otifRate !== null && otifRate !== undefined ? `${otifRate}%` : 'N/A'}
                    </span>
                    <span className="text-[11px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                        On-Time & In-Full
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Target benchmark: ≥ 85%</p>
            </div>

            {/* Rejection Rate - Amber Theme */}
            <div className="group relative bg-card border border-amber-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10 hover:border-amber-500/50 hover:ring-1 hover:ring-amber-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Avg Rejection Rate
                    </span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <TrendingDown className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {rejectionRate !== null && rejectionRate !== undefined ? `${rejectionRate}%` : '0.00%'}
                    </span>
                    <span className="text-[11px] font-medium text-amber-600/80 dark:text-amber-400/80">
                        Returned / Received
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Calculated via RTS documents</p>
            </div>

            {/* High-Risk Suppliers - Rose/Crimson Theme */}
            <div className="group relative bg-card border border-rose-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-rose-500/10 hover:border-rose-500/50 hover:ring-1 hover:ring-rose-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        High-Risk Vendors
                    </span>
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                        <ShieldAlert className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                        {highRiskCount}
                    </span>
                    <span className="text-[11px] font-medium text-rose-600/80 dark:text-rose-400/80">
                        Vendors Flagged
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Triggered by low OTIF or high defect</p>
            </div>

            {/* Return to Supplier Total - Indigo/Blue Theme */}
            <div className="group relative bg-card border border-blue-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/50 hover:ring-1 hover:ring-blue-500/30 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        RTS Events
                    </span>
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                        <Clock className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {rtsCount}
                    </span>
                    <span className="text-[11px] font-medium text-blue-600/80 dark:text-blue-400/80">
                        Posted Returns
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                    Freshness: {kpis?.dataFreshnessTimestamp ? new Date(kpis.dataFreshnessTimestamp).toLocaleTimeString() : 'Live'}
                </p>
            </div>
        </div>
    );
};
