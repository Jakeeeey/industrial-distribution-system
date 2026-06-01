"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";
import type { CategoryGroup, ProductGroup } from "../type";
import { InventoryProductCard } from "./InventoryProductCard";

interface InventoryCategoryAccordionProps {
    categoryGroups: CategoryGroup[];
    onProductClick: (product: ProductGroup) => void;
}

export function InventoryCategoryAccordion({
    categoryGroups,
    onProductClick,
}: InventoryCategoryAccordionProps) {
    // Default all open
    const defaultValues = categoryGroups.map((_, i) => `cat-${i}`);

    return (
        <Accordion
            type="multiple"
            defaultValue={defaultValues}
            className="space-y-3"
        >
            {categoryGroups.map((cat, i) => (
                <AccordionItem
                    key={cat.categoryName}
                    value={`cat-${i}`}
                    id={`category-accordion-${i}`}
                    className="border rounded-xl overflow-hidden shadow-sm bg-card"
                >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="rounded-lg bg-primary/10 p-1.5 shrink-0">
                                <Layers className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="font-semibold text-sm truncate">
                                    {cat.categoryName}
                                </span>
                                <Badge variant="outline" className="shrink-0 text-xs">
                                    {cat.products.length} product{cat.products.length !== 1 ? "s" : ""}
                                </Badge>
                            </div>
                            {/* Summary pills */}
                            <div className="hidden sm:flex items-center gap-2 mr-2 shrink-0">
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                    {cat.totalFull.toLocaleString()} Full
                                </span>
                                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                                    {cat.totalEmpty.toLocaleString()} Empty
                                </span>
                            </div>
                        </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 pb-4">
                        <div className="pt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {cat.products.map((product) => (
                                <InventoryProductCard
                                    key={product.productId}
                                    product={product}
                                    onClick={onProductClick}
                                />
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
