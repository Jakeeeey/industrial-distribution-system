/**
 * Visual Graphics Component for Supplier Performance AI Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements 2 Visual Graphics matching Metric Card UI/elevation:
 * 1. Supplier Reliability & Quality Benchmark (OTIF % vs. Rejection Rate % by Top Vendors)
 * 2. Vendor Risk Portfolio Distribution (Donut Chart: High / Medium / Low Risk breakdown)
 *
 * Visual Theme:
 * - Emerald (#10b981) for OTIF & Low Risk
 * - Rose (#f43f5e) for Rejection Rate & High Risk
 * - Amber (#f59e0b) for Medium Risk
 * - Hover elevations: hover:-translate-y-1 hover:shadow-lg transition-all duration-300
 * - Light and Dark theme high-contrast support
 */

'use client';

import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
    CartesianGrid,
    type TooltipProps,
} from 'recharts';
import { BarChart3, PieChart as PieIcon, ShieldAlert, Award } from 'lucide-react';
import { SupplierSummaryRow, ReportExecutiveKPIs } from '../types';

interface SupplierPerformanceChartsProps {
    suppliers: SupplierSummaryRow[];
    kpis: ReportExecutiveKPIs | null;
    isLoading?: boolean;
}

/**
 * Custom High-Contrast Theme-Aware Tooltip for Bar Chart
 */
function CustomBarTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="rounded-xl border border-border/80 bg-background/95 dark:bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md text-foreground text-xs space-y-2 min-w-[200px] z-50">
            {label && (
                <div className="font-bold text-foreground pb-1.5 border-b border-border/60 text-[12px] truncate max-w-[240px]">
                    {label}
                </div>
            )}
            <div className="space-y-1.5 pt-0.5">
                {payload.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
                            <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: item.color || item.fill }}
                            />
                            <span>{item.name}:</span>
                        </span>
                        <span className="font-bold text-foreground text-[11px] tabular-nums">
                            {Number(item.value ?? 0).toFixed(1)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Custom Tooltip for Risk Distribution Donut Chart
 */
function CustomPieTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];

    return (
        <div className="rounded-xl border border-border/80 bg-background/95 dark:bg-zinc-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-md text-foreground text-xs space-y-1.5 min-w-[140px] z-50">
            <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.payload?.fill || '#6366f1' }}
                />
                <span className="font-bold text-foreground text-[12px]">{item.name}</span>
            </div>
            <div className="text-muted-foreground text-[11px] flex justify-between gap-4 font-medium">
                <span>Active Vendors:</span>
                <span className="font-bold text-foreground tabular-nums">{item.value}</span>
            </div>
        </div>
    );
}

export const SupplierPerformanceCharts: React.FC<SupplierPerformanceChartsProps> = ({
    suppliers,
    kpis,
    isLoading = false,
}) => {
    // Top 6 active suppliers by order volume
    const barData = useMemo(() => {
        if (!suppliers || suppliers.length === 0) return [];
        return [...suppliers]
            .filter((s) => s.totalOrdersDue > 0)
            .sort((a, b) => b.totalOrdersDue - a.totalOrdersDue)
            .slice(0, 6)
            .map((s) => ({
                name: s.supplierName.length > 14 ? `${s.supplierName.substring(0, 14)}...` : s.supplierName,
                fullName: s.supplierName,
                otif: Number((s.otifPercentage ?? 0).toFixed(1)),
                rejection: Number((s.rejectionRatePercentage ?? 0).toFixed(1)),
                ordersDue: s.totalOrdersDue,
            }));
    }, [suppliers]);

    // Risk portfolio counts
    const pieData = useMemo(() => {
        if (!suppliers || suppliers.length === 0) return [];
        let high = 0;
        let med = 0;
        let low = 0;

        suppliers.forEach((s) => {
            if (s.riskLevel === 'HIGH') high++;
            else if (s.riskLevel === 'MEDIUM') med++;
            else low++;
        });

        return [
            { name: 'High Risk', value: high, fill: '#f43f5e' }, // Rose
            { name: 'Medium Risk', value: med, fill: '#f59e0b' }, // Amber
            { name: 'Low Risk', value: low, fill: '#10b981' }, // Emerald
        ].filter((d) => d.value > 0);
    }, [suppliers]);

    const totalVendors = suppliers?.length || 0;

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 h-80 rounded-2xl border border-border bg-card/40 animate-pulse" />
                <div className="lg:col-span-5 h-80 rounded-2xl border border-border bg-card/40 animate-pulse" />
            </div>
        );
    }

    // Do not show empty frame if no active suppliers exist
    if (!suppliers || suppliers.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Chart 1: Grouped Bar Chart (OTIF % vs. Rejection Rate %) */}
            <div className="group relative lg:col-span-7 bg-card border border-indigo-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-500/50 hover:ring-1 hover:ring-indigo-500/30 overflow-hidden flex flex-col justify-between">
                {/* Top vibrant gradient strip matching metric cards */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center justify-between mb-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                <BarChart3 className="h-4 w-4" />
                            </div>
                            <h3 className="text-sm font-bold text-foreground">
                                Fulfillment vs. Defect Rate
                            </h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Top suppliers ranked by order volume: OTIF compliance vs. RTS rejection %
                        </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                        Top {barData.length} Vendors
                    </span>
                </div>

                <div className="h-60 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={barData}
                            margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                            barGap={4}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: 'currentColor' }}
                                tickLine={false}
                                axisLine={{ opacity: 0.2 }}
                                interval={0}
                                angle={-15}
                                textAnchor="end"
                                className="text-muted-foreground"
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: 'currentColor' }}
                                tickLine={false}
                                axisLine={{ opacity: 0.2 }}
                                tickFormatter={(val) => `${val}%`}
                                domain={[0, 'auto']}
                                className="text-muted-foreground"
                            />
                            {/* cursor={{ fill: 'hsl(var(--muted) / 0.15)', radius: 6 }} removes the harsh gray bar hover box */}
                            <Tooltip
                                content={<CustomBarTooltip />}
                                cursor={{ fill: 'hsl(var(--muted) / 0.15)', radius: 6 }}
                            />
                            <Legend
                                verticalAlign="top"
                                align="right"
                                iconType="circle"
                                iconSize={8}
                                wrapperStyle={{ paddingBottom: '8px', fontSize: '11px' }}
                            />
                            <Bar
                                dataKey="otif"
                                name="OTIF Fulfillment %"
                                fill="#10b981"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={28}
                            />
                            <Bar
                                dataKey="rejection"
                                name="Rejection Rate %"
                                fill="#f43f5e"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={28}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 2: Vendor Risk Portfolio Donut Chart */}
            <div className="group relative lg:col-span-5 bg-card border border-rose-500/20 rounded-2xl p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-rose-500/10 hover:border-rose-500/50 hover:ring-1 hover:ring-rose-500/30 overflow-hidden flex flex-col justify-between">
                {/* Top vibrant gradient strip matching metric cards */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 opacity-80 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center justify-between mb-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                                <PieIcon className="h-4 w-4" />
                            </div>
                            <h3 className="text-sm font-bold text-foreground">
                                Vendor Risk Portfolio
                            </h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Automated risk rating distribution across active suppliers
                        </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                        {totalVendors} Active
                    </span>
                </div>

                <div className="relative h-60 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip content={<CustomPieTooltip />} />
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={4}
                                dataKey="value"
                                stroke="none"
                                isAnimationActive={false}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.fill}
                                        stroke="none"
                                        style={{ outline: 'none' }}
                                    />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>

                    {/* Inner Donut Center Label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-foreground tracking-tight">
                            {totalVendors}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Suppliers
                        </span>
                    </div>
                </div>

                {/* Risk Distribution Pills Legend */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center">
                    <div className="flex flex-col items-center p-1 rounded-lg bg-rose-500/5 border border-rose-500/20">
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">High</span>
                        <span className="text-xs font-black text-foreground">
                            {pieData.find((d) => d.name === 'High Risk')?.value || 0}
                        </span>
                    </div>
                    <div className="flex flex-col items-center p-1 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Medium</span>
                        <span className="text-xs font-black text-foreground">
                            {pieData.find((d) => d.name === 'Medium Risk')?.value || 0}
                        </span>
                    </div>
                    <div className="flex flex-col items-center p-1 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Low</span>
                        <span className="text-xs font-black text-foreground">
                            {pieData.find((d) => d.name === 'Low Risk')?.value || 0}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

