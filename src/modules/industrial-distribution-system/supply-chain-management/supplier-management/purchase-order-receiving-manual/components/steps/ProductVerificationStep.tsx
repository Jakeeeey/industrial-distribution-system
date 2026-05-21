"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useReceivingProductsManual } from "../../providers/ReceivingProductsManualProvider";
import { AddExtraProductModal } from "../AddExtraProductModal";
import { cn } from "@/lib/utils";

export function ProductVerificationStep({ onContinue }: { onContinue: () => void }) {
    const {
        selectedPO,
        verifiedProductIds,
        toggleProductVerification,
        removeExtraProductLocally
    } = useReceivingProductsManual();

    const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);

    const allItems = React.useMemo(() => {
        const allocs = Array.isArray(selectedPO?.allocations) ? selectedPO!.allocations : [];
        return allocs.flatMap((a) => {
            const items = Array.isArray(a?.items) ? a.items : [];
            return items.map((it) => ({
                ...it,
                id: String(it.id),
                branchName: a?.branch?.name ?? "Unassigned",
            }));
        });
    }, [selectedPO]);

    const canContinue = verifiedProductIds.length > 0;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <AddExtraProductModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
            
            <div className="shrink-0 space-y-4 mb-4">
                <Card className="p-4 border-primary/20 shadow-sm bg-primary/5">
                    <div className="flex flex-col items-center justify-center py-2 gap-2">
                        <div className="text-center space-y-1">
                            <div className="text-base font-black uppercase tracking-[0.2em] text-primary">
                                Phase 02: Product Checklist
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 max-w-[500px] uppercase tracking-wider">
                                Verify received products and add extra items if necessary.
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col gap-0.5">
                        <div className="text-[10px] font-black text-primary uppercase tracking-widest">Expected Products</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Check items to proceed to quantities</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-[9px] font-black uppercase tracking-widest gap-1.5 border-primary/20 hover:border-primary hover:bg-primary/5 rounded-lg"
                            onClick={() => setIsAddModalOpen(true)}
                        >
                            <Plus className="h-3 w-3" /> Add Extra
                        </Button>
                        <Badge variant="secondary" className="font-black text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                            {verifiedProductIds.length} / {allItems.length}
                        </Badge>
                    </div>
                </div>
            </div>

            <Card className="flex-1 overflow-hidden shadow-sm border-slate-200 dark:border-slate-800 rounded-xl flex flex-col">
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-20">
                            <TableRow className="hover:bg-transparent border-slate-200">
                                <TableHead className="text-[9px] h-9 font-black uppercase tracking-widest text-slate-500 px-4">Product / SKU</TableHead>
                                <TableHead className="text-[9px] h-9 font-black uppercase tracking-widest text-center w-24 text-slate-500">Ordered</TableHead>
                                <TableHead className="text-[9px] h-9 font-black uppercase tracking-widest text-center w-32 text-slate-500">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-48 text-center text-slate-400 italic text-xs font-bold">
                                        No items found. Click &quot;Add Extra&quot; to begin.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                allItems.map((item) => {
                                    const isVerified = verifiedProductIds.includes(item.productId);
                                    return (
                                        <TableRow key={item.id} className={cn(
                                            "transition-colors border-slate-100 dark:border-slate-900 group",
                                            isVerified ? "bg-emerald-50/20 dark:bg-emerald-500/5" : "hover:bg-slate-50/50"
                                        )}>
                                            <TableCell className="py-3 px-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="font-black text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                                        {item.name}
                                                        {item.isExtra && <Badge className="text-[7px] bg-amber-500 text-white border-none uppercase font-black px-1 h-3.5">Extra</Badge>}
                                                    </div>
                                                    <div className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">SKU: {item.barcode}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-black text-xs text-slate-600">
                                                {item.expectedQty}
                                            </TableCell>
                                            <TableCell className="py-2 px-2">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        variant={isVerified ? "default" : "outline"}
                                                        className={cn(
                                                            "h-7 text-[9px] font-black uppercase tracking-widest px-3 transition-all rounded-lg",
                                                            isVerified ? "bg-emerald-500 hover:bg-emerald-600 border-none shadow-sm shadow-emerald-500/20" : "border-slate-200 dark:border-slate-800 hover:border-primary hover:bg-primary/5"
                                                        )}
                                                        onClick={() => toggleProductVerification(item.productId)}
                                                    >
                                                        {isVerified ? (
                                                            <><CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Checked</>
                                                        ) : (
                                                            "Verify"
                                                        )}
                                                    </Button>
                                                    
                                                    {item.isExtra && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                            onClick={() => removeExtraProductLocally(item.productId)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <div className="pt-4 shrink-0 border-t mt-4">
                <Button
                    className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.98] gap-2"
                    onClick={onContinue}
                    disabled={!canContinue}
                >
                    Continue to Quantities
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
