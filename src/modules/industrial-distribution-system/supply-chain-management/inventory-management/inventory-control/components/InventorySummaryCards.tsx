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

const KPI_CARDS = (summary: InventorySummary) => [
    {
        id: "kpi-total-products",
        label: "Total Products",
        value: formatNumber(summary.totalProducts),
        icon: Package,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
    },
    {
        id: "kpi-total-full",
        label: "Total Full",
        value: formatNumber(summary.totalFull),
        icon: TrendingUp,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
    },
    {
        id: "kpi-total-empty",
        label: "Total Empty",
        value: formatNumber(summary.totalEmpty),
        icon: TrendingDown,
        color: "text-rose-500",
        bg: "bg-rose-500/10",
        border: "border-rose-500/20",
    },
    {
        id: "kpi-grand-total",
        label: "Grand Total",
        value: formatNumber(summary.grandTotal),
        icon: BarChart3,
        color: "text-violet-500",
        bg: "bg-violet-500/10",
        border: "border-violet-500/20",
    },
];

export function InventorySummaryCards({ summary }: InventorySummaryCardsProps) {
    const cards = KPI_CARDS(summary);

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((card) => {
                const Icon = card.icon;
                return (
                    <Card
                        key={card.id}
                        id={card.id}
                        className={`border ${card.border} transition-shadow hover:shadow-md`}
                    >
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className={`rounded-xl ${card.bg} p-2.5 shrink-0`}>
                                <Icon className={`h-5 w-5 ${card.color}`} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                                <p className={`text-2xl font-bold tabular-nums ${card.color}`}>
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
