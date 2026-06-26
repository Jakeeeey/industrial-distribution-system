"use client";
// RefillRapidScanModal.tsx
// Rapid scan modal for Refill PO receiving Step 3.
// Three-tier serial validation:
//   1. purchase_order_serial (pre-tagged for this porId) → source: "tagged"
//   2. cylinder_assets (existing registered cylinder) → source: "asset"
//   3. Not found anywhere → inline new cylinder registration form

import * as React from "react";
import {
    Scan, X, Trash2, CheckCircle2, AlertTriangle, Loader2,
    Plus, Package, AlertCircle
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useReceivingProductsManual } from "../providers/ReceivingProductsManualProvider";

const API_URL = "/api/ids/scm/supplier-management/purchase-order-receiving-manual";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductLine {
    porId: string;
    purchaseOrderProductId?: string; // target purchase_order_product_id from DB
    productId: number;
    productName: string;
    branchName: string;
    expectedQty: number;
    scannedCount: number;
}

type ScanStatus = "tagged" | "asset" | "new" | "mismatch" | "error";

interface ScanLogEntry {
    serial: string;
    status: ScanStatus;
    productName: string;
    message: string;
}

interface PendingRegistration {
    serial: string;
    porId: string;
    productName: string;
}

interface AssetInfo {
    tare_weight?: number | string;
    expiration_date?: string;
    cylinder_status?: string;
    cylinder_condition?: string;
}

interface RefillRapidScanModalProps {
    open: boolean;
    onClose: () => void;
    poId: number;
    supplierId?: number | null;
    /** All product lines in this PO currently selected for receiving */
    lines: ProductLine[];
    /** Called when a serial is confirmed for a porId (adds to session) */
    onAddSerial: (porId: string, serial: string, isNew?: boolean) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayYMD(): string {
    return new Date().toISOString().split("T")[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RefillRapidScanModal({
    open,
    onClose,
    poId,
    supplierId,
    lines,
    onAddSerial,
}: RefillRapidScanModalProps) {
    const { serialsByPorId } = useReceivingProductsManual();
    const [inputValue, setInputValue] = React.useState("");
    const [isValidating, setIsValidating] = React.useState(false);
    const [scanLog, setScanLog] = React.useState<ScanLogEntry[]>([]);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // State for inline new cylinder registration
    const [pendingRegistration, setPendingRegistration] = React.useState<PendingRegistration | null>(null);
    const [regTare, setRegTare] = React.useState("");
    const [regExpiry, setRegExpiry] = React.useState(todayYMD());
    const [isRegistering, setIsRegistering] = React.useState(false);

    const openRef = React.useRef(false);

    // Reset on open and populate scanLog with already scanned serials
    React.useEffect(() => {
        if (open && !openRef.current) {
            setInputValue("");
            
            const initialLog: ScanLogEntry[] = [];
            lines.forEach(line => {
                const scanned = serialsByPorId[line.porId] || [];
                scanned.forEach(s => {
                    initialLog.push({
                        serial: s.sn,
                        status: s.isNew ? "new" : "tagged",
                        productName: line.productName,
                        message: s.isNew 
                            ? `New Cylinder Registered → ${line.productName}` 
                            : `Captured Cylinder → ${line.productName}`
                    });
                });
            });
            setScanLog(initialLog);
            
            setPendingRegistration(null);
            setRegTare("");
            setRegExpiry(todayYMD());
            setTimeout(() => inputRef.current?.focus(), 150);
        }
        openRef.current = open;
    }, [open, lines, serialsByPorId]);

    const addToLog = (entry: ScanLogEntry) => {
        setScanLog(prev => [entry, ...prev]);
    };

    // Find the best matching product line for a porId, preferring lines with capacity
    const findLineByPorId = (porId: string): ProductLine | undefined => {
        return lines.find(l => l.porId === porId);
    };

    const handleScan = React.useCallback(async () => {
        const sn = inputValue.trim().toUpperCase();
        setInputValue("");
        if (!sn || isValidating) return;

        if (lines.length === 0) {
            toast.error("No product lines available.");
            return;
        }

        // Guard: already successfully scanned this session
        if (scanLog.some(e => e.serial === sn && (e.status === "tagged" || e.status === "asset" || e.status === "new"))) {
            toast.warning(`"${sn}" already captured in this session.`);
            return;
        }

        setIsValidating(true);
        try {
            // Use first line with capacity as the target porId for validation
            const targetLine = lines.find(l => l.scannedCount < l.expectedQty) ?? lines[0];

            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "validate_scan_serial",
                    serialNumber: sn,
                    poId,
                    porId: targetLine.purchaseOrderProductId || targetLine.porId, // Pass correct purchase_order_product_id to validate correctly
                }),
            });
            const json = await res.json();

            if (!res.ok) throw new Error(json?.error || "Validation failed");

            // Extract nested data payload returned by the ok() helper
            const data = json?.data;
            if (!data) throw new Error("Unexpected empty response payload");

            if (data.valid && data.source === "tagged") {
                // ✅ Auto-allocate to the correct pre-tagged line matching purchaseOrderProductId
                // Comments: Route allocation dynamically based on the DB matching line.
                const matchedLine = lines.find(l => String(l.purchaseOrderProductId) === String(data.purchaseOrderProductId));
                const best = matchedLine || (lines.find(l => l.scannedCount < l.expectedQty) ?? lines[0]);
                
                onAddSerial(best.porId, sn);
                addToLog({ serial: sn, status: "tagged", productName: best.productName, message: `Pre-Tagged → ${best.productName}` });
                toast.success(`"${sn}" verified and allocated to ${best.productName}.`);
                return;
            }

            if (data.valid && data.source === "asset") {
                const asset = data.asset as AssetInfo & { product_id: number };
                // ✅ Auto-allocate to the matching product line by product ID
                // Comments: Route known assets directly to the PO product line matching their product ID.
                const matchedLine = lines.find(l => Number(l.productId) === Number(asset.product_id));
                const best = matchedLine || (lines.find(l => l.scannedCount < l.expectedQty) ?? lines[0]);
                
                onAddSerial(best.porId, sn);
                const tare = asset.tare_weight ? `${asset.tare_weight}kg` : "No tare";
                addToLog({ serial: sn, status: "asset", productName: best.productName, message: `Asset Found (${tare}) → ${best.productName}` });
                toast.success(`"${sn}" matched as asset — allocated to ${best.productName}.`);
                return;
            }

            if (!data.valid && data.requiresRegistration) {
                // New cylinder — trigger inline registration form
                const best = lines.find(l => l.scannedCount < l.expectedQty) ?? lines[0];
                setPendingRegistration({ serial: sn, porId: best.porId, productName: best.productName });
                setRegTare("");
                setRegExpiry(todayYMD());
                toast.info(`"${sn}" not found. Please register this cylinder.`);
                return;
            }

            // Unknown state
            addToLog({ serial: sn, status: "error", productName: "—", message: "Unexpected response" });
        } catch (e) {
            console.error(e);
            addToLog({ serial: sn, status: "error", productName: "—", message: (e as Error).message });
            toast.error("Validation failed. Please retry.");
        } finally {
            setIsValidating(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [inputValue, isValidating, scanLog, lines, poId, onAddSerial]);

    // Enter key
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") { e.preventDefault(); handleScan(); }
    };

    // Auto-debounce for barcode scanners that don't send Enter
    React.useEffect(() => {
        const val = inputValue.trim();
        if (!val) return;
        const timer = setTimeout(() => handleScan(), 600);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputValue]);

    // Confirm new cylinder registration
    const handleConfirmRegistration = async () => {
        if (!pendingRegistration) return;
        if (!regTare.trim()) { toast.error("Tare weight is required."); return; }
        if (!regExpiry) { toast.error("Expiration date is required."); return; }

        setIsRegistering(true);
        try {
            const line = findLineByPorId(pendingRegistration.porId);
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "register_cylinder",
                    serialNumber: pendingRegistration.serial,
                    productId: line?.productId,
                    tareWeight: parseFloat(regTare),
                    expirationDate: regExpiry,
                    currentSupplierId: supplierId,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Registration failed");

            onAddSerial(pendingRegistration.porId, pendingRegistration.serial, true);
            addToLog({
                serial: pendingRegistration.serial,
                status: "new",
                productName: pendingRegistration.productName,
                message: `New Cylinder Registered → ${pendingRegistration.productName}`,
            });
            toast.success(`"${pendingRegistration.serial}" registered and allocated.`);
            setPendingRegistration(null);
        } catch (e) {
            toast.error(`Registration failed: ${(e as Error).message}`);
        } finally {
            setIsRegistering(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleCancelRegistration = () => {
        addToLog({
            serial: pendingRegistration?.serial ?? "",
            status: "error",
            productName: "—",
            message: "Registration cancelled",
        });
        setPendingRegistration(null);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    // ─── Status badge helpers ─────────────────────────────────────────────────
    const statusColor: Record<ScanStatus, string> = {
        tagged: "bg-emerald-500 text-white",
        asset:  "bg-primary text-white",
        new:    "bg-blue-500 text-white",
        mismatch: "bg-orange-500 text-white",
        error:  "bg-red-500 text-white",
    };
    const statusLabel: Record<ScanStatus, string> = {
        tagged: "Pre-Tagged",
        asset: "Asset Found",
        new: "New Cylinder",
        mismatch: "Mismatch",
        error: "Error",
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                showCloseButton={false}
                className="!max-w-[1000px] !w-[95vw] h-[90vh] max-h-[800px] p-0 bg-background rounded-2xl border-none shadow-2xl overflow-hidden flex flex-col"
            >
                {/* ── Header Banner ── */}
                <div className="p-4 sm:p-5 bg-primary text-white relative shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl shrink-0">
                                <Scan className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-white">
                                    Refill Rapid Scan
                                </DialogTitle>
                                <DialogDescription className="text-white/80 text-xs">
                                    Scan cylinders — validates against PO tags, cylinder registry, or registers new.
                                </DialogDescription>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 min-h-0 flex flex-col md:flex-row">

                    {/* ── Left Column: Scanner + Log ── */}
                    <div className="flex-1 flex flex-col min-w-0 md:w-1/2 md:border-r border-border">
                        {/* Scan Input Area */}
                        <div className="p-4 sm:p-5 border-b border-border bg-muted/20 space-y-3 shrink-0">
                            {/* New Cylinder Registration Form (inline) */}
                            {pendingRegistration ? (
                                <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 space-y-3">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs font-black text-blue-800 dark:text-blue-200 uppercase tracking-wider">
                                                New Cylinder — Register Required
                                            </p>
                                            <p className="text-[10px] font-mono font-bold text-blue-600 mt-0.5">
                                                {pendingRegistration.serial} → {pendingRegistration.productName}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Comments: Let the user select/delegate which product line to associate this new cylinder with */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                                            Delegate to Product *
                                        </label>
                                        <select
                                            value={pendingRegistration.porId}
                                            onChange={e => {
                                                const selectedPorId = e.target.value;
                                                const line = lines.find(l => l.porId === selectedPorId);
                                                if (line) {
                                                    setPendingRegistration(prev => prev ? {
                                                        ...prev,
                                                        porId: line.porId,
                                                        productName: line.productName
                                                    } : null);
                                                }
                                            }}
                                            className="w-full h-10 border-2 border-blue-200 focus-visible:border-blue-500 focus-visible:ring-0 rounded-xl text-xs font-bold px-3 bg-white dark:bg-slate-900 outline-none cursor-pointer transition-colors"
                                        >
                                            {lines.map(l => (
                                                <option key={l.porId} value={l.porId} className="text-slate-800 dark:text-slate-200">
                                                    {l.productName} ({l.branchName}) — {l.scannedCount}/{l.expectedQty} Scanned
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                                                Tare Weight (kg) *
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="e.g. 14.50"
                                                value={regTare}
                                                onChange={e => {
                                                    const v = e.target.value;
                                                    if (v === "" || /^\d*\.?\d*$/.test(v)) setRegTare(v);
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter") handleConfirmRegistration();
                                                    if (["e", "E", "+"].includes(e.key)) e.preventDefault();
                                                }}
                                                className="h-10 border-2 border-blue-200 focus-visible:border-blue-500 focus-visible:ring-0 rounded-xl text-sm font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                                                Expiration Date *
                                            </label>
                                            <Input
                                                type="date"
                                                value={regExpiry}
                                                onChange={e => setRegExpiry(e.target.value)}
                                                onKeyDown={e => { if (e.key === "Enter") handleConfirmRegistration(); }}
                                                className="h-10 border-2 border-blue-200 focus-visible:border-blue-500 focus-visible:ring-0 rounded-xl text-sm font-bold px-2"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleCancelRegistration}
                                            variant="outline"
                                            size="sm"
                                            disabled={isRegistering}
                                            className="flex-1 h-9 rounded-xl font-black uppercase text-[9px] tracking-widest border-2 border-blue-200"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleConfirmRegistration}
                                            size="sm"
                                            disabled={isRegistering || !regTare.trim() || !regExpiry}
                                            className="flex-1 h-9 rounded-xl font-black uppercase text-[9px] tracking-widest bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                                        >
                                            {isRegistering ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Plus className="w-3.5 h-3.5" />
                                            )}
                                            Register & Accept
                                        </Button>
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
                                                onChange={e => setInputValue(e.target.value)}
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
                                            className="h-10 px-5 rounded-xl font-bold shrink-0 bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25"
                                        >
                                            Verify
                                        </Button>
                                    </div>

                                    {/* Line capacity pills */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {lines.map(l => {
                                            const done = l.scannedCount >= l.expectedQty;
                                            return (
                                                <Badge
                                                    key={l.porId}
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[9px] font-black",
                                                        done
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/20"
                                                            : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/50"
                                                    )}
                                                >
                                                    {l.productName.split(" ").slice(0, 2).join(" ")} — {l.scannedCount}/{l.expectedQty}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Scan Log */}
                        <div className="p-4 sm:p-5 space-y-2 flex-1 overflow-hidden bg-background flex flex-col">
                            <div className="flex justify-between items-center shrink-0">
                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                    Scan Log ({scanLog.length})
                                </span>
                                {scanLog.length > 0 && (
                                    <button
                                        onClick={() => setScanLog([])}
                                        className="text-[10px] font-black uppercase text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Clear Log
                                    </button>
                                )}
                            </div>
                            <ScrollArea className="flex-1 min-h-0 border border-border rounded-xl bg-card shadow-inner">
                                {scanLog.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground/60 space-y-2">
                                        <Scan className="w-8 h-8 text-muted-foreground/45 stroke-[1.5]" />
                                        <span className="text-xs font-semibold">No scans yet</span>
                                    </div>
                                ) : (
                                    <div className="p-2 space-y-2">
                                        {scanLog.map((item, idx) => (
                                            <div
                                                key={`${item.serial}-${idx}`}
                                                className={cn(
                                                    "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all",
                                                    (item.status === "tagged" || item.status === "asset" || item.status === "new")
                                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                                        : "bg-red-500/5 border-red-500/20"
                                                )}
                                            >
                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold">{item.serial}</span>
                                                        <Badge className={cn("text-[9px] font-black h-4 px-1.5 border-none", statusColor[item.status])}>
                                                            {statusLabel[item.status]}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground font-medium truncate">{item.productName}</p>
                                                </div>
                                                <div className="text-right text-[10px] font-bold ml-2 shrink-0">
                                                    {item.status === "tagged" || item.status === "asset" || item.status === "new" ? (
                                                        <span className="text-emerald-600 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            OK
                                                        </span>
                                                    ) : (
                                                        <span className="text-red-500 flex items-center gap-1 justify-end">
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                            Rejected
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

                    {/* ── Right Column: Allocation Progress ── */}
                    <div className="flex-1 flex flex-col min-w-0 md:w-1/2 bg-muted/10 overflow-y-auto">
                        <div className="p-4 sm:p-5 space-y-4">
                            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                Allocation Progress
                            </div>
                            <div className="space-y-3">
                                {lines.map(l => {
                                    const done = l.scannedCount >= l.expectedQty;
                                    const progressPct = l.expectedQty > 0
                                        ? Math.min(100, (l.scannedCount / l.expectedQty) * 100)
                                        : 0;
                                    return (
                                        <div key={l.porId} className="p-3 bg-background border border-border rounded-xl space-y-3 shadow-sm">
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <div className="font-bold text-sm text-foreground leading-tight truncate">
                                                            {l.productName}
                                                        </div>
                                                    </div>
                                                    <div className="text-[11px] font-semibold text-muted-foreground mt-1 ml-5">
                                                        {l.branchName}
                                                    </div>
                                                </div>
                                                <Badge
                                                    variant={done ? "default" : "secondary"}
                                                    className={cn("shrink-0 font-mono font-black", done && "bg-emerald-500 text-white")}
                                                >
                                                    {l.scannedCount} / {l.expectedQty}
                                                </Badge>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={cn("h-full transition-all duration-300", done ? "bg-emerald-500" : "bg-primary")}
                                                    style={{ width: `${progressPct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="pt-2 border-t border-border/50 space-y-2">
                                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Scan Status Legend</div>
                                <div className="space-y-1.5">
                                    {[
                                        { color: "bg-emerald-500", label: "Pre-Tagged", desc: "Found in PO serial tags" },
                                        { color: "bg-primary", label: "Asset Found", desc: "Registered in cylinder registry" },
                                        { color: "bg-blue-500", label: "New Cylinder", desc: "Registered & allocated" },
                                        { color: "bg-orange-500", label: "Mismatch", desc: "Tagged to different product" },
                                        { color: "bg-red-500", label: "Error", desc: "Validation failed" },
                                    ].map(item => (
                                        <div key={item.label} className="flex items-center gap-2 text-[10px]">
                                            <div className={cn("w-2 h-2 rounded-full shrink-0", item.color)} />
                                            <span className="font-black text-foreground">{item.label}</span>
                                            <span className="text-muted-foreground">— {item.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-end p-4 border-t border-border bg-card shrink-0">
                    <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">
                        Done Scanning
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
