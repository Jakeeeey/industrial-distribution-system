"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useReceivingProductsManual } from "../providers/ReceivingProductsManualProvider";

export function RefillReceiptHistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const {
        selectedPO,
    } = useReceivingProductsManual();

    const receiptStatusBadgeClasses = (status?: string) => {
        const s = String(status || "ACTIVE").toUpperCase();
        if (s === "REVERTED") return "bg-slate-100 text-slate-600 border border-slate-300 font-black";
        if (s === "POSTED") return "bg-primary/10 text-primary border border-primary/30 font-black";
        return "bg-amber-50 text-amber-700 border border-amber-200 font-black";
    };

    const history = selectedPO?.history || [];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-xl bg-white dark:bg-slate-950">
                <DialogHeader>
                    <DialogTitle className="text-primary font-black uppercase tracking-widest text-sm flex items-center gap-2">
                        Receipt History
                        <Badge variant="secondary" className="bg-primary/10 text-primary">Refill PO</Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
                    {history.length === 0 ? (
                        <div className="text-center text-slate-500 font-bold text-xs py-8">
                            No receipts found for this Refill PO.
                        </div>
                    ) : (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        history.map((h: any) => (
                            <div key={h.receiptNo || "DRAFT"} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("font-mono font-black text-sm", h.isReverted ? "text-slate-400 line-through" : "text-primary")}>
                                            {h.receiptNo || "DRAFT"}
                                        </span>
                                        <Badge variant="outline" className={cn("text-[9px] uppercase h-4 px-1 leading-none", receiptStatusBadgeClasses(h.status))}>
                                            {h.status || (h.isPosted ? "POSTED" : "ACTIVE")}
                                        </Badge>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-2">
                                        <span>{h.receiptDate || "No Date"}</span>
                                        <span>•</span>
                                        <span>{h.itemsCount} {h.itemsCount === 1 ? "item" : "items"}</span>
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
