"use client";

import { Badge } from "@/components/ui/badge";
import { Cylinder, ArrowRight } from "lucide-react";
import type { ProductGroup } from "../type";

interface InventoryProductCardProps {
    product: ProductGroup;
    onClick: (product: ProductGroup) => void;
}

export function InventoryProductCard({ product, onClick }: InventoryProductCardProps) {
    return (
        <button
            type="button"
            id={`product-card-${product.productId}`}
            onClick={() => onClick(product)}
            className="
                group relative w-full text-left rounded-xl cursor-pointer
                border-x border-t border-t-white/60 dark:border-t-white/10 border-border/70
                border-b-[5px] border-b-muted-foreground/30 dark:border-b-neutral-800
                bg-gradient-to-b from-card to-muted/40 p-4 
                shadow-md hover:shadow-lg
                hover:-translate-y-0.5 hover:border-b-[6px]
                active:translate-y-[3px] active:border-b-[2px] active:shadow-sm
                transition-all duration-150 ease-out
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
            "
        >
            {/* Header Section */}
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                    {/* Stamped Icon Container */}
                    <div className="
                        rounded-lg bg-primary/10 p-2 shrink-0 transition-transform duration-200 group-hover:scale-105
                        shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.3)]
                        border border-white/20 dark:border-white/5
                    ">
                        <Cylinder className="h-4 w-4 text-primary drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" />
                    </div>
                    <div className="min-w-0 flex flex-col justify-center">
                        <span className="font-bold text-[14px] leading-tight text-foreground truncate group-hover:text-primary transition-colors">
                            {product.productName}
                        </span>
                        <span className="text-xs text-muted-foreground truncate mt-0.5 font-semibold opacity-85">
                            {product.categoryName}
                        </span>
                    </div>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[11px] font-bold px-2 py-0.5 bg-muted/80 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-t border-t-white/20">
                    {product.totalCount} Units
                </Badge>
            </div>

            {/* Debossed Segmented Stock Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
                {/* Full Stock Container */}
                <div className="
                    flex flex-col justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/10 px-3 py-2
                    shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_2px_5px_rgba(0,0,0,0.25)]
                    transition-colors group-hover:bg-emerald-500/15
                ">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-extrabold mb-0.5 opacity-90">
                        Full
                    </span>
                    <span className="text-lg font-black tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight drop-shadow-[0_1px_0px_rgba(255,255,255,0.4)] dark:drop-shadow-none">
                        {product.fullCount.toLocaleString()}
                    </span>
                </div>
                
                {/* Empty Stock Container */}
                <div className="
                    flex flex-col justify-center rounded-lg bg-rose-500/10 border border-rose-500/10 px-3 py-2
                    shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_2px_5px_rgba(0,0,0,0.25)]
                    transition-colors group-hover:bg-rose-500/15
                ">
                    <span className="text-[10px] uppercase tracking-wider text-rose-700 dark:text-rose-400 font-extrabold mb-0.5 opacity-90">
                        Empty
                    </span>
                    <span className="text-lg font-black tabular-nums tracking-tight text-rose-600 dark:text-rose-400 leading-tight drop-shadow-[0_1px_0px_rgba(255,255,255,0.4)] dark:drop-shadow-none">
                        {product.emptyCount.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* Action Footer Indicator */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                <span className="text-[11px] text-muted-foreground font-semibold">
                    Total Volume: <span className="text-foreground font-black drop-shadow-sm">{product.totalCount.toLocaleString()}</span>
                </span>
                <span className="flex items-center text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                    View Details
                    <ArrowRight className="h-3 w-3 ml-1 -translate-x-1 opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100" />
                </span>
            </div>
        </button>
    );
}