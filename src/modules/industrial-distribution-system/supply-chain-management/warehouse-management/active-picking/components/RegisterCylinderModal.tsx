"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConsolidatorDetail } from "../types";

interface RegisterCylinderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    serialNumber: string;
    branchId: number;
    details: ConsolidatorDetail[];
    onSuccess: (productId: number, serialNumber: string) => Promise<boolean>;
}

export function RegisterCylinderModal({
    open,
    onOpenChange,
    serialNumber,
    branchId,
    details,
    onSuccess,
}: RegisterCylinderModalProps) {
    const [productId, setProductId] = useState<string>("");
    const [condition, setCondition] = useState<string>("GOOD");
    const [expirationDate, setExpirationDate] = useState<string>("");
    const [tareWeight, setTareWeight] = useState<string>("");
    const [remarks, setRemarks] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setProductId("");
            setCondition("GOOD");
            setExpirationDate("");
            setTareWeight("");
            setRemarks("");
        }
    }, [open]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!productId) {
            toast.error("Please select a product to associate with this serial number");
            return;
        }

        const selectedDetail = details.find(d => Number(d.product_id) === Number(productId));
        if (selectedDetail && selectedDetail.picked_quantity >= selectedDetail.ordered_quantity) {
            toast.error("Cannot register serial number for an already fulfilled product row.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/ids/scm/warehouse-management/active-picking/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: Number(productId),
                    serial_number: serialNumber,
                    cylinder_condition: condition,
                    current_branch_id: branchId,
                    expiration_date: expirationDate || null,
                    tare_weight: tareWeight ? parseFloat(tareWeight) : null,
                    remarks: remarks || null,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.details || data.error || "Failed to register cylinder");
            }

            toast.success(`Registered ${serialNumber} successfully`);

            // Now automatically pick it for the user
            const pickSuccess = await onSuccess(Number(productId), serialNumber);
            if (pickSuccess) {
                onOpenChange(false);
            }
        } catch (err) {
            const error = err as Error;
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-6 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="pb-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                            <Plus className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">Register Unregistered Cylinder</DialogTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Serial <span className="font-mono font-bold text-primary">{serialNumber}</span> was not found. Please register it.
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleRegister} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="product-select" className="text-xs font-semibold">Associate Product</Label>
                        <Select value={productId} onValueChange={setProductId}>
                            <SelectTrigger id="product-select" className="w-full bg-background">
                                <SelectValue placeholder="Select expected product..." />
                            </SelectTrigger>
                            <SelectContent>
                                {details.map((detail) => {
                                    const isFulfilled = detail.picked_quantity >= detail.ordered_quantity;
                                    return (
                                        <SelectItem 
                                            key={detail.id} 
                                            value={String(detail.product_id)}
                                            disabled={isFulfilled}
                                        >
                                            {detail.product?.product_name || `Product ID: ${detail.product_id}`} ({detail.picked_quantity} / {detail.ordered_quantity}) {isFulfilled ? "[FULFILLED]" : ""}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="condition-select" className="text-xs font-semibold">Condition</Label>
                            <Select value={condition} onValueChange={setCondition}>
                                <SelectTrigger id="condition-select" className="w-full bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GOOD">GOOD</SelectItem>
                                    <SelectItem value="FOR_REPAIR">FOR REPAIR</SelectItem>
                                    <SelectItem value="DAMAGED">DAMAGED</SelectItem>
                                    <SelectItem value="SCRAP">SCRAP</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="tare-weight-input" className="text-xs font-semibold">Tare Weight (KG)</Label>
                            <Input
                                id="tare-weight-input"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={tareWeight}
                                onChange={(e) => setTareWeight(e.target.value)}
                                className="bg-background"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="expiration-date-input" className="text-xs font-semibold">Expiration Date</Label>
                        <Input
                            id="expiration-date-input"
                            type="date"
                            value={expirationDate}
                            onChange={(e) => setExpirationDate(e.target.value)}
                            className="bg-background"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="remarks-input" className="text-xs font-semibold">Remarks</Label>
                        <Input
                            id="remarks-input"
                            type="text"
                            placeholder="Optional remarks..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="bg-background"
                        />
                    </div>

                    <DialogFooter className="pt-4 border-t flex items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="font-semibold">
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Registering...
                                </>
                            ) : (
                                "Register & Pick"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
