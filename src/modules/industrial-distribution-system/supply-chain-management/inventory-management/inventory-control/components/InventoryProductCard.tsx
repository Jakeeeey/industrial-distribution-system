"use client";

import { Badge } from "@/components/ui/badge";
import { Cylinder } from "lucide-react";
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
            className="group w-full text-left rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-lg bg-primary/10 p-1.5 shrink-0">
                        <Cylinder className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                            {product.productName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {product.categoryName}
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                    {product.totalCount}
                </Badge>
            </div>

            {/* Counts */}
            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-emerald-500/10 px-2.5 py-2 text-center">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Full</p>
                    <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight">
                        {product.fullCount.toLocaleString()}
                    </p>
                </div>
                <div className="rounded-lg bg-rose-500/10 px-2.5 py-2 text-center">
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">Empty</p>
                    <p className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400 leading-tight">
                        {product.emptyCount.toLocaleString()}
                    </p>
                </div>
                <div className="rounded-lg bg-muted/60 px-2.5 py-2 text-center">
                    <p className="text-xs text-muted-foreground font-medium">Total</p>
                    <p className="text-lg font-bold tabular-nums text-foreground leading-tight">
                        {product.totalCount.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Click hint */}
            <p className="mt-3 text-xs text-muted-foreground/60 text-center group-hover:text-primary/60 transition-colors">
                Click to view details →
            </p>
        </button>
    );
}
