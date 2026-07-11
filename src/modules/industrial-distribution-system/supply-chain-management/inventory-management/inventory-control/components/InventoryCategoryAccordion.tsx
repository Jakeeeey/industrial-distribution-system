"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Layers, PackageX } from "lucide-react";
import type { CategoryGroup, ProductGroup } from "../type";
import { InventoryProductCard } from "./InventoryProductCard";

interface InventoryCategoryAccordionProps {
    categoryGroups: CategoryGroup[];
    onProductClick: (product: ProductGroup, filter?: "full" | "empty") => void;
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
            className="space-y-5"
        >
            {categoryGroups.map((cat, i) => (
                <AccordionItem
                    key={cat.categoryName}
                    value={`cat-${i}`}
                    id={`category-accordion-${i}`}
                    className="
                        overflow-hidden rounded-xl cursor-pointer
                        border-x border-t border-t-white/60 dark:border-t-white/10 border-border/70
                        border-b-[5px] border-b-muted-foreground/30 dark:border-b-neutral-800
                        bg-gradient-to-b from-card to-muted/20
                        shadow-md hover:shadow-lg hover:border-b-[6px] hover:-translate-y-0.5
                        transition-all duration-200 ease-out
                    "
                >
                    <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/40 transition-colors [&>svg]:ml-4 [&>svg]:text-muted-foreground/80">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 min-w-0 gap-2">
                            {/* Left Grouping: Icon, Name and Total count */}
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Debossed Icon Box */}
                                <div className="
                                    rounded-lg bg-primary/10 p-2 shrink-0
                                    shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.3)]
                                    border border-white/20 dark:border-white/5
                                ">
                                    <Layers className="h-4 w-4 text-primary drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" />
                                </div>
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="font-bold text-sm tracking-tight text-foreground truncate">
                                        {cat.categoryName}
                                    </span>
                                    <Badge variant="secondary" className="shrink-0 text-[11px] font-bold px-2 py-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-t border-t-white/20">
                                        {cat.products.length} {cat.products.length === 1 ? "item" : "items"}
                                    </Badge>
                                </div>
                            </div>

                            {/* Right Grouping: Counter-sunk Summary Status Metrics */}
                            <div className="flex items-center gap-2 mr-2 ml-11 sm:ml-0">
                                <span className="
                                    text-[10px] sm:text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 sm:px-2.5 py-0.5 rounded-full 
                                    border border-emerald-500/10 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.2)]
                                    drop-shadow-[0_0.5px_0px_rgba(255,255,255,0.4)] dark:drop-shadow-none
                                ">
                                    {cat.totalFull.toLocaleString()} Full
                                </span>
                                <span className="
                                    text-[10px] sm:text-[11px] font-extrabold text-rose-700 dark:text-rose-400 bg-rose-500/10 px-2 sm:px-2.5 py-0.5 rounded-full 
                                    border border-rose-500/10 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.2)]
                                    drop-shadow-[0_0.5px_0px_rgba(255,255,255,0.4)] dark:drop-shadow-none
                                ">
                                    {cat.totalEmpty.toLocaleString()} Empty
                                </span>
                            </div>
                        </div>
                    </AccordionTrigger>

                    <AccordionContent className="p-0 border-t border-border/40 bg-muted/10">
                        <div className="p-5">
                            {cat.products.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {cat.products.map((product) => (
                                        <InventoryProductCard
                                            key={product.productId}
                                            product={product}
                                            onClick={onProductClick}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="
                                    flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-xl bg-muted/30 border-border/80
                                    shadow-[inset_0_2px_6px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)]
                                ">
                                    <PackageX className="h-8 w-8 text-muted-foreground/50 mb-2 drop-shadow-sm" />
                                    <p className="text-xs font-semibold text-muted-foreground">No active assets detected inside this category segment.</p>
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}