"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useActivePickingContext } from "../providers/ActivePickingProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCcw, Search, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatToPHT } from "../../invoicing/utils/dateUtils";

// Simple inline debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export function ConsolidatorSidebar() {
    const { 
        pickings, 
        totalPickings,
        page,
        isLoadingPickings, 
        fetchPickings, 
        activePickingId, 
        fetchDetails,
        searchQuery,
        setSearchQuery
    } = useActivePickingContext();
    
    const [localSearch, setLocalSearch] = useState(searchQuery);
    const debouncedSearch = useDebounce(localSearch, 500);

    // Trigger server-side search when debounced value changes
    useEffect(() => {
        if (debouncedSearch !== searchQuery) {
            fetchPickings(1, "Picking", 1, debouncedSearch);
        }
    }, [debouncedSearch, fetchPickings, searchQuery]);

    const totalPages = Math.ceil(totalPickings / 10);

    return (
        <div className="flex flex-col h-full bg-card rounded-lg border shadow-sm w-full md:w-80 lg:w-96 overflow-hidden flex-shrink-0">
            <div className="p-4 border-b space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">Active Pickings</h2>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => fetchPickings(1, "Picking", page, localSearch)} 
                        disabled={isLoadingPickings}
                    >
                        <RefreshCcw className={cn("h-4 w-4", isLoadingPickings && "animate-spin")} />
                    </Button>
                </div>
                
                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 px-1">
                    <span>Division: 1</span>
                    <span>Status: Picking</span>
                </div>

                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search consolidator no..."
                        className="pl-8"
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                    />
                    {isLoadingPickings && localSearch && (
                        <div className="absolute right-2.5 top-2.5">
                            <RefreshCcw className="h-4 w-4 animate-spin text-muted-foreground/50" />
                        </div>
                    )}
                </div>
                
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Showing {pickings.length} of {totalPickings}</span>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6" 
                                disabled={page <= 1 || isLoadingPickings}
                                onClick={() => fetchPickings(1, "Picking", page - 1, localSearch)}
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </Button>
                            <span className="text-[10px] font-bold">{page} / {totalPages}</span>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6" 
                                disabled={page >= totalPages || isLoadingPickings}
                                onClick={() => fetchPickings(1, "Picking", page + 1, localSearch)}
                            >
                                <ChevronRight className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-2">
                    {isLoadingPickings && pickings.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground animate-pulse flex flex-col items-center gap-2">
                            <RefreshCcw className="h-6 w-6 animate-spin text-primary/40" />
                            <span>Searching records...</span>
                        </div>
                    ) : pickings.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground flex flex-col items-center gap-2">
                            <Search className="h-8 w-8 text-muted-foreground/20" />
                            <span>No pickings found matching "{localSearch}"</span>
                        </div>
                    ) : (
                        pickings.map((picking) => (
                            <Card 
                                key={picking.id}
                                className={cn(
                                    "p-3 cursor-pointer hover:border-primary transition-colors flex flex-col gap-2",
                                    activePickingId === picking.id ? "border-primary bg-primary/5 shadow-inner" : "border-border shadow-sm"
                                )}
                                onClick={() => fetchDetails(picking.id)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <Package className={cn("h-5 w-5", activePickingId === picking.id ? "text-primary" : "text-muted-foreground")} />
                                        <span className={cn("font-medium truncate", activePickingId === picking.id && "text-primary")} title={picking.consolidator_no}>
                                            {picking.consolidator_no}
                                        </span>
                                    </div>
                                    <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                                        {picking.status}
                                    </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground flex justify-between items-center border-t pt-2 mt-1">
                                    <span className="bg-muted px-1.5 py-0.5 rounded">Branch: {picking.branch_id}</span>
                                    <span className="font-mono">{picking.created_at ? formatToPHT(picking.created_at, "MMM dd, yyyy") : ''}</span>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
