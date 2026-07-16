"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useReceivingProductsManual } from "../providers/ReceivingProductsManualProvider";
import { receivedItemSerials } from "../utils/receivingManualView";

function statusBadgeClasses(status?: string) {
    const s = String(status || "").toUpperCase();
    if (s === "CLOSED" || s === "RECEIVED") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20";
    if (s === "PARTIAL") return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/20";
    return "bg-primary/15 text-primary border border-primary/20";
}

function receiptStatusBadgeClasses(status?: string) {
    const s = String(status || "ACTIVE").toUpperCase();
    if (s === "REVERTED") return "bg-red-100 text-red-700 border border-red-300 font-black";
    if (s === "POSTED") return "bg-primary/10 text-primary border border-primary/30 font-black";
    return "bg-amber-50 text-amber-700 border border-amber-200 font-black";
}

export function ReadonlyReceivingPODetails() {
    const { selectedPO } = useReceivingProductsManual();
    const [expandedItemId, setExpandedItemId] = React.useState<string | null>(null);

    const items = React.useMemo(() => {
        const allocs = Array.isArray(selectedPO?.allocations) ? selectedPO!.allocations : [];
        return allocs.flatMap((allocation) => {
            const branchName = allocation?.branch?.name || "Unassigned";
            return (Array.isArray(allocation?.items) ? allocation.items : []).map((item) => ({
                ...item,
                branchName,
            }));
        });
    }, [selectedPO]);

    const branchesLabel = React.useMemo(() => {
        const names = items.map((item) => item.branchName).filter(Boolean);
        return Array.from(new Set(names)).join(", ") || "—";
    }, [items]);

    const totalOrdered = items.reduce((sum, item) => sum + Number(item.expectedQty || 0), 0);
    const totalReceived = items.reduce((sum, item) => sum + Number(item.receivedQty || 0), 0);

    if (!selectedPO) return null;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-4">
                <Card className="p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-primary">Received PO Details</div>
                        <Badge variant="secondary" className={statusBadgeClasses(selectedPO.status)}>
                            {selectedPO.status}
                        </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                        <div className="text-slate-400 font-black uppercase tracking-widest text-[9px]">PO Number</div>
                        <div className="text-right font-bold text-slate-700 dark:text-slate-200">{selectedPO.poNumber}</div>

                        <div className="text-slate-400 font-black uppercase tracking-widest text-[9px]">Supplier</div>
                        <div className="text-right font-bold text-slate-700 dark:text-slate-200">{selectedPO.supplier?.name ?? "—"}</div>

                        <div className="text-slate-400 font-black uppercase tracking-widest text-[9px]">Delivery Branches</div>
                        <div className="text-right font-bold text-slate-700 dark:text-slate-200">{branchesLabel}</div>

                        <div className="text-slate-400 font-black uppercase tracking-widest text-[9px]">Receiving Progress</div>
                        <div className="text-right font-bold text-slate-700 dark:text-slate-200">
                            {totalReceived} / {totalOrdered}
                        </div>
                    </div>

                    <div className="mt-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        This purchase order is already received. Details are shown for review only.
                    </div>
                </Card>

                {selectedPO.history && selectedPO.history.length > 0 ? (
                    <Card className="p-4 border-primary/20 bg-primary/5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-primary">
                            Previous Receipts History
                        </div>
                        <div className="mt-3 space-y-2">
                            {selectedPO.history.map((historyItem) => (
                                <div
                                    key={historyItem.receiptNo}
                                    className="flex items-center justify-between gap-3 text-[10px] border-b border-primary/10 pb-2 last:border-0 last:pb-0"
                                >
                                    <div className="flex flex-col">
                                        <span className={cn("font-mono font-black", historyItem.isReverted ? "text-red-500 line-through" : "text-primary")}>
                                            {historyItem.receiptNo}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-500">
                                            {historyItem.receiptDate || "N/A"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-500">
                                            {historyItem.itemsCount} {historyItem.itemsCount === 1 ? "item" : "items"}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[9px] uppercase h-4 px-1 leading-none",
                                                receiptStatusBadgeClasses(historyItem.status)
                                            )}
                                        >
                                            {historyItem.status || (historyItem.isPosted ? "POSTED" : "ACTIVE")}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                ) : null}

                <Card className="p-4 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-primary">Received Items</div>
                    <div className="mt-3 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[9px] uppercase font-black">Item</TableHead>
                                    <TableHead className="text-[9px] uppercase font-black">Branch</TableHead>
                                    <TableHead className="text-[9px] uppercase font-black text-right">Received</TableHead>
                                    <TableHead className="text-[9px] uppercase font-black text-right">Ordered</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                                            No item details found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((item) => {
                                        const rowKey = `${item.id}-${item.branchName}`;
                                        const serials = receivedItemSerials(item, selectedPO.history);
                                        const isExpanded = expandedItemId === rowKey;

                                        return (
                                            <React.Fragment key={rowKey}>
                                                <TableRow
                                                    className={cn(serials.length > 0 && "cursor-pointer hover:bg-muted/40")}
                                                    onClick={() => {
                                                        if (serials.length === 0) return;
                                                        setExpandedItemId((current) => current === rowKey ? null : rowKey);
                                                    }}
                                                >
                                                    <TableCell className="py-2">
                                                        <div className="font-bold text-xs">{item.name}</div>
                                                        <div className="font-mono text-[9px] text-muted-foreground">{item.barcode}</div>
                                                        <div className="text-[9px] font-bold text-primary mt-0.5">
                                                            {serials.length > 0 ? `${serials.length} serial${serials.length === 1 ? "" : "s"}` : "No serials recorded"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs">{item.branchName}</TableCell>
                                                    <TableCell className="py-2 text-xs text-right font-bold">{Number(item.receivedQty || 0)}</TableCell>
                                                    <TableCell className="py-2 text-xs text-right">{Number(item.expectedQty || 0)}</TableCell>
                                                </TableRow>

                                                {isExpanded ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="bg-muted/30 p-3">
                                                            <div className="grid gap-2">
                                                                <div className="text-[9px] font-black uppercase tracking-widest text-primary">Serials</div>
                                                                <div className="rounded-lg border border-border bg-background overflow-hidden">
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow>
                                                                                <TableHead className="h-8 text-[9px] uppercase font-black">Serial No.</TableHead>
                                                                                <TableHead className="h-8 text-[9px] uppercase font-black">Tare</TableHead>
                                                                                <TableHead className="h-8 text-[9px] uppercase font-black">Expiry</TableHead>
                                                                                <TableHead className="h-8 text-[9px] uppercase font-black">Receipt</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {serials.map((serial) => (
                                                                                <TableRow key={`${serial.receiptNo}-${serial.sn}`}>
                                                                                    <TableCell className="py-2 font-mono text-xs font-bold">{serial.sn}</TableCell>
                                                                                    <TableCell className="py-2 text-xs">{serial.tareWeight || "—"}</TableCell>
                                                                                    <TableCell className="py-2 text-xs">{serial.expiryDate || "—"}</TableCell>
                                                                                    <TableCell className="py-2 font-mono text-xs">{serial.receiptNo || "—"}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : null}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
