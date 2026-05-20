// src/modules/financial-management/product-pricing-management/product-printables/components/PrintablesMatrixCatalog.tsx
"use client";

import React from "react";
import type { MatrixRow, PriceType, Unit } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTierLabel } from "../utils/constants";
import { Package, Tag, Box } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
    rows: MatrixRow[];
    loading: boolean;
    priceTypes: PriceType[];
    units: Unit[];
    usedUnitIds: Set<number>;
    selectedPriceTypeIds?: string[];
};

export default function PrintablesMatrixCatalog({ 
    rows, 
    loading, 
    priceTypes, 
    units, 
    usedUnitIds,
    selectedPriceTypeIds = []
}: Props) {
    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading catalog...</div>;
    if (rows.length === 0) return <div className="p-8 text-center text-muted-foreground">No products found.</div>;

    const visibleUnits = units.filter(u => usedUnitIds.has(Number(u.unit_id)));
    
    // Filter price types based on selection
    const activePriceTypes = priceTypes.filter(pt => {
        if (selectedPriceTypeIds.length === 0) return pt.sort != null && pt.sort <= 5; // Default to first 5
        return selectedPriceTypeIds.includes(String(pt.price_type_id));
    });

    const groupColors = [
        "bg-[#F3F4F6] text-[#374151]", // List Price (Gray)
        "bg-[#EAF4FF] text-[#1E4D8C]", // Group 1 (Blue)
        "bg-[#F0FFF4] text-[#1D5C2E]", // Group 2 (Green)
        "bg-[#FFF9E6] text-[#8C6D1E]", // Group 3 (Yellow)
        "bg-[#FFF5F5] text-[#8C1E1E]", // Group 4 (Red)
        "bg-[#F7F0FF] text-[#4D1E8C]", // Group 5 (Purple)
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {rows.map((row) => {
                // Check if this row has any prices to show
                const hasAnyPrices = visibleUnits.some(u => {
                    const variant = row.variantsByUnitId[Number(u.unit_id)];
                    if (!variant) return false;
                    return activePriceTypes.some((pt, i) => {
                        const nonSyntheticIndex = activePriceTypes.slice(0, i).filter(p => p.price_type_id !== -1).length;
                        const ptSuffix = pt.price_type_id === -1 ? "ListPrice" : (["A", "B", "C", "D", "E"][nonSyntheticIndex] || "A");
                        return (variant.tiers as Record<string, number | null>)?.[ptSuffix] != null;
                    });
                });

                if (!hasAnyPrices) return null;

                return (
                    <Card key={row.group_id} className="overflow-hidden hover:shadow-md transition-all duration-200 border-[#D1D5DB] flex flex-col group">
                        <div className="h-28 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center border-b border-border/50 group-hover:from-muted group-hover:to-muted/80 transition-colors">
                            <Package className="w-10 h-10 text-muted-foreground/40" />
                        </div>
                        <CardHeader className="p-4 pb-2 space-y-2">
                            <div className="flex flex-wrap gap-1.5 mb-1">
                                {row.brand_name && row.brand_name !== "—" && (
                                    <Badge variant="secondary" className="text-[10px] uppercase font-medium bg-secondary/50 text-secondary-foreground flex items-center gap-1 px-1.5">
                                        <Tag className="w-3 h-3" />
                                        {row.brand_name}
                                    </Badge>
                                )}
                                {row.category_name && row.category_name !== "—" && (
                                    <Badge variant="outline" className="text-[10px] uppercase font-medium text-muted-foreground border-border/50 px-1.5">
                                        {row.category_name}
                                    </Badge>
                                )}
                            </div>
                            <CardTitle className="text-[15px] font-bold leading-tight line-clamp-2" title={row.display.product_name || ""}>
                                {row.display.product_name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 flex-grow flex flex-col justify-end">
                            <div className="mt-2 space-y-3">
                                {visibleUnits.map(u => {
                                    const variant = row.variantsByUnitId[Number(u.unit_id)];
                                    if (!variant) return null;

                                    const hasAnyPriceForUnit = activePriceTypes.some((pt, i) => {
                                        const nonSyntheticIndex = activePriceTypes.slice(0, i).filter(p => p.price_type_id !== -1).length;
                                        const ptSuffix = pt.price_type_id === -1 ? "ListPrice" : (["A", "B", "C", "D", "E"][nonSyntheticIndex] || "A");
                                        return (variant.tiers as Record<string, number | null>)?.[ptSuffix] != null;
                                    });

                                    if (!hasAnyPriceForUnit) return null;

                                    return (
                                        <div key={u.unit_id} className="rounded-lg border border-border/50 bg-card overflow-hidden text-sm">
                                            {visibleUnits.length > 1 && (
                                                <div className="bg-muted/30 px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 border-b border-border/50 text-muted-foreground uppercase tracking-wider">
                                                    <Box className="w-3 h-3" />
                                                    {u.unit_name} ({u.unit_shortcut})
                                                </div>
                                            )}
                                            <div className="divide-y divide-border/50">
                                                {activePriceTypes.map((pt, i) => {
                                                    const nonSyntheticIndex = activePriceTypes.slice(0, i).filter(p => p.price_type_id !== -1).length;
                                                    const ptSuffix = pt.price_type_id === -1 ? "ListPrice" : (["A", "B", "C", "D", "E"][nonSyntheticIndex] || "A");
                                                    const price = (variant.tiers as Record<string, number | null>)?.[ptSuffix];

                                                    if (price == null) return null;

                                                    return (
                                                        <div key={pt.price_type_id} className="flex justify-between items-center px-3 py-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn("w-2 h-2 rounded-full", groupColors[i % groupColors.length].split(" ")[0])} />
                                                                <span className="text-muted-foreground text-[11px] font-medium">{getTierLabel(pt.price_type_name)}</span>
                                                            </div>
                                                            <span className="font-mono font-semibold text-foreground text-xs">
                                                                {price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
