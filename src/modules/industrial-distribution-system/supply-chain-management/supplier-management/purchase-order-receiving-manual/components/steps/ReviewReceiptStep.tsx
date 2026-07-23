"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, QrCode, CheckCircle2 } from "lucide-react";
import { useReceivingProductsManual, ReceivingPOItem, ReceiptSavedInfo } from "../../providers/ReceivingProductsManualProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ReceiptPreviewModal } from "../ReceiptPreviewModal";
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

const formatPHP = (val: number) =>
    new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
    }).format(val || 0);

export function ReviewReceiptStep({ onBack, receiverName }: { onBack: () => void; receiverName?: string }) {
    const {
        selectedPO,
        manualCounts,
        saveReceipt,
        savingReceipt,
        saveError,
        receiptSaved,
        setMetaDataByPorId,
        serialsByPorId,
    } = useReceivingProductsManual();

    const [clientSaveError, setClientSaveError] = React.useState("");
    const [expiryDates, setExpiryDates] = React.useState<Record<string, string>>({});
    const [previewOpen, setPreviewOpen] = React.useState(false);
    const [isPartialModalOpen, setIsPartialModalOpen] = React.useState(false);
    const [reviewPage, setReviewPage] = React.useState(1);
    const [showErrors, setShowErrors] = React.useState(false);

    const { metaDataByPorId: draftMetaData } = useReceivingProductsManual();

    // Initial Sync from PO data and Context Draft
    React.useEffect(() => {
        const newExpiries: Record<string, string> = {};
        let syncReady = true;

        if (selectedPO?.allocations) {
            selectedPO.allocations.forEach(a => {
                a.items.forEach((it: ReceivingPOItem) => {
                    const porId = String(it.id);
                    if (it.expiry_date) newExpiries[porId] = it.expiry_date;
                });
            });
        }

        // Overlay draft data (crucial for reloading page)
        if (draftMetaData) {
            Object.entries(draftMetaData).forEach(([porId, meta]) => {
                if (meta.expiryDate) newExpiries[porId] = meta.expiryDate;
            });
        }

        if (syncReady) {
            setExpiryDates(prev => ({ ...newExpiries, ...prev }));
        }
        return () => { syncReady = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPO?.id]); // Only run when PO context changes to avoid mapping loop

    // Update context whenever local changes
    React.useEffect(() => {
        const metaData: Record<string, { lotNo: string; batchNo?: string; expiryDate: string }> = {};
        let hasData = false;
        
        Object.keys(expiryDates).forEach(id => {
            metaData[id] = { 
                lotNo: "", 
                batchNo: "",
                expiryDate: expiryDates[id] || "" 
            };
            hasData = true;
        });

        if (hasData) {
            setMetaDataByPorId(metaData);
        }
    }, [expiryDates, setMetaDataByPorId]);

    React.useEffect(() => {
        if (!receiptSaved) return;
        toast.success(`Receipt ${receiptSaved.receiptNo} saved successfully.`);
        setClientSaveError("");
    }, [receiptSaved]);

    const safeCounts: Record<string, number> = React.useMemo(() => manualCounts || {}, [manualCounts]);

    const allItems = React.useMemo(() => {
        const allocs = Array.isArray(selectedPO?.allocations) ? selectedPO!.allocations : [];
        return allocs.flatMap((a) => {
            const items = Array.isArray(a?.items) ? a.items : [];
            return items
                .map((it: ReceivingPOItem) => ({
                    ...it,
                    id: String(it.id),
                    branchName: a?.branch?.name ?? "Unassigned",
                })) as Array<ReceivingPOItem & { branchName: string }>;
        });
    }, [selectedPO]);

    const executeSave = async () => {
        const metaData: Record<string, { lotNo: string; batchNo?: string; expiryDate: string }> = {};
        Object.keys(expiryDates).forEach(id => {
            metaData[id] = { 
                lotNo: "", 
                batchNo: "",
                expiryDate: expiryDates[id] || "" 
            };
        });
        await saveReceipt(metaData);
        setIsPartialModalOpen(false);
    };

    const handleSaveReceipt = React.useCallback(async () => {
        const status = (selectedPO?.status || "").toUpperCase();
        if (status === "CLOSED" || status === "RECEIVED") {
            setClientSaveError("PO is already completed.");
            return;
        }

        const missingLotOrExpiry: string[] = [];
        allItems.forEach((it: ReceivingPOItem) => {
            const porId = String(it.id);
            const count = safeCounts[porId] ?? 0;
            if (count > 0 && !it.isSerialized) {
                const exp = expiryDates[porId] || "";
                if (!exp.trim()) missingLotOrExpiry.push(it.name);
            }
        });

        if (missingLotOrExpiry.length > 0) {
            setShowErrors(true);
            toast.error("Required Fields Missing", {
                description: "Expiry Date is required for all items with entered quantities."
            });
            return;
        }

        // Check if any count is entered
        const hasAnyCounts = allItems.some((it: ReceivingPOItem) => {
            const porId = String(it.id);
            return (safeCounts[porId] ?? 0) > 0;
        });
        if (!hasAnyCounts) {
            setClientSaveError("Please enter at least 1 quantity before saving.");
            return;
        }

        setClientSaveError("");

        // ✅ Check if Incomplete
        const isPartial = allItems.some((it: ReceivingPOItem) => {
            const porId = String(it.id);
            const count = safeCounts[porId] ?? 0;
            const expected = Number(it.expectedQty || 0);
            return count < expected;
        });

        if (isPartial) {
            setIsPartialModalOpen(true);
            return;
        }

        const metaData: Record<string, { lotNo: string; batchNo?: string; expiryDate: string }> = {};
        Object.keys(expiryDates).forEach(id => {
            metaData[id] = { 
                lotNo: "", 
                batchNo: "",
                expiryDate: expiryDates[id] || "" 
            };
        });

        await saveReceipt(metaData);
    }, [saveReceipt, selectedPO?.status, allItems, safeCounts, expiryDates]);

    const totalEntered = Object.values(safeCounts).reduce((a: number, b: number) => a + Number(b), 0);
    const totalExpected = allItems.reduce((a: number, b: ReceivingPOItem) => a + Number(b.expectedQty || 0), 0);

    const financials = React.useMemo(() => {
        let gross = 0;
        let discount = 0;

        allItems.forEach((it: ReceivingPOItem) => {
            const porId = String(it.id);
            const count = safeCounts[porId] ?? 0;
            const price = Number(it.unitPrice || 0);
            const discAmt = Number(it.discountAmount || 0);

            gross += (count * price);
            discount += (count * discAmt);
        });

        const net = Math.max(0, gross - discount);
        const priceType = selectedPO?.priceType || "VAT Inclusive";
        const isExclusive = priceType.toUpperCase() === "VAT EXCLUSIVE";

        let vatAmount = 0;
        let whtAmount = 0;
        let grandTotal = 0;

        if (isExclusive) {
            vatAmount = net * 0.12;
            whtAmount = net * 0.01;
            grandTotal = net;
        } else {
            // VAT Inclusive
            const vatableAmount = net / 1.12;
            vatAmount = net - vatableAmount;
            whtAmount = vatableAmount * 0.01;
            grandTotal = net;
        }

        return { gross, discount, net, vatAmount, whtAmount, grandTotal, isExclusive };
    }, [allItems, safeCounts, selectedPO?.priceType]);

    const previewData = React.useMemo<ReceiptSavedInfo>(() => {
        if (receiptSaved) return { ...receiptSaved, receiverName };
        return {
            poId: selectedPO?.id || "",
            receiptNo: "PREVIEW",
            receiptDate: "PREVIEW",
            receiptType: "PREVIEW",
            isFullyReceived: totalEntered >= totalExpected,
            savedAt: 0,
            receiverName,
            items: allItems.map(it => ({
                name: it.name,
                barcode: it.barcode,
                productId: it.productId || "",
                uom: it.uom || "",
                unitPrice: Number(it.unitPrice) || 0,
                discountAmount: Number(it.discountAmount) || 0,
                batchNo: "",
                lotId: "",
                expiryDate: expiryDates[String(it.id)] || "",
                expectedQty: Number(it.expectedQty) || 0,
                receivedQtyAtStart: 0,
                receivedQtyNow: safeCounts[String(it.id)] ?? 0,
                rfids: serialsByPorId[String(it.id)] || []
            }))
        };
    }, [receiptSaved, receiverName, selectedPO, totalEntered, totalExpected, allItems, expiryDates, safeCounts, serialsByPorId]);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* ✅ Fix: ReceiptPreviewModal rendered unconditionally so Print Receipt works in both pre and post-save states - AG 2026-07-14 */}
            {previewOpen && (
                <ReceiptPreviewModal
                    isOpen={previewOpen}
                    onClose={() => setPreviewOpen(false)}
                    data={previewData}
                    poNumber={selectedPO?.poNumber || "N/A"}
                    supplierName={selectedPO?.supplier?.name || "N/A"}
                    priceType={selectedPO?.priceType || "VAT Inclusive"}
                    isInvoice={!!((receiptSaved as ReceiptSavedInfo | null)?.isInvoice ?? selectedPO?.isInvoice)}
                />
            )}

            {receiptSaved ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border-2 border-emerald-500/20">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800 dark:text-white mb-2">Receipt Saved Successfully!</h3>
                    <p className="text-sm text-slate-500 font-bold max-w-md mb-8 uppercase tracking-wider">
                        You have successfully received items for {selectedPO?.poNumber}. The inventory has been updated.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                        <Button onClick={() => window.location.reload()} variant="outline" className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] border-2">Start New Session</Button>
                        <Button onClick={() => setPreviewOpen(true)} className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] bg-primary shadow-lg shadow-primary/20">Print Receipt</Button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="shrink-0 flex items-center justify-between mb-4 px-1">
                        <div className="flex flex-col gap-0.5">
                            <div className="text-[10px] font-black text-primary uppercase tracking-widest">Final Review & Details</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Review items before finalizing receipt</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 rounded-lg font-black uppercase text-[9px] tracking-widest text-slate-400 hover:text-primary">
                            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back to Entry
                        </Button>
                    </div>

                    <Card className="flex-1 overflow-hidden shadow-sm border-slate-200 dark:border-slate-800 rounded-xl flex flex-col">
                        <div className="flex-1 overflow-y-auto scrollbar-thin">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-20">
                                    <TableRow className="hover:bg-transparent border-slate-200">
                                        <TableHead className="text-[9px] h-9 font-black uppercase tracking-widest text-slate-500 px-4">Product Details</TableHead>
                                        <TableHead className="text-[9px] h-9 font-black uppercase tracking-widest text-slate-500">Expiry</TableHead>
                                        <TableHead className="text-[9px] h-9 font-black uppercase tracking-widest text-right text-slate-500">Price</TableHead>
                                        <TableHead className="text-[9px] h-9 font-black uppercase tracking-widest text-center w-20 text-slate-500">Qty</TableHead>
                                        <TableHead className="text-[9px] h-9 font-black uppercase tracking-widest text-right px-4 text-slate-500">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        const PAGE_SIZE = 10;
                                        const paginatedItems = allItems.slice((reviewPage - 1) * PAGE_SIZE, reviewPage * PAGE_SIZE);
                                        return paginatedItems.map((it: ReceivingPOItem) => {
                                            const porId = String(it.id);
                                            const count = (manualCounts[porId] || 0);
                                            const expected = Number(it.expectedQty || 0);
                                            const receivedAtStart = Number(it.receivedQty || 0);
                                            const unitP = Number(it.unitPrice || 0);
                                            const discA = Number(it.discountAmount || 0);
                                            const effectivePrice = Math.max(0, unitP - discA);
                                            const lineTotal = count * effectivePrice;
                                            const isOver = (count + receivedAtStart) > expected && count > 0;

                                            return (
                                                <TableRow key={porId} className={cn(
                                                    "border-slate-100 dark:border-slate-900 group",
                                                    isOver ? "bg-red-50/30 dark:bg-red-500/5" : "hover:bg-slate-50/50"
                                                )}>
                                                    <TableCell className="py-3 px-4">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="font-black text-xs text-slate-700 dark:text-slate-200">
                                                                {it.name}
                                                                {isOver && <Badge className="ml-2 bg-red-600 text-[6px] font-black h-3.5 px-1 uppercase border-none">Over</Badge>}
                                                            </div>
                                                            <div className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">SKU: {it.barcode} | UOM: {it.uom}</div>
                                                            {it.isSerialized && (
                                                                <div className="mt-2 flex flex-wrap gap-1">
                                                                    {(serialsByPorId[porId] || []).map((sns, i) => (
                                                                        <div key={i} className="flex items-center bg-slate-100/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 gap-1.5">
                                                                            <span className="text-[8px] font-mono font-black text-slate-700 dark:text-slate-200 uppercase">{sns.sn}</span>
                                                                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter border-l pl-1.5 border-slate-200 dark:border-slate-700">{sns.tareWeight}kg</span>
                                                                        </div>
                                                                    ))}
                                                                    {(serialsByPorId[porId] || []).length === 0 && (
                                                                        <span className="text-[9px] text-red-500 font-black uppercase tracking-tighter flex items-center gap-1">
                                                                            <QrCode className="w-2.5 h-2.5" /> Missing Serials
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        {it.isSerialized ? (
                                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Serial-Linked</span>
                                                        ) : (
                                                            <Input 
                                                                type="date" 
                                                                className={cn(
                                                                    "h-7 text-[10px] font-bold border-2 rounded-lg w-32 focus-visible:border-primary focus-visible:ring-0",
                                                                    showErrors && count > 0 && !(expiryDates[porId] || "").trim() && "border-red-500"
                                                                )}
                                                                value={expiryDates[porId] || ""} 
                                                                onChange={(e) => setExpiryDates(prev => ({ ...prev, [porId]: e.target.value }))} 
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-[10px] text-slate-600">{formatPHP(unitP)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge className={cn("h-5 px-2 font-black text-[10px]", isOver ? "bg-red-500" : "bg-primary")}>
                                                            {count}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-black text-xs px-4">{formatPHP(lineTotal)}</TableCell>
                                                </TableRow>
                                            );
                                        });
                                    })()}
                                </TableBody>
                            </Table>
                        </div>
                        
                        {allItems.length > 10 && (
                            <div className="shrink-0 p-3 bg-slate-50 dark:bg-slate-900 border-t flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    Page {reviewPage} of {Math.ceil(allItems.length / 10)}
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="h-7 rounded-lg font-black uppercase text-[9px] tracking-widest px-3" onClick={() => setReviewPage(p => Math.max(1, p - 1))} disabled={reviewPage === 1}>
                                        <ChevronLeft className="w-3 h-3 mr-1" /> Prev
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 rounded-lg font-black uppercase text-[9px] tracking-widest px-3" onClick={() => setReviewPage(p => Math.min(Math.ceil(allItems.length / 10), p + 1))} disabled={reviewPage === Math.ceil(allItems.length / 10)}>
                                        Next <ChevronRight className="w-3 h-3 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>

                    {(clientSaveError || saveError) && (
                        <div className="mt-4 p-2 bg-red-50 text-red-600 text-[10px] font-black uppercase text-center border-2 border-red-200 rounded-xl">
                            {clientSaveError || saveError}
                        </div>
                    )}

                    <div className="shrink-0 mt-4 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: "Subtotal", val: financials.gross, color: "text-slate-500" },
                                { label: "Discounts", val: financials.discount, color: "text-red-500" },
                                { label: "VAT Amount", val: financials.vatAmount, color: "text-slate-500" },
                                { label: "Grand Total", val: financials.grandTotal, color: "text-primary", bold: true },
                            ].map((fin, i) => (
                                <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 flex flex-col gap-0.5">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{fin.label}</span>
                                    <span className={cn("text-xs font-black", fin.color)}>{formatPHP(fin.val)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] border-2"
                                onClick={() => setPreviewOpen(true)}
                            >
                                Preview Receipt
                            </Button>
                            <Button
                                className="flex-[2] h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
                                onClick={handleSaveReceipt}
                                disabled={savingReceipt}
                            >
                                {savingReceipt ? "Processing..." : "Finalize & Save Receipt"}
                            </Button>
                        </div>
                    </div>

                    {/* ✅ Modal moved to top-level render; no duplicate needed here - AG 2026-07-14 */}

                    {/* ✅ Partial Receipt Confirmation Modal */}
                    <AlertDialog open={isPartialModalOpen} onOpenChange={setIsPartialModalOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Incomplete Receiving</AlertDialogTitle>
                                <AlertDialogDescription>
                                    The receiving of this PO is incomplete. To proceed is to make this PO a partial receipt.
                                    Do you want to continue?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={executeSave} className="bg-indigo-600 hover:bg-indigo-700">
                                    Proceed as Partial
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </div>
    );
}
