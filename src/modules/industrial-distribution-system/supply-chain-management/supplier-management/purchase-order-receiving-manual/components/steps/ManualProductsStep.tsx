"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useReceivingProductsManual, todayYMD } from "../../providers/ReceivingProductsManualProvider";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Plus, Trash2, QrCode, Package, ChevronRight, ChevronLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ManualProductsStep({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
    const {
        selectedPO,
        manualCounts,
        setManualCounts,
        verifiedProductIds,
        serialsByPorId,
        setSerialsByPorId,
    } = useReceivingProductsManual();

    // ✅ Pagination state
    const [receivingPage, setReceivingPage] = React.useState(1);
    const ITEMS_PER_PAGE = 10;

    // ✅ Over-receiving modal (non-serialized path & serialized over-limit path) - AG 2026-07-14
    const [isOverReceivingModalOpen, setIsOverReceivingModalOpen] = React.useState(false);
    // Pending count the user tried to enter (non-serialized over-limit confirm flow)
    const [pendingOverCount, setPendingOverCount] = React.useState<{ id: string; val: number } | null>(null);

    // ✅ Serial Modal state
    const [serialModalOpen, setSerialModalOpen] = React.useState(false);
    const [activePorId, setActivePorId] = React.useState<string | null>(null);
    const [activeProductName, setActiveProductName] = React.useState("");
    const [tempSerials, setTempSerials] = React.useState<{ sn: string; tareWeight: string; expiryDate: string }[]>([]);
    const [newSerial, setNewSerial] = React.useState("");
    const [newTare, setNewTare] = React.useState("");
    const [newExpiry, setNewExpiry] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    // ✅ Fix 3: Serial Verification state - AG 2026-07-14
    const [verifyingSerial, setVerifyingSerial] = React.useState(false);
    // Holds the serial that was BLOCKED because it is already in cylinder_assets master - AG 2026-07-14
    const [blockedAssetSerial, setBlockedAssetSerial] = React.useState<{ sn: string; assetId: unknown; status: unknown; condition: unknown } | null>(null);
    const [isBlockedSerialOpen, setIsBlockedSerialOpen] = React.useState(false);
    // When serial count exceeds ordered qty for serialized items, prompt warning
    const [isSerialOverLimitOpen, setIsSerialOverLimitOpen] = React.useState(false);
    const [pendingSerialEntry, setPendingSerialEntry] = React.useState<{ sn: string; tare: string; expiry: string } | null>(null);

    // ✅ Auto-focus input when modal opens
    React.useEffect(() => {
        if (serialModalOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [serialModalOpen]);

    // ✅ Show only verified items
    const filteredItems = React.useMemo(() => {
        const allocs = Array.isArray(selectedPO?.allocations) ? selectedPO!.allocations : [];
        const flattened = allocs.flatMap((a) => {
            const items = Array.isArray(a?.items) ? a.items : [];
            return items.map((it) => ({
                ...it,
                id: String(it.id),
                branchName: a?.branch?.name ?? "Unassigned",
            }));
        });

        return flattened.filter(it => verifiedProductIds.includes(it.productId));
    }, [selectedPO, verifiedProductIds]);

    const totalEntered = React.useMemo(() => {
        return Object.values(manualCounts).reduce((a, b) => a + (Number(b) || 0), 0);
    }, [manualCounts]);

    const handleCountChange = (id: string, val: string) => {
        const parsed = parseInt(val, 10);
        let validVal = isNaN(parsed) ? 0 : parsed;
        if (validVal < 0) validVal = 0;

        // ✅ Fix 2: Check if new count would exceed ordered qty for non-serialized items - AG 2026-07-14
        const item = filteredItems.find(it => String(it.id) === id);
        if (item && !item.isSerialized && validVal > 0) {
            const expectedQty = Number(item.expectedQty || 0);
            const receivedAtStart = Number(item.receivedQty || 0);
            const remainingBalance = expectedQty - receivedAtStart;
            if (validVal > remainingBalance && validVal > 0) {
                // Hold the value and prompt a confirmation dialog
                setPendingOverCount({ id, val: validVal });
                setIsOverReceivingModalOpen(true);
                return; // Don't apply yet — wait for user confirmation
            }
        }

        setManualCounts(prev => ({ ...prev, [id]: validVal }));
    };

    const isOverReceiving = React.useMemo(() => {
        return filteredItems.some(it => {
            const id = String(it.id);
            const expected = Number(it.expectedQty || 0);
            const receivedAtStart = Number(it.receivedQty || 0);
            const currentEntry = Number(manualCounts[id] || 0);
            return (currentEntry + receivedAtStart) > expected && currentEntry > 0;
        });
    }, [filteredItems, manualCounts]);

    const incompleteSerialized = React.useMemo(() => {
        return filteredItems.filter(it => {
            if (!it.isSerialized) return false;
            const count = manualCounts[String(it.id)] || 0;
            const expected = Number(it.expectedQty || 0);
            const receivedAtStart = Number(it.receivedQty || 0);
            return (count + receivedAtStart) < expected;
        });
    }, [filteredItems, manualCounts]);

    const handleContinueClick = () => {
        if (incompleteSerialized.length > 0) {
            const first = incompleteSerialized[0];
            toast.error("Incomplete Registration", {
                description: `Please fully register serials for ${first.name}. (${manualCounts[String(first.id)] || 0}/${Number(first.expectedQty || 0) - Number(first.receivedQty || 0)} registered)`,
                duration: 3000
            });
            return;
        }
        if (isOverReceiving) {
            setIsOverReceivingModalOpen(true);
        } else {
            onContinue();
        }
    };

    const openSerialModal = (id: string, name: string) => {
        setActivePorId(id);
        setActiveProductName(name);
        const existingSerials = (serialsByPorId[id] || []).map(s => ({
            sn: s.sn,
            tareWeight: s.tareWeight || "",
            expiryDate: s.expiryDate || todayYMD()
        }));
        setTempSerials(existingSerials);
        setNewSerial("");
        setNewTare("");
        setNewExpiry("");
        setSerialModalOpen(true);
    };

    const activeItem = filteredItems.find(x => String(x.id) === activePorId);
    // orderedLimit is the remaining balance — used for display, NOT for hard blocking (warning shown instead) - AG 2026-07-14
    const orderedLimit = activeItem ? Math.max(0, Number(activeItem.expectedQty || 0) - Number(activeItem.receivedQty || 0)) : Infinity;

    // ✅ Validation Helper
    const isPendingValid = newSerial.trim() !== "" && newTare.trim() !== "" && newExpiry.trim() !== "";
    const isPartialEntry = newSerial.trim() !== "" || newTare.trim() !== ""; // If user started typing anything

    // ✅ Fix 3: Serial Verification — NEW LOGIC (AG 2026-07-14)
    // - Serial NOT in cylinder_assets (requiresRegistration=true) → AUTO-ACCEPT (new asset, free to receive)
    // - Serial IS in cylinder_assets (source="asset") → BLOCK with popup (already registered, cannot duplicate)
    const addSerial = async () => {
        if (!isPendingValid) {
            toast.error("Incomplete Registration", {
                description: "Please fulfill all fields: Serial, Tare, and Expiry.",
            });
            return;
        }

        const val = newSerial.trim().toUpperCase();

        // 1. In-session duplicate check
        if (tempSerials.some(x => x.sn === val)) {
            toast.warning("Duplicate Serial", { description: "Already in current list." });
            return;
        }

        // 2. Cross-product duplicate check (within this receiving session)
        let existingProduct = "";
        for (const [pid, sns] of Object.entries(serialsByPorId)) {
            if (pid === activePorId) continue;
            if (sns.some(x => x.sn === val)) {
                const p = (selectedPO?.allocations || []).flatMap(a => a.items).find(i => String(i.id) === pid);
                existingProduct = p?.name || "another product";
                break;
            }
        }
        if (existingProduct) {
            toast.error("Duplicate Serial", { description: `Already registered for ${existingProduct}` });
            return;
        }

        // 3. Check if over the ordered balance — warn instead of hard block - AG 2026-07-14
        if (tempSerials.length >= orderedLimit) {
            setPendingSerialEntry({ sn: val, tare: newTare, expiry: newExpiry });
            setIsSerialOverLimitOpen(true);
            return;
        }

        // 4. Verify against Cylinder Asset master DB - AG 2026-07-14
        setVerifyingSerial(true);
        try {
            const res = await fetch("/api/ids/scm/supplier-management/purchase-order-receiving-manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "validate_scan_serial",
                    serialNumber: val,
                    poId: selectedPO?.id,
                }),
            });
            const j = await res.json();
            const result = j?.data;

            if (result?.source === "asset") {
                // ❌ BLOCKED: Serial is already registered in cylinder_assets master — cannot receive a duplicate - AG 2026-07-14
                setBlockedAssetSerial({
                    sn: val,
                    assetId: result.asset?.id,
                    status: result.asset?.cylinder_status,
                    condition: result.asset?.cylinder_condition,
                });
                setIsBlockedSerialOpen(true);
                return; // Do NOT add to tempSerials
            }

            // ✅ AUTO-ACCEPT: Serial not in cylinder_assets (requiresRegistration=true) or matched via PO serial tag
            // New cylinders / PO-tagged serials can always be received without registration friction.
            setTempSerials(prev => [...prev, { sn: val, tareWeight: newTare, expiryDate: newExpiry }]);
            setNewSerial("");
            setNewTare("");
            setNewExpiry("");
            setTimeout(() => inputRef.current?.focus(), 10);
        } catch {
            toast.error("Verification Failed", { description: "Could not verify serial. Please check your connection." });
        } finally {
            setVerifyingSerial(false);
        }
    };

    // ✅ Confirm adding an over-limit serial (user acknowledged warning) - AG 2026-07-14
    const confirmAddOverLimitSerial = () => {
        if (!pendingSerialEntry) return;
        setTempSerials(prev => [...prev, { sn: pendingSerialEntry.sn, tareWeight: pendingSerialEntry.tare, expiryDate: pendingSerialEntry.expiry }]);
        setPendingSerialEntry(null);
        setIsSerialOverLimitOpen(false);
        setNewSerial("");
        setNewTare("");
        setNewExpiry("");
        setTimeout(() => inputRef.current?.focus(), 10);
    };

    // ✅ Removed: confirmRegisterCylinder and rejectUnregisteredSerial — no longer needed.
    // Unregistered serials are now auto-accepted. Registered serials are blocked. - AG 2026-07-14

    const removeSerial = (index: number) => {
        setTempSerials(tempSerials.filter((_, i) => i !== index));
    };

    const saveSerials = () => {
        const finalSerials = [...tempSerials];
        
        // ✅ Smart Auto-Add: Only if COMPLETELY fulfilled
        const pending = newSerial.trim();
        if (pending && isPendingValid) {
            const isDup = tempSerials.some(x => x.sn === pending);
            const isLimit = tempSerials.length >= orderedLimit;
            
            if (!isDup && !isLimit) {
                finalSerials.push({ sn: pending, tareWeight: newTare, expiryDate: newExpiry });
            }
        } else if (pending && !isPendingValid) {
            toast.warning("Incomplete Entry Ignored", { 
                description: "The piece you were typing was not added because some fields were missing." 
            });
        }

        if (activePorId) {
            setSerialsByPorId(prev => ({ ...prev, [activePorId]: finalSerials }));
            setManualCounts(prev => ({ ...prev, [activePorId]: finalSerials.length }));
            toast.success("Progress Saved", { description: `${finalSerials.length} serials committed.` });
        }
        setSerialModalOpen(false);
    };

    const handleCancelSerial = () => {
        if (tempSerials.length > 0 || newSerial.trim()) {
            if (!window.confirm("You have unsaved serials. Are you sure you want to discard them?")) {
                return;
            }
        }
        setSerialModalOpen(false);
    };

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
    const paginatedItems = filteredItems.slice((receivingPage - 1) * ITEMS_PER_PAGE, receivingPage * ITEMS_PER_PAGE);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between mb-4 px-1">
                <div className="flex flex-col gap-0.5">
                    <div className="text-[10px] font-black text-primary uppercase tracking-widest">Step 3: Manual Receipt</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Enter quantities or register serials for verified products</div>
                </div>
                <Button variant="ghost" size="sm" onClick={onBack} className="h-8 rounded-lg font-black uppercase text-[9px] tracking-widest text-slate-400 hover:text-primary">
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Change PO
                </Button>
            </div>

            <Card className="flex-1 overflow-hidden shadow-sm border-slate-200 dark:border-slate-800 rounded-xl flex flex-col bg-white dark:bg-slate-950">
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-20">
                            <TableRow className="hover:bg-transparent border-slate-200">
                                <TableHead className="text-[9px] h-10 font-black uppercase tracking-widest text-slate-500 px-4">Product Details</TableHead>
                                <TableHead className="text-[9px] h-10 font-black uppercase tracking-widest text-slate-500">Branch</TableHead>
                                <TableHead className="text-[9px] h-10 font-black uppercase tracking-widest text-center w-24 text-slate-500">Expected</TableHead>
                                <TableHead className="text-[9px] h-10 font-black uppercase tracking-widest text-center w-24 text-slate-500">Prev. Rec.</TableHead>
                                <TableHead className="text-[9px] h-10 font-black uppercase tracking-widest text-center w-40 text-slate-500">Current Receipt</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 font-medium italic text-xs">
                                        No products selected for verification. Go back to step 2.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedItems.map((it) => {
                                    const id = String(it.id);
                                    const count = manualCounts[id] || 0;
                                    const expected = Number(it.expectedQty || 0);
                                    const receivedAtStart = Number(it.receivedQty || 0);
                                    const isOver = (count + receivedAtStart) > expected && count > 0;

                                    return (
                                        <TableRow key={id} className={cn(
                                            "border-slate-100 dark:border-slate-900 group transition-colors",
                                            isOver ? "bg-red-50/50 dark:bg-red-500/5" : "hover:bg-slate-50/50"
                                        )}>
                                            <TableCell className="py-3 px-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="font-black text-xs text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors flex items-center gap-2">
                                                        <Package className="w-3 h-3 text-slate-400" />
                                                        {it.name}
                                                        {isOver && <Badge className="bg-red-600 text-[7px] font-black h-3.5 px-1.5 uppercase border-none animate-pulse">Over-Receiving</Badge>}
                                                    </div>
                                                    <div className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">SKU: {it.barcode} | UOM: {it.uom}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[8px] font-black uppercase px-2 py-0.5 border-none">
                                                    {it.branchName}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-black text-[10px] text-slate-500">{expected}</TableCell>
                                            <TableCell className="text-center font-black text-[10px] text-emerald-600/70">{receivedAtStart}</TableCell>
                                            <TableCell className="text-right px-4">
                                                {it.isSerialized ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openSerialModal(id, it.name)}
                                                        className={cn(
                                                            "w-full h-8 rounded-lg font-black uppercase tracking-widest text-[9px] border-2 gap-2",
                                                            count > 0 ? "border-emerald-500/50 text-emerald-600 bg-emerald-50/30" : "border-slate-200 text-slate-500"
                                                        )}
                                                    >
                                                        <QrCode className="w-3 h-3" />
                                                        {count > 0 ? `${count} Pieces Registered` : "Register Serials"}
                                                    </Button>
                                                ) : (
                                                    <div className="flex items-center justify-end">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={count || ""}
                                                            onChange={(e) => handleCountChange(id, e.target.value)}
                                                            className={cn(
                                                                "h-8 w-24 text-center font-black text-xs border-2 rounded-lg transition-all focus-visible:ring-0",
                                                                isOver ? "border-red-500 focus-visible:border-red-600" : "border-slate-200 focus-visible:border-primary"
                                                            )}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {totalPages > 1 && (
                    <div className="shrink-0 p-3 bg-slate-50 dark:bg-slate-900/50 border-t flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Page {receivingPage} of {totalPages}</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setReceivingPage(p => Math.max(1, p - 1))} disabled={receivingPage === 1} className="h-7 rounded-lg font-black uppercase text-[9px] tracking-widest px-3 border-2">
                                <ChevronLeft className="w-3 h-3 mr-1" /> Prev
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setReceivingPage(p => Math.min(totalPages, p + 1))} disabled={receivingPage === totalPages} className="h-7 rounded-lg font-black uppercase text-[9px] tracking-widest px-3 border-2">
                                Next <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            <div className="shrink-0 mt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Items Summary</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-primary leading-none">{totalEntered}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Units Captured</span>
                        </div>
                    </div>
                </div>
                <Button
                    onClick={handleContinueClick}
                    className={cn(
                        "h-12 px-10 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]",
                        incompleteSerialized.length > 0 
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                            : "bg-primary text-white shadow-primary/20"
                    )}
                    disabled={totalEntered === 0}
                >
                    Proceed to Final Review <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
            </div>

            {/* ✅ Fix 2: Over-receiving warning for non-serialized items - AG 2026-07-14 */}
            <AlertDialog open={isOverReceivingModalOpen} onOpenChange={(open) => {
                if (!open) setPendingOverCount(null);
                setIsOverReceivingModalOpen(open);
            }}>
                <AlertDialogContent className="rounded-2xl border-2">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600 font-black uppercase tracking-tight">
                            <AlertTriangle className="w-5 h-5" /> Over-Receiving Warning
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-bold text-slate-600 uppercase tracking-wider leading-relaxed">
                            The quantity you entered ({pendingOverCount?.val}) exceeds the remaining ordered balance.
                            This will create an over-receiving discrepancy.
                            Are you sure you want to proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl font-black uppercase tracking-widest text-[10px] border-2" onClick={() => setPendingOverCount(null)}>Adjust Quantity</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            // ✅ Apply the pending over-count on explicit user confirmation - AG 2026-07-14
                            if (pendingOverCount) {
                                setManualCounts(prev => ({ ...prev, [pendingOverCount.id]: pendingOverCount.val }));
                                setPendingOverCount(null);
                            }
                            setIsOverReceivingModalOpen(false);
                        }} className="bg-red-600 hover:bg-red-700 rounded-xl font-black uppercase tracking-widest text-[10px]">Proceed Anyway</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ✅ Fix 2: Serial over-limit warning for serialized items - AG 2026-07-14 */}
            <AlertDialog open={isSerialOverLimitOpen} onOpenChange={(open) => {
                if (!open) setPendingSerialEntry(null);
                setIsSerialOverLimitOpen(open);
            }}>
                <AlertDialogContent className="rounded-2xl border-2">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-600 font-black uppercase tracking-tight">
                            <AlertTriangle className="w-5 h-5" /> Quantity Limit Exceeded
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-bold text-slate-600 uppercase tracking-wider leading-relaxed">
                            You have already registered {tempSerials.length} serial(s) but the ordered balance is only {orderedLimit}.
                            Adding serial <span className="font-mono text-slate-800">{pendingSerialEntry?.sn}</span> will exceed the ordered quantity.
                            Confirm only if you are intentionally receiving more than ordered.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl font-black uppercase tracking-widest text-[10px] border-2" onClick={() => setPendingSerialEntry(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmAddOverLimitSerial} className="bg-amber-600 hover:bg-amber-700 rounded-xl font-black uppercase tracking-widest text-[10px]">Add Anyway</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ✅ Fix 3 (UPDATED): Blocked Serial dialog — fires when serial is ALREADY in cylinder_assets master - AG 2026-07-14 */}
            <AlertDialog open={isBlockedSerialOpen} onOpenChange={(open) => {
                if (!open) setBlockedAssetSerial(null);
                setIsBlockedSerialOpen(open);
            }}>
                <AlertDialogContent className="rounded-2xl border-2 border-red-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600 font-black uppercase tracking-tight">
                            <AlertTriangle className="w-5 h-5" /> Serial Already Registered
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p className="text-sm font-bold text-slate-600 uppercase tracking-wider leading-relaxed">
                                    Serial <span className="font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">{blockedAssetSerial?.sn}</span> already exists in the Cylinder Asset master database and cannot be received again.
                                </p>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-slate-400">Asset ID</span>
                                        <span className="font-mono text-slate-700">{String(blockedAssetSerial?.assetId || "—")}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-slate-400">Status</span>
                                        <span className="text-slate-700">{String(blockedAssetSerial?.status || "—")}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-slate-400">Condition</span>
                                        <span className="text-slate-700">{String(blockedAssetSerial?.condition || "—")}</span>
                                    </div>
                                </div>
                                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                                    Please verify the physical serial number and try a different one.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction
                            onClick={() => {
                                setBlockedAssetSerial(null);
                                setIsBlockedSerialOpen(false);
                                setNewSerial("");
                                setTimeout(() => inputRef.current?.focus(), 10);
                            }}
                            className="bg-red-600 hover:bg-red-700 rounded-xl font-black uppercase tracking-widest text-[10px]"
                        >
                            OK, Clear Entry
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={serialModalOpen} onOpenChange={(open) => {
                if (!open && (tempSerials.length > 0 || newSerial.trim())) return;
                setSerialModalOpen(open);
            }}>
                <DialogContent 
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => {
                        if (tempSerials.length > 0 || newSerial.trim()) e.preventDefault();
                    }}
                    className="max-w-xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl"
                >
                    <div className="bg-primary p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                        <QrCode className="w-4 h-4 text-white" />
                                    </div>
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight m-0">Serial Registration</DialogTitle>
                                </div>
                                <DialogDescription className="text-[10px] font-bold text-white/70 uppercase tracking-widest m-0">
                                    Piece-by-Piece Inventory Tracking
                                </DialogDescription>
                            </div>
                            <Badge variant="outline" className={cn(
                                "border-white/40 text-white font-mono bg-white/10 px-3 py-1",
                                tempSerials.length === orderedLimit && "bg-emerald-500/30 border-emerald-400"
                            )}>
                                {tempSerials.length} / {orderedLimit} REGISTERED
                            </Badge>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-none mb-1">Current Product</span>
                                <span className="text-base font-bold text-slate-900 dark:text-white truncate">{activeProductName}</span>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-none mb-1 text-right">Items</span>
                                <span className="text-sm font-black text-slate-900 dark:text-white">{orderedLimit} Units</span>
                            </div>
                        </div>

                        {orderedLimit !== Infinity && (
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-end text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    <span>Registration Progress</span>
                                    <span className={tempSerials.length === orderedLimit ? "text-emerald-500" : "text-primary"}>
                                        {((tempSerials.length / orderedLimit) * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-all duration-500 ease-out",
                                            tempSerials.length === orderedLimit ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-primary"
                                        )}
                                        style={{ width: `${(tempSerials.length / orderedLimit) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-3">
                                <div className="grid grid-cols-12 gap-3 items-end">
                                    <div className="col-span-5 space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Serial Number</label>
                                        <div className="relative w-full">
                                            <Input
                                                ref={inputRef}
                                                value={newSerial}
                                                onChange={(e) => setNewSerial(e.target.value.toUpperCase())}
                                                onKeyDown={(e) => e.key === "Enter" && addSerial()}
                                                disabled={tempSerials.length >= orderedLimit}
                                                placeholder={tempSerials.length >= orderedLimit ? "Limit Reached" : "Scan/Type..."}
                                                className={cn(
                                                    "h-12 px-4 rounded-xl font-mono text-sm border-2 transition-all shadow-sm uppercase",
                                                    tempSerials.length >= orderedLimit
                                                        ? "border-emerald-500/50 bg-emerald-50/10 cursor-not-allowed"
                                                        : "border-slate-200 dark:border-slate-800 focus-visible:ring-0 focus-visible:border-primary"
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tare (kg)</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={newTare}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") addSerial();
                                                if (["e", "E", "+"].includes(e.key)) e.preventDefault();
                                            }}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                                    setNewTare(val);
                                                }
                                            }}
                                            className="h-12 text-sm font-bold border-2 rounded-xl focus-visible:ring-primary focus-visible:border-primary px-3"
                                        />
                                    </div>
                                    <div className="col-span-4 space-y-1">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Expiry Date</label>
                                        <Input
                                            type="date"
                                            value={newExpiry}
                                            onChange={(e) => setNewExpiry(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && addSerial()}
                                            className="h-12 text-sm font-bold border-2 rounded-xl focus-visible:ring-primary focus-visible:border-primary px-2"
                                        />
                                    </div>
                                </div>

                                <Button 
                                    onClick={addSerial} 
                                    disabled={verifyingSerial || !isPendingValid}
                                    className={cn(
                                        "w-full h-11 rounded-xl font-black uppercase tracking-widest text-[10px] gap-2 shadow-md transition-all active:scale-[0.98]",
                                        !isPendingValid ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800 text-white"
                                    )}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    {verifyingSerial ? "Verifying..." : "Add Registered Piece"}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Registered Pieces</span>
                                {tempSerials.length > 0 && (
                                    <Button
                                        variant="link"
                                        onClick={() => {
                                            setTempSerials([]);
                                            toast.info("Cleared all serials");
                                        }}
                                        className="h-auto p-0 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600"
                                    >
                                        Clear All
                                    </Button>
                                )}
                            </div>
                            <div className="border border-slate-100 dark:border-slate-900 rounded-2xl overflow-hidden shadow-sm">
                                <div className="max-h-48 overflow-y-auto scrollbar-thin">
                                    <Table>
                                        <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableHead className="h-9 text-[10px] font-black uppercase tracking-widest px-4">Serial Number</TableHead>
                                                <TableHead className="h-9 text-[10px] font-black uppercase tracking-widest text-center">Tare</TableHead>
                                                <TableHead className="h-9 text-[10px] font-black uppercase tracking-widest text-center">Expiry</TableHead>
                                                <TableHead className="h-9 w-10"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {tempSerials.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center text-slate-400 text-xs font-medium">
                                                        No serials registered yet
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                tempSerials.map((item, idx) => (
                                                    <TableRow key={idx} className="group border-slate-50 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                                        <TableCell className="py-2 px-4 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                            {item.sn}
                                                        </TableCell>
                                                        <TableCell className="py-2 text-center font-bold text-[10px] text-slate-500">
                                                            {item.tareWeight || "-"}
                                                        </TableCell>
                                                        <TableCell className="py-2 text-center font-bold text-[10px] text-slate-500">
                                                            {item.expiryDate || "-"}
                                                        </TableCell>
                                                        <TableCell className="py-2 px-2 text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                                                                onClick={() => removeSerial(idx)}
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

                    <div className="p-6 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Verification Status</span>
                            <span className="text-sm font-black text-primary uppercase italic">{tempSerials.length > 0 ? "Scanned" : "Awaiting Input"}</span>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={handleCancelSerial} className="rounded-xl px-6 font-black uppercase tracking-widest text-[10px] h-11 border-2">Cancel</Button>
                            <Button 
                                onClick={saveSerials} 
                                disabled={isPartialEntry && !isPendingValid}
                                className={cn(
                                    "rounded-xl px-10 font-black uppercase tracking-widest text-[10px] h-11 shadow-lg",
                                    isPartialEntry && !isPendingValid ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-primary shadow-primary/30"
                                )}
                            >
                                Commit Pieces
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
