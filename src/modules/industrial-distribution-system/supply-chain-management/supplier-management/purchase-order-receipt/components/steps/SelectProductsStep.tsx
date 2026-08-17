"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XCircle } from "lucide-react";
import { useReceivingProducts } from "../../providers/ReceivingProductsProvider";

export function SelectProductsStep({ onContinue }: { onContinue: () => void }) {
    const {
        selectedPO,
        scannedCountByPorId,
        setScannedCountByPorId
    } = useReceivingProducts();

    const [editingIds, setEditingIds] = React.useState<Set<string>>(new Set());

    // Initialize state from draftData if empty
    React.useEffect(() => {
        if (!selectedPO?.draftData) return;
        if (Object.keys(scannedCountByPorId).length > 0) return; // already initialized

        const initialCounts: Record<string, number> = {};
        selectedPO.draftData.forEach(draft => {
            // Default to 0 (unselected) so they show "Select" button initially
            initialCounts[String(draft.porId)] = 0;
        });
        setScannedCountByPorId(initialCounts);
    }, [selectedPO?.draftData, scannedCountByPorId, setScannedCountByPorId]);

    const handleQuantityChange = (porId: string, value: string, maxQty: number) => {
        const parsed = parseInt(value, 10);
        const qty = isNaN(parsed) ? 0 : parsed;
        const clampedQty = Math.max(0, Math.min(qty, maxQty));

        setScannedCountByPorId(prev => ({
            ...prev,
            [porId]: clampedQty
        }));
    };

    const handleContinue = () => {
        onContinue();
    };

    if (!selectedPO) return null;

    const draftItems = selectedPO.draftData || [];

    // Create a mapping to easily find product names and details from allocations
    const productInfoMap = new Map<string, { name: string, barcode: string, branchName: string }>();
    selectedPO.allocations.forEach(alloc => {
        alloc.items.forEach(item => {
            // item.porId could match draft.porId
            productInfoMap.set(String(item.porId), {
                name: item.name,
                barcode: item.barcode,
                branchName: alloc.branch.name
            });
            // fallback by productId and branchId
            productInfoMap.set(`${item.productId}-${alloc.branch.id}`, {
                name: item.name,
                barcode: item.barcode,
                branchName: alloc.branch.name
            });
        });
    });

    return (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Select Products for Receipt</h3>
                    <p className="text-sm text-muted-foreground">
                        The following items have been received and are available to be grouped into a receipt.
                    </p>
                </div>
            </div>

            <Card className="overflow-hidden border">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Product</th>
                                <th className="px-4 py-3 font-semibold">Branch</th>
                                <th className="px-4 py-3 font-semibold">Phys. Tagged</th>
                                <th className="px-4 py-3 font-semibold w-32">Receipt Qty</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {draftItems.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">
                                        No pending received items available. Go to PO Receiving to tag items first.
                                    </td>
                                </tr>
                            ) : (
                                draftItems.map((draft) => {
                                    const porIdStr = String(draft.porId);
                                    let info = productInfoMap.get(porIdStr);
                                    if (!info) info = productInfoMap.get(`${draft.productId}-${draft.branchId}`);

                                    const maxQty = draft.receivedQuantity;
                                    const currentQty = scannedCountByPorId[porIdStr] ?? maxQty;

                                    return (
                                        <tr key={porIdStr} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{info?.name || `Product #${draft.productId}`}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{info?.barcode || 'N/A'}</div>
                                            </td>
                                            <td className="px-4 py-3">{info?.branchName || 'Unknown'}</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center justify-center rounded-full border border-blue-200 text-blue-600 bg-blue-50/50 px-2.5 py-0.5 font-black text-xs">
                                                    {maxQty}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {!editingIds.has(porIdStr) ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingIds(prev => new Set(prev).add(porIdStr));
                                                        }}
                                                        className="h-7 text-[11px] font-semibold px-4 border-primary text-primary hover:bg-primary/10"
                                                    >
                                                        Select
                                                    </Button>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={maxQty}
                                                            value={currentQty || ""}
                                                            onChange={(e) => handleQuantityChange(porIdStr, e.target.value, maxQty)}
                                                            className="h-7 text-xs w-16 text-center px-1"
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                const next = new Set(editingIds);
                                                                next.delete(porIdStr);
                                                                setEditingIds(next);
                                                                handleQuantityChange(porIdStr, "0", maxQty);
                                                            }}
                                                            className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="flex justify-end gap-2 mt-4">
                <Button
                    onClick={handleContinue}
                    disabled={draftItems.length === 0 || !Object.values(scannedCountByPorId).some(qty => qty > 0)}
                >
                    Continue to Details
                </Button>
            </div>
        </div>
    );
}
