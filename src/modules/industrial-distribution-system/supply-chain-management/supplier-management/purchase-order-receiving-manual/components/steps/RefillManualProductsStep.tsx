"use client";
// RefillManualProductsStep.tsx
// Step 3 replacement for Refill PO receiving.
// Removes the "Current Receipt" column.
// Product rows are clickable → opens TaggedSerialsModal to view pre-tagged serials.
// A "Rapid Scan" button opens the RefillRapidScanModal for live scan validation.

import * as React from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useReceivingProductsManual } from "../../providers/ReceivingProductsManualProvider";
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
import { AlertTriangle, Package, ChevronRight, ChevronLeft, Scan, Tag } from "lucide-react";
import { TaggedSerialsModal } from "../TaggedSerialsModal";
import { RefillRapidScanModal } from "../RefillRapidScanModal";

const API_URL = "/api/ids/scm/supplier-management/purchase-order-receiving-manual";

export function RefillManualProductsStep({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
    const {
        selectedPO,
        // Removed unused manualCounts to fix lint warning - AG 2026-06-26
        setManualCounts,
        verifiedProductIds,
        serialsByPorId,
        setSerialsByPorId,
    } = useReceivingProductsManual();

    // ✅ Pagination
    const [receivingPage, setReceivingPage] = React.useState(1);
    const ITEMS_PER_PAGE = 10;

    // ✅ Over-receiving modal state
    const [isOverReceivingModalOpen, setIsOverReceivingModalOpen] = React.useState(false);

    // ✅ Tagged Serials modal state (product row click)
    // Comments: Track client side row id to associate and display local scanned serials inside TaggedSerialsModal.
    const [taggedModalOpen, setTaggedModalOpen] = React.useState(false);
    const [activePorId, setActivePorId] = React.useState<string | null>(null);
    const [activeClientRowId, setActiveClientRowId] = React.useState<string | null>(null);
    const [activeProductName, setActiveProductName] = React.useState("");
    const [activeExpectedQty, setActiveExpectedQty] = React.useState(0);

    // Comments: Memoized list of serials (with sn and isNew flag) scanned during the session for the currently viewed product.
    const activeScannedSerials = React.useMemo(() => {
        if (!activeClientRowId) return [];
        return serialsByPorId[activeClientRowId]?.map(s => ({ sn: s.sn, isNew: s.isNew })) || [];
    }, [activeClientRowId, serialsByPorId]);

    // ✅ Rapid Scan modal state
    const [rapidScanOpen, setRapidScanOpen] = React.useState(false);

    // ✅ Only show verified products
    const filteredItems = React.useMemo(() => {
        const allocs = Array.isArray(selectedPO?.allocations) ? selectedPO!.allocations : [];
        const flattened = allocs.flatMap(a => {
            const items = Array.isArray(a?.items) ? a.items : [];
            return items.map(it => ({
                ...it,
                id: String(it.id),
                branchName: a?.branch?.name ?? "Unassigned",
            }));
        });
        return flattened.filter(it => verifiedProductIds.includes(it.productId));
    }, [selectedPO, verifiedProductIds]);

    // ✅ State to store batch-fetched expected returning serials from DB (purchase_order_serial)
    // Comments: Added to show expected returning serials inline in table rows.
    const [expectedSerials, setExpectedSerials] = React.useState<Record<string, string[]>>({});
    // Removed unused loadingExpected state to fix lint warning - AG 2026-06-26

    // Compute serialized representation of visible product line IDs to trigger batch fetching efficiently
    const porIdsStr = React.useMemo(() => {
        return filteredItems.map(it => it.purchaseOrderProductId).filter(Boolean).sort().join(",");
    }, [filteredItems]);

    // Fetch pre-tagged expected serials from DB for all visible allocations
    React.useEffect(() => {
        if (!porIdsStr) {
            setExpectedSerials({});
            return;
        }

        const porIds = porIdsStr.split(",").map(Number).filter(n => n > 0);
        if (porIds.length === 0) {
            setExpectedSerials({});
            return;
        }

        // Removed setLoadingExpected(true) as loadingExpected state was unused - AG 2026-06-26
        fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get_tagged_serials", porIds }),
        })
            .then(r => r.json())
            .then(j => {
                if (j?.error) throw new Error(j.error);
                const data = Array.isArray(j?.data) ? j.data : [];
                const grouped: Record<string, string[]> = {};
                for (const item of data) {
                    const key = String(item.purchase_order_product_id);
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(item.serial_number);
                }
                setExpectedSerials(grouped);
            })
            .catch(e => {
                console.error("Failed to load expected serials:", e);
                toast.error("Failed to load expected serials");
            });
            // Removed finally block with setLoadingExpected(false) as loadingExpected state was unused - AG 2026-06-26
    }, [porIdsStr]);

    // ✅ Total units captured (sum of serialsByPorId counts)
    const totalEntered = React.useMemo(() => {
        return filteredItems.reduce((sum, it) => {
            const id = String(it.id);
            return sum + (serialsByPorId[id]?.length || 0);
        }, 0);
    }, [filteredItems, serialsByPorId]);

    // ✅ Over-receiving check
    const isOverReceiving = React.useMemo(() => {
        return filteredItems.some(it => {
            const id = String(it.id);
            const expected = Number(it.expectedQty || 0);
            const receivedAtStart = Number(it.receivedQty || 0);
            const current = serialsByPorId[id]?.length || 0;
            return (current + receivedAtStart) > expected && current > 0;
        });
    }, [filteredItems, serialsByPorId]);

    // ✅ Build product lines for the rapid scan modal
    const productLines = React.useMemo(() => {
        return filteredItems.map(it => {
            const id = String(it.id);
            const expected = Math.max(0, Number(it.expectedQty || 0) - Number(it.receivedQty || 0));
            return {
                porId: id,
                purchaseOrderProductId: it.purchaseOrderProductId,
                productId: Number(it.productId),
                productName: it.name,
                branchName: it.branchName ?? "Unassigned",
                expectedQty: expected,
                scannedCount: serialsByPorId[id]?.length || 0,
            };
        });
    }, [filteredItems, serialsByPorId]);

    // ✅ Called by RefillRapidScanModal when a serial is accepted
    // Comments: Supports storing an optional isNew flag to identify newly registered cylinders.
    const handleAddSerial = (porId: string, serial: string, isNew?: boolean) => {
        setSerialsByPorId(prev => {
            const existing = prev[porId] || [];
            // Duplicate guard
            if (existing.some(s => s.sn === serial)) return prev;
            const next = [...existing, { sn: serial, tareWeight: "", expiryDate: "", isNew }];
            setManualCounts(c => ({ ...c, [porId]: next.length }));
            return { ...prev, [porId]: next };
        });
    };

    const handleRemoveSerial = (serial: string) => {
        setSerialsByPorId(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(porId => {
                next[porId] = (next[porId] || []).filter(s => s.sn.toUpperCase() !== serial.toUpperCase());
            });
            // Update manual counts as well
            setManualCounts(c => {
                const nextCounts = { ...c };
                Object.keys(next).forEach(porId => {
                    nextCounts[porId] = next[porId].length;
                });
                return nextCounts;
            });
            return next;
        });
    };

    const handleContinueClick = () => {
        if (totalEntered === 0) {
            toast.error("No items captured", { description: "Please scan cylinders before proceeding." });
            return;
        }
        if (isOverReceiving) {
            setIsOverReceivingModalOpen(true);
        } else {
            onContinue();
        }
    };

    // Comments: Opens the verification modal, tracking both the database ID (activePorId) and client row ID (activeClientRowId)
    const openTaggedModal = (it: typeof filteredItems[0]) => {
        const expected = Math.max(0, Number(it.expectedQty || 0) - Number(it.receivedQty || 0));
        setActivePorId(it.purchaseOrderProductId || null);
        setActiveClientRowId(it.id);
        setActiveProductName(it.name);
        setActiveExpectedQty(expected);
        setTaggedModalOpen(true);
    };

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
    const paginatedItems = filteredItems.slice((receivingPage - 1) * ITEMS_PER_PAGE, receivingPage * ITEMS_PER_PAGE);

    const supplierId = selectedPO?.supplier?.id ? Number(selectedPO.supplier.id) : null;
    const poId = selectedPO?.id ? Number(selectedPO.id) : 0;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* ── Header ── */}
            <div className="shrink-0 flex items-center justify-between mb-4 px-1">
                <div className="flex flex-col gap-0.5">
                    <div className="text-[10px] font-black text-primary uppercase tracking-widest">Step 3: Manual Receipt</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Click a product row to view tagged serials · Rapid Scan to capture</div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Rapid Scan button */}
                    <Button
                        onClick={() => setRapidScanOpen(true)}
                        disabled={filteredItems.length === 0}
                        className="h-8 px-4 rounded-lg font-black uppercase tracking-widest text-[9px] bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25 gap-2"
                    >
                        <Scan className="w-3.5 h-3.5" />
                        Rapid Scan
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        className="h-8 rounded-lg font-black uppercase text-[9px] tracking-widest text-slate-400 hover:text-primary"
                    >
                        <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Change PO
                    </Button>
                </div>
            </div>

            {/* ── Table Card ── */}
            <Card className="flex-1 overflow-hidden shadow-sm border-slate-200 dark:border-slate-800 rounded-xl flex flex-col bg-white dark:bg-slate-950">
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-20">
                            <TableRow className="hover:bg-transparent border-slate-200">
                                <TableHead className="text-[9px] h-10 font-black uppercase tracking-widest text-slate-500 px-4">Product Details</TableHead>
                                <TableHead className="text-[9px] h-10 font-black uppercase tracking-widest text-slate-500">Branch</TableHead>
                                <TableHead className="text-[9px] h-10 font-black uppercase tracking-widest text-center w-24 text-slate-500">Expected</TableHead>
                                <TableHead className="text-[9px] h-10 font-black uppercase tracking-widest text-center w-24 text-slate-500">Prev. Rec.</TableHead>
                                <TableHead className="text-[9px] h-10 font-black uppercase tracking-widest text-center w-44 text-slate-500">Tagged Serials</TableHead>
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
                                paginatedItems.map(it => {
                                    const id = String(it.id);
                                    const scannedCount = serialsByPorId[id]?.length || 0;
                                    const expected = Math.max(0, Number(it.expectedQty || 0) - Number(it.receivedQty || 0));
                                    const receivedAtStart = Number(it.receivedQty || 0);
                                    const isOver = (scannedCount + receivedAtStart) > Number(it.expectedQty || 0) && scannedCount > 0;
                                    const isFull = scannedCount >= expected && expected > 0;

                                    return (
                                        <TableRow
                                            key={id}
                                            // ✅ Entire row is clickable
                                            onClick={() => openTaggedModal(it)}
                                            className={cn(
                                                "border-slate-100 dark:border-slate-900 group transition-colors cursor-pointer",
                                                isOver
                                                    ? "bg-red-50/50 dark:bg-red-500/5"
                                                    : isFull
                                                        ? "bg-emerald-50/40 dark:bg-emerald-900/10 hover:bg-emerald-50/60"
                                                        : "hover:bg-slate-50/50"
                                            )}
                                        >
                                            {/* Product Details */}
                                            <TableCell className="py-3 px-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="font-black text-xs text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors flex items-center gap-2">
                                                        <Package className="w-3 h-3 text-slate-400 shrink-0" />
                                                        {it.name}
                                                        {isOver && <Badge className="bg-red-600 text-[7px] font-black h-3.5 px-1.5 uppercase border-none animate-pulse">Over</Badge>}
                                                        {isFull && !isOver && <Badge className="bg-emerald-500 text-[7px] font-black h-3.5 px-1.5 uppercase border-none">Complete</Badge>}
                                                    </div>
                                                    <div className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
                                                        SKU: {it.barcode} | UOM: {it.uom}
                                                    </div>
                                                    {/* Expected serials list (inline) */}
                                                    {/* Comments: Added to show expected returning serials inline in table rows. */}
                                                    {it.purchaseOrderProductId && expectedSerials[it.purchaseOrderProductId] && expectedSerials[it.purchaseOrderProductId].length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1 max-w-xl">
                                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider self-center mr-1">Expected:</span>
                                                            {expectedSerials[it.purchaseOrderProductId].map(serial => (
                                                                <Badge 
                                                                    key={serial}
                                                                    variant="outline" 
                                                                    className="font-mono text-[8px] font-bold px-1.5 py-0.5 border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-tighter"
                                                                >
                                                                    {serial}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Branch */}
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[8px] font-black uppercase px-2 py-0.5 border-none">
                                                    {it.branchName}
                                                </Badge>
                                            </TableCell>

                                            {/* Expected */}
                                            <TableCell className="text-center font-black text-[10px] text-slate-500">
                                                {expected}
                                            </TableCell>

                                            {/* Prev. Received */}
                                            <TableCell className="text-center font-black text-[10px] text-emerald-600/70">
                                                {receivedAtStart}
                                            </TableCell>

                                            {/* Tagged Serials count badge */}
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Badge
                                                        className={cn(
                                                            "font-black text-[9px] uppercase border-none gap-1",
                                                            scannedCount > 0
                                                                ? isFull
                                                                    ? "bg-emerald-100 text-emerald-700"
                                                                    : "bg-primary/10 text-primary"
                                                                : "bg-slate-100 text-slate-500"
                                                        )}
                                                    >
                                                        <Tag className="w-2.5 h-2.5" />
                                                        {scannedCount > 0 ? `${scannedCount} Scanned` : "View Tags"}
                                                    </Badge>
                                                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-primary transition-colors" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
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

            {/* ── Bottom Action Bar ── */}
            <div className="shrink-0 mt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Units Captured</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-primary leading-none">{totalEntered}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Cylinders</span>
                        </div>
                    </div>
                </div>
                <Button
                    onClick={handleContinueClick}
                    disabled={totalEntered === 0}
                    className={cn(
                        "h-12 px-10 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]",
                        totalEntered === 0
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                            : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
                    )}
                >
                    Proceed to Final Review <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
            </div>

            {/* ── Over-Receiving Confirmation ── */}
            <AlertDialog open={isOverReceivingModalOpen} onOpenChange={setIsOverReceivingModalOpen}>
                <AlertDialogContent className="rounded-2xl border-2">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600 font-black uppercase tracking-tight">
                            <AlertTriangle className="w-5 h-5" /> Over-Receiving Detected
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-bold text-slate-600 uppercase tracking-wider leading-relaxed">
                            Some products exceed the ordered quantity. This will create a discrepancy.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl font-black uppercase tracking-widest text-[10px] border-2">Adjust</AlertDialogCancel>
                        <AlertDialogAction onClick={onContinue} className="bg-red-600 hover:bg-red-700 rounded-xl font-black uppercase tracking-widest text-[10px]">Proceed</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Tagged Serials Modal (read-only, from purchase_order_serial) ── */}
            {/* Comments: Pass the local scanned serials to TaggedSerialsModal for side-by-side reconciliation. */}
            {activePorId && (
                <TaggedSerialsModal
                    open={taggedModalOpen}
                    onClose={() => setTaggedModalOpen(false)}
                    porId={activePorId}
                    productName={activeProductName}
                    expectedQty={activeExpectedQty}
                    scannedSerials={activeScannedSerials}
                    onRemoveSerial={handleRemoveSerial}
                />
            )}

            {/* ── Rapid Scan Modal ── */}
            <RefillRapidScanModal
                open={rapidScanOpen}
                onClose={() => setRapidScanOpen(false)}
                poId={poId}
                supplierId={supplierId}
                lines={productLines}
                onAddSerial={handleAddSerial}
            />
        </div>
    );
}
