"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReceivingProducts } from "../../providers/ReceivingProductsProvider";

export function SelectProductsStep({ onContinue }: { onContinue: () => void }) {
    const {
        selectedPO,
        scannedCountByPorId,
        setScannedCountByPorId
    } = useReceivingProducts();

    // Initialize state from draftData if empty
    React.useEffect(() => {
        if (!selectedPO?.draftData) return;
        if (Object.keys(scannedCountByPorId).length > 0) return; // already initialized

        const initialCounts: Record<string, number> = {};
        selectedPO.draftData.forEach(draft => {
            // Default to receiving all available tagged quantity
            initialCounts[String(draft.porId)] = draft.receivedQuantity;
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
                                <th className="px-4 py-3 font-semibold">Available Qty</th>
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
                                                <span className="inline-flex items-center justify-center rounded-full bg-blue-100 px-2.5 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                                                    {maxQty}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Input 
                                                    type="number" 
                                                    min={0}
                                                    max={maxQty}
                                                    value={currentQty}
                                                    onChange={(e) => handleQuantityChange(porIdStr, e.target.value, maxQty)}
                                                    className="h-8 w-24 text-right"
                                                />
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
                    disabled={draftItems.length === 0}
                >
                    Continue to Details
                </Button>
            </div>
        </div>
    );
}
