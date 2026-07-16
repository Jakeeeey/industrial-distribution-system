/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useReceivingProductsManual } from "../../providers/ReceivingProductsManualProvider";
import { Pencil } from "lucide-react";

const RECEIPT_TYPES = [
    { value: "SI-CHARGE", label: "Charge Sales Invoice [SI-CHARGE]" },
    { value: "SI-CASH", label: "Cash Sales Invoice [SI-CASH]" },
    { value: "DR", label: "Delivery Receipt [DR]" },
];

function statusBadgeClasses(status?: string) {
    const s = String(status || "").toUpperCase();
    if (s === "CLOSED") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20";
    if (s === "PARTIAL") return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/20";
    return "bg-primary/15 text-primary border border-primary/20";
}

export function ReceiptDetailsStep({ onContinue }: { onContinue: () => void }) {
    const {
        selectedPO,
        receiptNo,
        setReceiptNo,
        receiptType,
        setReceiptType,
        receiptDate,
        setReceiptDate,
        setManualCounts,
        setMetaDataByPorId,
        setSerialsByPorId,
        // ✅ Fix 4: Need setReceiptNo and setReceiptDate for EDIT action from reverted history - AG 2026-07-14
    } = useReceivingProductsManual();

    // ✅ Fix 4: Helper to map receipt status to badge styles - AG 2026-07-14
    const receiptStatusBadgeClasses = (status?: string) => {
        const s = String(status || "ACTIVE").toUpperCase();
        if (s === "REVERTED") return "bg-red-100 text-red-700 border border-red-300 font-black";
        if (s === "POSTED") return "bg-primary/10 text-primary border border-primary/30 font-black";
        return "bg-amber-50 text-amber-700 border border-amber-200 font-black"; // ACTIVE = unposted
    };

    const branchesLabel = React.useMemo(() => {
        const allocs = Array.isArray(selectedPO?.allocations) ? selectedPO!.allocations : [];
        const names = allocs
            .map((a) => String(a?.branch?.name || "").trim())
            .filter(Boolean);
        if (!names.length) return "—";
        return Array.from(new Set(names)).join(", ");
    }, [selectedPO]);

    const progress = React.useMemo(() => {
        const allocs = Array.isArray(selectedPO?.allocations) ? selectedPO!.allocations : [];
        const items = allocs.flatMap((a) => (Array.isArray(a?.items) ? a.items : []));
        const totalExpected = items.reduce((acc, it: any) => acc + (Number(it?.expectedQty) || 0), 0);
        const totalReceived = items.reduce((acc, it: any) => acc + (Number(it?.receivedQty) || 0), 0);
        return { totalExpected, totalReceived };
    }, [selectedPO]);

    const receiptHint = React.useMemo(() => {
        if (!selectedPO) return "";
        const { totalExpected, totalReceived } = progress;
        if (totalExpected <= 0) return "";
        if (totalReceived >= totalExpected) return "This PO appears fully received already.";
        if (totalReceived > 0) return "This will be a partial receiving receipt (continuation is allowed).";
        return "This will start manual receiving for this PO.";
    }, [selectedPO, progress]);

    const handleContinue = () => {
        if (!selectedPO) {
            toast.error("Process aborted", { description: "Select a PO first." });
            return;
        }

        const errs: string[] = [];
        if (!receiptNo.trim()) errs.push("Receipt Number is required.");
        if (!receiptType.trim()) errs.push("Receipt Type is required.");
        if (!receiptDate.trim()) errs.push("Receipt Date is required.");

        if (errs.length > 0) {
            toast.error("Required fields missing", {
                description: errs.join(" "),
            });
            return;
        }

        onContinue();
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-4">
                <Card className="p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-primary">Selected PO Details</div>
                        {selectedPO?.status ? (
                            <Badge variant="secondary" className={statusBadgeClasses(selectedPO.status)}>
                                {selectedPO.status}
                            </Badge>
                        ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                        <div className="text-slate-400 font-black uppercase tracking-widest text-[9px]">PO Number</div>
                        <div className="text-right font-bold text-slate-700 dark:text-slate-200">{selectedPO?.poNumber ?? "—"}</div>

                        <div className="text-slate-400 font-black uppercase tracking-widest text-[9px]">Supplier</div>
                        <div className="text-right font-bold text-slate-700 dark:text-slate-200">{selectedPO?.supplier?.name ?? "—"}</div>

                        <div className="text-slate-400 font-black uppercase tracking-widest text-[9px]">Delivery Branches</div>
                        <div className="text-right font-bold text-slate-700 dark:text-slate-200">{branchesLabel}</div>

                        <div className="text-slate-400 font-black uppercase tracking-widest text-[9px]">Receiving Progress</div>
                        <div className="text-right font-bold text-slate-700 dark:text-slate-200">
                            {progress.totalReceived} / {progress.totalExpected}
                        </div>
                    </div>

                    {receiptHint ? (
                        <div className="mt-4 p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-[10px] font-bold text-primary flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                            {receiptHint}
                        </div>
                    ) : null}
                </Card>

                {/* ✅ MERGED: Previous Receipts History */}
                {selectedPO?.history && selectedPO.history.length > 0 && (
                    <Card className="p-4 border-primary/20 bg-primary/5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-primary">
                            Previous Receipts History
                        </div>
                        <div className="mt-3 space-y-2">
                            {selectedPO.history.map((h: any) => (
                                <div
                                    key={h.receiptNo}
                                    className="flex items-center justify-between gap-3 text-[10px] border-b border-primary/10 pb-2 last:border-0 last:pb-0"
                                >
                                    <div className="flex flex-col">
                                        <span className={cn("font-mono font-black", h.isReverted ? "text-red-500 line-through" : "text-primary")}>
                                            {h.receiptNo}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-500">
                                            {h.receiptDate || "N/A"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-500">
                                            {h.itemsCount} {h.itemsCount === 1 ? "item" : "items"}
                                        </span>
                                        {/* ✅ Fix 4: Status-aware badge — ACTIVE, POSTED, or REVERTED - AG 2026-07-14 */}
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[9px] uppercase h-4 px-1 leading-none",
                                                receiptStatusBadgeClasses(h.status)
                                            )}
                                        >
                                            {h.status || (h.isPosted ? "POSTED" : "ACTIVE")}
                                        </Badge>
                                        {/* ✅ Fix 4: EDIT button for REVERTED receipts only — loads data back into form for correction - AG 2026-07-14 */}
                                        {h.isReverted && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-5 px-2 text-[9px] font-black uppercase tracking-widest border border-red-300 text-red-600 hover:bg-red-50 rounded"
                                                onClick={() => {
                                                    const nextCounts: Record<string, number> = {};
                                                    const nextMeta: Record<string, { batchNo?: string; lotNo?: string; lotId?: string; expiryDate?: string }> = {};
                                                    const nextSerials: Record<string, { sn: string; tareWeight?: string; expiryDate?: string; isNew?: boolean }[]> = {};

                                                    for (const item of Array.isArray(h.items) ? h.items : []) {
                                                        const porId = String(item?.porId || "");
                                                        if (!porId) continue;
                                                        nextCounts[porId] = Number(item?.quantity || 0);
                                                        nextMeta[porId] = {
                                                            lotNo: String(item?.lotNo || ""),
                                                            lotId: String(item?.lotNo || ""),
                                                            batchNo: String(item?.batchNo || ""),
                                                            expiryDate: String(item?.expiryDate || ""),
                                                        };

                                                        const serials = Array.isArray(item?.serials) ? item.serials : [];
                                                        if (serials.length > 0) {
                                                            nextSerials[porId] = serials
                                                                .map((serial: any) => ({
                                                                    sn: String(serial?.sn || "").toUpperCase(),
                                                                    tareWeight: String(serial?.tareWeight || ""),
                                                                    expiryDate: String(serial?.expiryDate || ""),
                                                                    isNew: true,
                                                                }))
                                                                .filter((serial: { sn: string }) => serial.sn);
                                                            nextCounts[porId] = nextSerials[porId].length;
                                                        }
                                                    }

                                                    setReceiptNo(h.receiptNo);
                                                    setReceiptDate(h.receiptDate || "");
                                                    setReceiptType("");
                                                    setManualCounts(nextCounts);
                                                    setMetaDataByPorId(nextMeta);
                                                    setSerialsByPorId(nextSerials);
                                                    toast.info("Editing Reverted Receipt", {
                                                        description: `Loaded ${h.receiptNo} for correction. Update quantities and re-submit.`,
                                                    });
                                                }}
                                            >
                                                <Pencil className="w-2.5 h-2.5 mr-1" /> EDIT
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <Card className="p-4 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-primary">Receipt Details</div>
                    <div className="mt-1 text-[10px] font-bold text-slate-400">
                        Create receipt first, then continue to product verification.
                    </div>

                    <div className="mt-4 grid gap-4">
                        <div className="grid gap-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Receipt Number *</Label>
                            <Input 
                                value={receiptNo} 
                                onChange={(e) => setReceiptNo(e.target.value)} 
                                placeholder="Enter receipt number" 
                                className="h-10 text-sm font-bold border-2 rounded-xl focus-visible:border-primary focus-visible:ring-0"
                            />
                        </div>

                        <div className="grid gap-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Receipt Type *</Label>
                            <Select value={receiptType} onValueChange={setReceiptType}>
                                <SelectTrigger className="h-10 text-sm font-bold border-2 rounded-xl focus:border-primary focus:ring-0">
                                    <SelectValue placeholder="Select type..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-2 shadow-xl">
                                    {RECEIPT_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value} className="text-xs font-bold py-2.5">
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Receipt Date *</Label>
                            <Input
                                type="date"
                                value={receiptDate}
                                onChange={(e) => setReceiptDate(e.target.value)}
                                className="h-10 text-sm font-bold border-2 rounded-xl focus-visible:border-primary focus-visible:ring-0"
                            />
                        </div>
                    </div>
                </Card>
            </div>

            <div className="pt-4 shrink-0 border-t mt-4">
                <Button 
                    type="button" 
                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.98]" 
                    onClick={handleContinue}
                >
                    Continue Product Verification
                </Button>
            </div>
        </div>
    );
}
