// src/modules/.../purchase-order-creation-serial/components/RapidScanModal.tsx
// Purpose: Modal for rapid consecutive scanning. Auto-segregates serials to
//          the correct product line (matched by product_id from cylinder_assets).
// Revised: Works with SerialTaggingLine[] instead of SerialPOAllocation[].
//          Validates EMPTY status. Duplicates across POs allowed by design.

"use client";

import * as React from "react";
import { Scan, X, Trash2, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { SerialTaggingLine } from "../types/serial-po.types";

import { useSerialTaggingStore } from "../store/serialTaggingStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RapidScanModalProps {
    poId: number;
    open: boolean;
    onClose: () => void;
    lines: SerialTaggingLine[];
    onAddSerial: (lineId: number, serial: string) => void;
}

type ScannedItem = {
    serial: string;
    lineId: number | null;
    productName: string;
    branchName: string;
    status: "success" | "error";
    message: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RapidScanModal({ poId, open, onClose, lines, onAddSerial }: RapidScanModalProps) {
    const [inputValue, setInputValue] = React.useState("");
    const [isValidating, setIsValidating] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    // Use persistent store for scan logs
    const store = useSerialTaggingStore();
    const scannedList = store.rapidScanLogs[poId] || [];

    // Focus input on open
    React.useEffect(() => {
        if (open) {
            setInputValue("");
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [open]);

    // Flat list of active product lines that still need serials
    const activeLines = React.useMemo(() =>
        lines.map((l) => ({
            lineId: l.lineId,
            productId: l.productId,
            productName: l.productName,
            branchName: l.branchName,
            orderedQty: l.orderedQty,
            currentCount: l.savedSerials.length + l.draftSerials.length,
            allSerialNumbers: [
                ...l.savedSerials.map((s) => s.serial_number.toUpperCase()),
                ...l.draftSerials.map((s) => s.serial_number.toUpperCase()),
            ],
        })),
        [lines]
    );

    const handleScan = React.useCallback(async () => {
        const sn = inputValue.trim().toUpperCase();
        setInputValue("");
        if (!sn) return;

        if (activeLines.length === 0) {
            toast.error("No product lines found. Please close and check allocations.");
            return;
        }

        // Prevent re-processing a serial already successfully scanned this session
        if (scannedList.some((item) => item.serial === sn && item.status === "success")) {
            toast.warning(`Serial "${sn}" is already scanned.`);
            return;
        }

        setIsValidating(true);
        try {
            // 1. Look up in cylinder_assets
            const res = await fetch(
                `/api/ids/scm/supplier-management/purchase-order-creation-serial/cylinder-assets?serial_number=${encodeURIComponent(sn)}`
            );
            if (!res.ok) throw new Error("API failure during validation");
            const data = await res.json();

            if (!data.exists) {
                store.addRapidScanLog(poId, { serial: sn, lineId: null, productName: "Unknown", branchName: "—", status: "error", message: "Not registered in cylinder assets" });
                toast.error(`"${sn}" is not registered.`);
                return;
            }

            // 2. Must be EMPTY
            if (!data.is_empty) {
                const statusLabel = String(data.asset?.cylinder_status || "UNKNOWN");
                store.addRapidScanLog(poId, { serial: sn, lineId: null, productName: String(data.asset?.product_name || "—"), branchName: "—", status: "error", message: `Not EMPTY (${statusLabel})` });
                toast.error(`"${sn}" is not EMPTY.`);
                return;
            }

            const assetProductId = Number(data.asset?.product_id);
            const assetProductName = String(data.asset?.product_name || "Unknown");

            // 3. Find matching line by product_id that still has capacity
            const matchedLines = activeLines.filter((l) => l.productId === assetProductId);
            if (matchedLines.length === 0) {
                store.addRapidScanLog(poId, { serial: sn, lineId: null, productName: assetProductName, branchName: "—", status: "error", message: `Product "${assetProductName}" not in PO lines` });
                toast.error(`"${assetProductName}" is not in the PO lines.`);
                return;
            }

            // Prefer a line that still needs serials
            const target = matchedLines.find((l) => l.currentCount < l.orderedQty) ?? matchedLines[0];

            // Check for duplicates within this line
            if (target.allSerialNumbers.includes(sn)) {
                store.addRapidScanLog(poId, { serial: sn, lineId: target.lineId, productName: assetProductName, branchName: target.branchName, status: "error", message: `Already assigned to ${target.branchName}` });
                toast.warning(`"${sn}" is already assigned.`);
                return;
            }

            // 4. Success — add to draft
            onAddSerial(target.lineId, sn);
            store.addRapidScanLog(poId, {
                serial: sn, lineId: target.lineId, productName: assetProductName,
                branchName: target.branchName, status: "success",
                message: `→ ${target.branchName}`
            });
            toast.success(`Allocated "${sn}" → ${target.branchName} (${assetProductName})`);

        } catch (error) {
            console.error(error);
            toast.error("Validation failed. Please try again.");
        } finally {
            setIsValidating(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [inputValue, activeLines, scannedList, onAddSerial]);

    // Enter key trigger
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") { e.preventDefault(); handleScan(); }
    };

    // Auto-debounce on value change (500ms — for barcode scanners that don't send Enter)
    React.useEffect(() => {
        const val = inputValue.trim();
        if (!val) return;
        const timer = setTimeout(() => handleScan(), 500);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputValue]);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                showCloseButton={false}
                className="!max-w-[1000px] !w-[95vw] h-[90vh] max-h-[800px] p-0 bg-background rounded-2xl border-none shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header Banner */}
                <div className="p-4 sm:p-5 bg-primary text-primary-foreground relative shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/15 rounded-xl shrink-0">
                                <Scan className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-white">
                                    Rapid Scan Allocator
                                </DialogTitle>
                                <DialogDescription className="text-white/80 text-xs">
                                    Scan serials consecutively — auto-routes to matching product line.
                                </DialogDescription>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col md:flex-row">
                    {/* ── Left Column: Scanner & Log ── */}
                    <div className="flex-1 flex flex-col min-w-0 md:w-1/2 md:border-r border-border">
                        {/* Input Area */}
                        <div className="p-4 sm:p-5 border-b border-border bg-muted/20 space-y-3 shrink-0">

                            {activeLines.length === 0 ? (
                                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                                    <div className="text-xs">
                                        <p className="font-bold">No product lines available</p>
                                        <p className="mt-1 opacity-90">Close this modal and select a PO with product lines.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                        Scan barcode or type serial
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Input
                                                ref={inputRef}
                                                placeholder={isValidating ? "Validating..." : "Scan or type serial number..."}
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                disabled={isValidating}
                                                className="h-10 rounded-xl text-sm font-semibold"
                                            />
                                            {isValidating && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            onClick={handleScan}
                                            disabled={isValidating || !inputValue.trim()}
                                            className="h-10 px-5 rounded-xl font-bold shrink-0"
                                        >
                                            Verify
                                        </Button>
                                    </div>

                                    {/* Line capacity summary */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {activeLines.map((l) => {
                                            const done = l.currentCount >= l.orderedQty;
                                            return (
                                                <Badge
                                                    key={l.lineId}
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[9px] font-black",
                                                        done
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/20"
                                                            : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20"
                                                    )}
                                                >
                                                    {l.productName.split(" ").slice(0, 2).join(" ")} — {l.currentCount}/{l.orderedQty}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Scanned Log */}
                        <div className="p-4 sm:p-5 space-y-2 flex-1 overflow-hidden bg-background flex flex-col">
                            <div className="flex justify-between items-center shrink-0">
                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                    Scan Log
                                </span>
                                {scannedList.length > 0 && (
                                    <button
                                        onClick={() => store.clearRapidScanLogs(poId)}
                                        className="text-[10px] font-black uppercase text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Clear Log
                                    </button>
                                )}
                            </div>

                            <ScrollArea className="flex-1 min-h-0 border border-border rounded-xl bg-card shadow-inner">
                                {scannedList.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground/60 space-y-2">
                                        <Scan className="w-8 h-8 text-muted-foreground/45 stroke-[1.5]" />
                                        <span className="text-xs font-semibold">No scans yet</span>
                                    </div>
                                ) : (
                                    <div className="p-2 space-y-2">
                                        {scannedList.map((item, idx) => (
                                            <div
                                                key={`${item.serial}-${idx}`}
                                                className={cn(
                                                    "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all",
                                                    item.status === "success"
                                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                                        : "bg-red-500/5 border-red-500/20"
                                                )}
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold">{item.serial}</span>
                                                        <Badge
                                                            variant={item.status === "success" ? "default" : "destructive"}
                                                            className={cn(
                                                                "text-[9px] font-black h-4 px-1",
                                                                item.status === "success" && "bg-emerald-500 text-white"
                                                            )}
                                                        >
                                                            {item.status.toUpperCase()}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground font-medium">
                                                        {item.productName}
                                                    </p>
                                                </div>
                                                <div className="text-right text-[10px] font-bold">
                                                    {item.status === "success" ? (
                                                        <span className="text-emerald-600 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            {item.message}
                                                        </span>
                                                    ) : (
                                                        <span className="text-red-500 flex items-center gap-1 justify-end">
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                            {item.message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </div>


            {/* ── Right Column: Progress & Allocation ── */}
            <div className="flex-1 flex flex-col min-w-0 md:w-1/2 bg-muted/10 overflow-y-auto">
                <div className="p-4 sm:p-5 space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        Allocation Progress
                    </div>
                    
                    <div className="space-y-3">
                        {activeLines.map((l) => {
                            const done = l.currentCount >= l.orderedQty;
                            const progressPct = Math.min(100, (l.currentCount / l.orderedQty) * 100);
                            
                            return (
                                <div key={l.lineId} className="p-3 bg-background border border-border rounded-xl space-y-3 shadow-sm">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="min-w-0">
                                            <div className="font-bold text-sm text-foreground leading-tight">
                                                {l.productName}
                                            </div>
                                            <div className="text-[11px] font-semibold text-muted-foreground mt-1">
                                                {l.branchName}
                                            </div>
                                        </div>
                                        <Badge 
                                            variant={done ? "default" : "secondary"} 
                                            className={cn("shrink-0", done && "bg-emerald-500 text-white")}
                                        >
                                            {l.currentCount} / {l.orderedQty}
                                        </Badge>
                                    </div>
                                    
                                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className={cn("h-full transition-all duration-300", done ? "bg-emerald-500" : "bg-primary")} 
                                            style={{ width: `${progressPct}%` }} 
                                        />
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {l.allSerialNumbers.length === 0 ? (
                                            <span className="text-[10px] text-muted-foreground/60 italic font-medium">No serials scanned yet</span>
                                        ) : (
                                            l.allSerialNumbers.map(sn => (
                                                <Badge key={sn} variant="outline" className="text-[10px] font-mono font-bold bg-muted/30">
                                                    {sn}
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-border bg-card shrink-0">
                    <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">
                        Done Scanning
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── cn helper import ─────────────────────────────────────────────────────────
function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(" ");
}
