"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Package, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import type { InventorySummary } from "../type";

interface InventorySummaryCardsProps {
    summary: InventorySummary;
}

function formatNumber(n: number): string {
    return n.toLocaleString();
}

// ─── 3D Configuration Data ────────────────────────────────────────────────
const KPI_CARDS = (summary: InventorySummary) => [
    {
        id: "kpi-total-products",
        label: "Total Products",
        value: formatNumber(summary.totalProducts),
        icon: Package,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-500/20",
        borderBottom: "border-b-blue-500 dark:border-b-blue-700",
        glow: "group-hover:shadow-blue-500/25",
    },
    {
        id: "kpi-total-full",
        label: "Total Full",
        value: formatNumber(summary.totalFull),
        icon: TrendingUp,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        borderBottom: "border-b-emerald-500 dark:border-b-emerald-700",
        glow: "group-hover:shadow-emerald-500/25",
    },
    {
        id: "kpi-total-empty",
        label: "Total Empty",
        value: formatNumber(summary.totalEmpty),
        icon: TrendingDown,
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-100 dark:bg-rose-500/20",
        borderBottom: "border-b-red-500 dark:border-b-red-700",
        glow: "group-hover:shadow-red-500/25",
    },
    {
        id: "kpi-grand-total",
        label: "Grand Total",
        value: formatNumber(summary.grandTotal),
        icon: BarChart3,
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-100 dark:bg-violet-500/20",
        borderBottom: "border-b-violet-500 dark:border-b-violet-700",
        glow: "group-hover:shadow-violet-500/25",
    },
];

// ─── Main Component ───────────────────────────────────────────────────────
export function InventorySummaryCards({ summary }: InventorySummaryCardsProps) {
    const cards = KPI_CARDS(summary);

    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cards.map((card) => {
                const Icon = card.icon;
                return (
                    <Card 
                        key={card.id}
                        id={card.id}
                        className={`
                            group relative overflow-hidden
                            border-x border-t border-t-white/60 dark:border-t-white/10
                            border-b-[6px] ${card.borderBottom}
                            bg-gradient-to-b from-card to-muted/30
                            shadow-md hover:shadow-xl ${card.glow}
                            hover:-translate-y-1 
                            active:translate-y-1 active:border-b-[2px] active:shadow-sm
                            transition-all duration-200 ease-out
                            cursor-pointer
                        `}
                    >
                        {/* Ambient colored background glow on hover */}
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.03] dark:group-hover:opacity-10 transition-opacity duration-300 bg-current ${card.color}`} />

                        <CardContent className="relative flex items-center gap-4 p-5">
                            {/* 3D Icon Container (Inset Shadow for depth) */}
                            <div className={`
                                rounded-xl ${card.bg} p-3 shrink-0 
                                shadow-[inset_0_2px_5px_rgba(0,0,0,0.15)] 
                                dark:shadow-[inset_0_2px_5px_rgba(0,0,0,0.4)]
                                border border-white/50 dark:border-white/5
                                group-hover:scale-110 transition-transform duration-300 ease-out
                            `}>
                                <Icon className={`h-6 w-6 ${card.color} drop-shadow-sm`} />
                            </div>

                            <div className="min-w-0 flex flex-col justify-center">
                                <p className="text-[11px] font-bold text-muted-foreground truncate uppercase tracking-wider mb-0.5">
                                    {card.label}
                                </p>
                                <p className={`text-3xl font-black tabular-nums tracking-tight ${card.color} drop-shadow-sm`}>
                                    {card.value}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}