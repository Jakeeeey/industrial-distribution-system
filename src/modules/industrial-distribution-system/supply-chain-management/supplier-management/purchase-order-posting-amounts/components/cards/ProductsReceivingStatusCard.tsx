"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { usePostingOfPo } from "../../providers/PostingOfPoProvider";

export function ProductsReceivingStatusCard() {
    const { selectedPO } = usePostingOfPo();

    const consolidatedItems = React.useMemo(() => {
        const allocs = Array.isArray(selectedPO?.allocations) ? selectedPO!.allocations : [];
        const itemsMap = new Map<string, {
            id: string;
            name: string;
            barcode: string;
            expectedQtyByBranch: Map<string, number>;
            receivedQty: number;
        }>();

        allocs.forEach(a => {
            const branchId = a.branch.id;
            a.items.forEach(it => {
                let existing = itemsMap.get(it.productId);
                if (!existing) {
                    existing = {
                        id: it.productId,
                        name: it.name,
                        barcode: it.barcode,
                        expectedQtyByBranch: new Map<string, number>(),
                        receivedQty: 0,
                    };
                    itemsMap.set(it.productId, existing);
                }
                
                existing.expectedQtyByBranch.set(branchId, Number(it.expectedQty || 0));
                existing.receivedQty += Number(it.receivedQty || 0);
            });
        });

        return Array.from(itemsMap.values()).map(it => {
            let totalExpected = 0;
            it.expectedQtyByBranch.forEach(qty => { totalExpected += qty; });
            return {
                id: it.id,
                name: it.name,
                barcode: it.barcode,
                expectedQty: totalExpected,
                receivedQty: it.receivedQty,
            };
        });
    }, [selectedPO]);

    return (
        <Card className="p-4 min-w-0">
            <div className="text-sm font-semibold">Products Receiving Status</div>
            <div className="text-xs text-muted-foreground">Overall progress</div>

            <div className="mt-3 rounded-lg border border-dashed">
                <ScrollArea className="h-72">
                    <div className="p-3 space-y-3">
                        {consolidatedItems.length === 0 ? (
                            <div className="py-8 text-center text-xs text-muted-foreground">
                                No receiving lines found.
                            </div>
                        ) : (
                            <div className="rounded-lg border p-3">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium">All Products</div>
                                    <Badge variant="outline">{consolidatedItems.length} items</Badge>
                                </div>

                                <div className="space-y-3">
                                    {consolidatedItems.map((it) => {
                                        const expected = it.expectedQty;
                                        const received = it.receivedQty;
                                        const ok = expected > 0 ? received >= expected : received > 0;

                                        return (
                                            <div key={it.id} className="flex items-start justify-between gap-3 text-xs">
                                                <div className="min-w-0">
                                                    <div className="font-medium text-wrap">{it.name}</div>
                                                    <div className="text-muted-foreground text-wrap">{it.barcode}</div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-2">
                                                    <Badge variant={ok ? "outline" : "secondary"}>
                                                        {received} / {expected}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </Card>
    );
}
