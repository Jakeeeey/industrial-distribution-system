"use client";

import React, { useState } from "react";
import { useActivePickingContext } from "../providers/ActivePickingProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCcw, Search, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatToPHT } from "../../invoicing/utils/dateUtils";

export function ConsolidatorSidebar() {
    const { 
        pickings, 
        totalPickings,
        page,
        setPage,
        isLoadingPickings, 
        fetchPickings, 
        activePickingId, 
        fetchDetails
    } = useActivePickingContext();
    const [searchQuery, setSearchQuery] = useState("");

    const filteredPickings = pickings.filter(p => 
        p.consolidator_no.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(totalPickings / 10);

    return (
        <div className="flex flex-col h-full bg-card rounded-lg border shadow-sm w-full md:w-80 lg:w-96 overflow-hidden flex-shrink-0">
            <div className="p-4 border-b space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">Active Pickings</h2>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => fetchPickings(1, "Picking", page)} 
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
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
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
                                onClick={() => fetchPickings(1, "Picking", page - 1)}
                            >
                                <ChevronLeft className="h-3 w-3" />
                            </Button>
                            <span className="text-[10px] font-bold">{page} / {totalPages}</span>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6" 
                                disabled={page >= totalPages || isLoadingPickings}
                                onClick={() => fetchPickings(1, "Picking", page + 1)}
                            >
                                <ChevronRight className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-2">
                    {isLoadingPickings ? (
                        <div className="text-center p-4 text-muted-foreground animate-pulse">Loading pickings...</div>
                    ) : filteredPickings.length === 0 ? (
                        <div className="text-center p-4 text-muted-foreground">No pickings found.</div>
                    ) : (
                        filteredPickings.map((picking) => (
                            <Card 
                                key={picking.id}
                                className={cn(
                                    "p-3 cursor-pointer hover:border-primary transition-colors flex flex-col gap-2",
                                    activePickingId === picking.id ? "border-primary bg-primary/5" : "border-border"
                                )}
                                onClick={() => fetchDetails(picking.id)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <Package className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-medium truncate" title={picking.consolidator_no}>
                                            {picking.consolidator_no}
                                        </span>
                                    </div>
                                    <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">
                                        {picking.status}
                                    </span>
                                </div>
                                <div className="text-xs text-muted-foreground flex justify-between">
                                    <span>Branch: {picking.branch_id}</span>
                                    <span>{picking.created_at ? formatToPHT(picking.created_at, "MMM dd, yyyy") : ''}</span>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
