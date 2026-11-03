"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QrCode, Plus, Trash2, Lock, Unlock } from "lucide-react";

export interface TempSerialItem {
    sn: string;
    tareWeight: string;
    expiryDate: string;
    isSaved?: boolean;
    isNew?: boolean;
}

interface SerialRegistrationModalProps {
    open: boolean;
    onClose: () => void;
    productName: string;
    orderedLimit: number;
    tempSerials: TempSerialItem[];
    onAddSerial: (sn: string, tare: string, expiry: string) => Promise<boolean | void>;
    onRemoveSerial: (index: number) => Promise<void>;
    onClearAllSerials: () => Promise<void>;
    onCommitPieces: () => Promise<void>;
    verifyingSerial: boolean;
    committingSerials: boolean;
    highlightNewSerialFields: boolean;
}

export function SerialRegistrationModal({
    open,
    onClose,
    productName,
    orderedLimit,
    tempSerials,
    onAddSerial,
    onRemoveSerial,
    onClearAllSerials,
    onCommitPieces,
    verifyingSerial,
    committingSerials,
    highlightNewSerialFields,
}: SerialRegistrationModalProps) {
    // Developer comment: Sticky lock state defaults to true to preserve calibrated Tare & Expiry across piece scans
    const [isLocked, setIsLocked] = React.useState<boolean>(true);
    const [tareWeight, setTareWeight] = React.useState<string>("");
    const [expiryDate, setExpiryDate] = React.useState<string>("");
    const [serialInput, setSerialInput] = React.useState<string>("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Auto-focus barcode input when modal opens or after piece registration
    React.useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const handleAdd = async () => {
        const val = serialInput.trim();
        if (!val) return;
        const success = await onAddSerial(val, tareWeight, expiryDate);
        if (success !== false) {
            setSerialInput("");
            setTimeout(() => inputRef.current?.focus(), 20);
        }
    };

    const isPendingValid = serialInput.trim() !== "";

    return (
        <DialogPrimitive.Root open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogPrimitive.Portal>
                {/* Backdrop Overlay */}
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

                {/* Local Dialog Content Container: tailored width & max-height with zero vertical screen overflow */}
                <DialogPrimitive.Content
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => {
                        if (tempSerials.length > 0 || serialInput.trim()) e.preventDefault();
                    }}
                    className={cn(
                        "fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-50",
                        "w-[95vw] max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden",
                        "rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-950 outline-none",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                    )}
                >
                    {/* 1. Pinned Header Banner */}
                    <div className="shrink-0 bg-primary p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                        <div className="relative z-10 flex items-center justify-between gap-4">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-xs">
                                        <QrCode className="w-5 h-5 text-white" />
                                    </div>
                                    <DialogPrimitive.Title className="text-xl font-black uppercase tracking-tight text-white m-0">
                                        Serial Registration
                                    </DialogPrimitive.Title>
                                </div>
                                <DialogPrimitive.Description className="text-[10px] font-bold text-white/70 uppercase tracking-widest m-0">
                                    Piece-by-Piece Inventory Tracking
                                </DialogPrimitive.Description>
                            </div>
                            <Badge variant="outline" className={cn(
                                "border-white/40 text-white font-mono bg-white/10 px-3.5 py-1 text-xs shrink-0 font-bold",
                                tempSerials.length > orderedLimit ? "bg-red-500/80 border-red-300" :
                                tempSerials.length === orderedLimit && orderedLimit > 0 ? "bg-emerald-500/30 border-emerald-300" : ""
                            )}>
                                {tempSerials.length} / {orderedLimit === Infinity ? "—" : orderedLimit} REGISTERED {tempSerials.length > orderedLimit && "(OVER)"}
                            </Badge>
                        </div>
                    </div>

                    {/* 2. Scrollable Modal Content Body */}
                    <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
                        {/* Current Product Info & Limit Summary */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">Current Product</span>
                                <span className="text-base font-bold text-slate-900 dark:text-white truncate">{productName}</span>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none text-right">Items Limit</span>
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                    {orderedLimit === Infinity ? "Open Balance" : `${orderedLimit} Units`}
                                </span>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        {orderedLimit !== Infinity && orderedLimit > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-end text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    <span>Registration Progress</span>
                                    <span className={tempSerials.length > orderedLimit ? "text-red-500 font-bold" : tempSerials.length === orderedLimit ? "text-emerald-500 font-bold" : "text-primary font-bold"}>
                                        {((tempSerials.length / orderedLimit) * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-all duration-500 ease-out",
                                            tempSerials.length > orderedLimit ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
                                            tempSerials.length === orderedLimit ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-primary"
                                        )}
                                        style={{ width: `${Math.min(100, (tempSerials.length / orderedLimit) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Developer comment: Batch calibration section - pure scan workflow with true readOnly lock, no clutter badges */}
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Batch Calibration
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                    Values apply to each scanned cylinder piece
                                </span>
                            </div>

                            <div className="grid grid-cols-12 gap-3 items-end">
                                <div className="col-span-12 sm:col-span-4 space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        Tare Weight (kg)
                                    </label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={tareWeight}
                                        readOnly={isLocked}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleAdd();
                                            if (["e", "E", "+"].includes(e.key)) e.preventDefault();
                                        }}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                                setTareWeight(val);
                                            }
                                        }}
                                        className={cn(
                                            "h-10 text-sm font-bold border-2 rounded-xl transition-colors",
                                            isLocked
                                                ? "bg-slate-100/80 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                                : "bg-white dark:bg-slate-950 focus-visible:ring-primary focus-visible:border-primary",
                                            highlightNewSerialFields ? "border-red-500 bg-red-50/10 focus-visible:border-red-600" : ""
                                        )}
                                    />
                                </div>

                                <div className="col-span-12 sm:col-span-5 space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        Expiry Date
                                    </label>
                                    <Input
                                        type="date"
                                        value={expiryDate}
                                        readOnly={isLocked}
                                        onChange={(e) => setExpiryDate(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                                        className={cn(
                                            "h-10 text-sm font-bold border-2 rounded-xl transition-colors",
                                            isLocked
                                                ? "bg-slate-100/80 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                                : "bg-white dark:bg-slate-950 focus-visible:ring-primary focus-visible:border-primary",
                                            highlightNewSerialFields ? "border-red-500 bg-red-50/10 focus-visible:border-red-600" : ""
                                        )}
                                    />
                                </div>

                                <div className="col-span-12 sm:col-span-3">
                                    <Button
                                        type="button"
                                        onClick={() => setIsLocked(!isLocked)}
                                        className={cn(
                                            "w-full h-10 rounded-xl font-black uppercase tracking-wider text-[10px] gap-2 border-2 transition-all shadow-xs active:scale-[0.98]",
                                            isLocked
                                                ? "bg-primary hover:bg-primary/90 text-white border-primary shadow-primary/20"
                                                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                                        )}
                                    >
                                        {isLocked ? (
                                            <>
                                                <Lock className="w-3.5 h-3.5" />
                                                <span>Locked</span>
                                            </>
                                        ) : (
                                            <>
                                                <Unlock className="w-3.5 h-3.5 text-amber-600" />
                                                <span>Unlock to Edit</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Direct Serial Input for Continuous Scanning */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Scan or Type Serial Number
                            </label>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Input
                                        ref={inputRef}
                                        value={serialInput}
                                        onChange={(e) => setSerialInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                                        placeholder="Scan barcode or type serial..."
                                        className={cn(
                                            "h-12 px-4 rounded-xl font-mono text-sm border-2 transition-all shadow-xs",
                                            tempSerials.length >= orderedLimit && orderedLimit > 0
                                                ? "border-amber-500/50 bg-amber-50/10 focus-visible:border-amber-500"
                                                : "border-slate-200 dark:border-slate-800 focus-visible:ring-0 focus-visible:border-primary"
                                        )}
                                    />
                                </div>
                                <Button
                                    onClick={handleAdd}
                                    disabled={verifyingSerial || !isPendingValid}
                                    className={cn(
                                        "h-12 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] gap-2 shadow-sm transition-all active:scale-[0.98]",
                                        !isPendingValid ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary hover:bg-primary/90 text-primary-foreground"
                                    )}
                                >
                                    <Plus className="h-4 w-4" />
                                    {verifyingSerial ? "Verifying..." : "Add Piece"}
                                </Button>
                            </div>
                        </div>

                        {/* Registered Pieces Table */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Registered Pieces ({tempSerials.length})
                                </span>
                                {tempSerials.length > 0 && (
                                    <Button
                                        variant="link"
                                        onClick={onClearAllSerials}
                                        className="h-auto p-0 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600"
                                    >
                                        Clear All Serials
                                    </Button>
                                )}
                            </div>

                            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                                <div className="max-h-56 overflow-y-auto scrollbar-thin">
                                    <Table>
                                        <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 border-b">
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableHead className="h-9 text-[10px] font-black uppercase tracking-widest px-4">Serial Number</TableHead>
                                                <TableHead className="h-9 text-[10px] font-black uppercase tracking-widest text-center">Tare (kg)</TableHead>
                                                <TableHead className="h-9 text-[10px] font-black uppercase tracking-widest text-center">Expiry Date</TableHead>
                                                <TableHead className="h-9 w-12 text-center"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {tempSerials.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center text-slate-400 text-xs font-medium">
                                                        No serials registered yet. Scan or enter a serial above.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                tempSerials.map((item, idx) => (
                                                    <TableRow key={idx} className="group border-slate-100 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                                        {/* Developer comment: Clean monospace display without clutter badges */}
                                                        <TableCell className="py-2.5 px-4 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                                            {item.sn}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-center font-bold text-[11px] text-slate-600 dark:text-slate-400">
                                                            {item.tareWeight || "—"}
                                                        </TableCell>
                                                        <TableCell className="py-2.5 text-center font-bold text-[11px] text-slate-600 dark:text-slate-400">
                                                            {item.expiryDate || "—"}
                                                        </TableCell>
                                                        <TableCell className="py-2 px-2 text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-60 group-hover:opacity-100"
                                                                onClick={() => onRemoveSerial(idx)}
                                                                title="Remove serial"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Pinned Footer Actions */}
                    <div className="shrink-0 p-5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Verification Status</span>
                            <span className="text-sm font-black text-primary uppercase italic">
                                {tempSerials.length > 0 ? "Scanned" : "Awaiting Input"}
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="rounded-xl px-6 font-black uppercase tracking-widest text-[10px] h-11 border-2"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={onCommitPieces}
                                disabled={committingSerials || (tempSerials.length === 0 && !serialInput.trim())}
                                className={cn(
                                    "rounded-xl px-10 font-black uppercase tracking-widest text-[10px] h-11 shadow-lg",
                                    committingSerials ? "bg-primary/70" : "bg-primary shadow-primary/30"
                                )}
                            >
                                {committingSerials ? "Committing..." : "Commit Pieces"}
                            </Button>
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

