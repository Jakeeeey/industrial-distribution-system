"use client";
// TaggedSerialsModal.tsx
// Shows pre-tagged serials from purchase_order_serial compared with current scanned serials.

import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Tag, X, CheckCircle2, AlertCircle, HelpCircle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = "/api/ids/scm/supplier-management/purchase-order-receiving-manual";

interface TaggedSerial {
    id: number;
    serial_number: string;
    product_id: number;
}

interface TaggedSerialsModalProps {
    open: boolean;
    onClose: () => void;
    porId: string;          // purchase_order_product_id (the POR row id)
    productName: string;
    expectedQty: number;
    scannedSerials?: Array<{ sn: string; isNew?: boolean }>; // Serials scanned during the current session
    onRemoveSerial?: (serial: string) => void;
}

export function TaggedSerialsModal({ open, onClose, porId, productName, expectedQty, scannedSerials = [], onRemoveSerial }: TaggedSerialsModalProps) {
    const [loading, setLoading] = React.useState(false);
    const [serials, setSerials] = React.useState<TaggedSerial[]>([]);
    const [error, setError] = React.useState("");

    // Fetch tagged serials when modal opens
    React.useEffect(() => {
        if (!open || !porId) return;
        setSerials([]);
        setError("");
        setLoading(true);

        fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get_tagged_serials", porId }),
        })
            .then(r => r.json())
            .then(j => {
                if (j?.error) throw new Error(j.error);
                setSerials(Array.isArray(j?.data) ? j.data : []);
            })
            .catch(e => setError((e as Error).message))
            .finally(() => setLoading(false));
    }, [open, porId]);

    // Removed unused comparisonList definition to resolve lint error - AG 2026-06-26

    const expectedCount = expectedQty;
    const scannedCount = scannedSerials.length;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                showCloseButton={false}
                className="!max-w-[950px] !w-[95vw] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-background"
                onPointerDownOutside={() => onClose()}
            >
                {/* Primary header matching standard PO workbench */}
                <div className="relative bg-primary p-6 text-white overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="relative z-10 flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                    <Tag className="w-4 h-4 text-white" />
                                </div>
                                <DialogTitle className="text-lg font-black uppercase tracking-tight m-0">
                                    Cylinder Verification
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-[10px] font-bold text-white/75 uppercase tracking-widest mt-1.5 m-0 truncate max-w-[400px]">
                                {productName}
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <Badge variant="outline" className="font-mono text-xs font-black border-white/40 text-white bg-white/15 px-3 py-1">
                                {scannedCount} / {expectedCount} Scanned
                            </Badge>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-xs font-bold uppercase tracking-widest">Loading serials...</span>
                        </div>
                    ) : error ? (
                        <div className="py-8 text-center text-xs font-bold text-red-500">{error}</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* Left Column: Expected pre-tagged serials from DB */}
                            <div className="flex flex-col gap-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                                    Expected Cylinders ({serials.length})
                                </div>
                                <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden h-[400px] overflow-y-auto scrollbar-thin bg-slate-50/30 dark:bg-slate-900/5 p-3 space-y-2.5 shadow-inner">
                                    {serials.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400 italic text-[11px]">
                                            No expected pre-tagged serials for this item.
                                        </div>
                                    ) : (
                                        serials.map((item, idx) => {
                                            const matched = scannedSerials.some(s => s.sn.toUpperCase() === item.serial_number.toUpperCase());
                                            return (
                                                <div
                                                    key={`${item.serial_number}-${idx}`}
                                                    className={cn(
                                                        "flex items-center justify-between px-4 py-2 h-[54px] border-2 rounded-xl transition-all duration-200",
                                                        matched 
                                                            ? "bg-emerald-500/5 border-emerald-500/25 border-l-4 border-l-emerald-500" 
                                                            : "bg-background border-slate-200/60 dark:border-slate-800 border-l-4 border-l-slate-300 dark:border-l-slate-700"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {matched ? (
                                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                                        ) : (
                                                            <AlertCircle className="w-5 h-5 text-slate-400 shrink-0" />
                                                        )}
                                                        <span className={cn(
                                                            "font-mono font-extrabold uppercase tracking-wide truncate text-sm sm:text-base text-slate-800 dark:text-slate-200",
                                                            !matched && "text-slate-500"
                                                        )}>
                                                            {item.serial_number}
                                                        </span>
                                                    </div>
                                                    <Badge
                                                        className={cn(
                                                            "text-[9px] font-black uppercase border-none px-2.5 py-1 shrink-0 h-5.5 leading-none",
                                                            matched 
                                                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" 
                                                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                                        )}
                                                    >
                                                        {matched ? "Matched" : "Pending"}
                                                    </Badge>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Scanned serials in this session */}
                            <div className="flex flex-col gap-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                                    Scanned Now ({scannedSerials.length})
                                </div>
                                <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden h-[400px] overflow-y-auto scrollbar-thin bg-slate-50/30 dark:bg-slate-900/5 p-3 space-y-2.5 shadow-inner">
                                    {scannedSerials.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400 italic text-[11px]">
                                            No cylinders scanned yet.
                                        </div>
                                    ) : (
                                        scannedSerials.map((item, idx) => {
                                            const isPreTagged = serials.some(s => s.serial_number.toUpperCase() === item.sn.toUpperCase());
                                            const isNew = !!item.isNew;
                                            const status = isNew ? "new" : (isPreTagged ? "matched" : "extra");

                                            return (
                                                <div
                                                    key={`${item.sn}-${idx}`}
                                                    className={cn(
                                                        "flex items-center justify-between px-4 py-2 h-[54px] border-2 rounded-xl transition-all duration-200",
                                                        status === "matched"
                                                            ? "bg-emerald-500/5 border-emerald-500/25 border-l-4 border-l-emerald-500"
                                                            : status === "new"
                                                                ? "bg-blue-500/5 border-blue-500/25 border-l-4 border-l-blue-500"
                                                                : "bg-indigo-500/5 border-indigo-500/25 border-l-4 border-l-indigo-500"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {status === "matched" && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                                                        {status === "new" && <Plus className="w-5 h-5 text-blue-500 shrink-0" />}
                                                        {status === "extra" && <HelpCircle className="w-5 h-5 text-indigo-500 shrink-0" />}
                                                        <span className="font-mono font-extrabold uppercase tracking-wide truncate text-sm sm:text-base text-slate-800 dark:text-slate-200">
                                                            {item.sn}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Badge
                                                            className={cn(
                                                                "text-[9px] font-black uppercase border-none px-2.5 py-1 h-5.5 leading-none",
                                                                status === "matched"
                                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                                    : status === "new"
                                                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                                                                        : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                                                            )}
                                                        >
                                                            {status === "matched" && "Matched"}
                                                            {status === "new" && "New"}
                                                            {status === "extra" && "Extra"}
                                                        </Badge>
                                                        {onRemoveSerial && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all shrink-0"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm(`Are you sure you want to remove serial "${item.sn}"?`)) {
                                                                        onRemoveSerial(item.sn);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <Button
                            onClick={onClose}
                            className="rounded-xl font-black uppercase tracking-widest text-[10px] h-11 px-8 bg-primary hover:bg-primary/95 text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                        >
                            Close Dialog
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
