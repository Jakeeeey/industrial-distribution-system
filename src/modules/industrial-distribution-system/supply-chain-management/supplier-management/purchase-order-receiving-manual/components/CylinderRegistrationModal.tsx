"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Box, X, CheckCircle2, AlertCircle } from "lucide-react";

const API_URL = "/api/ids/scm/supplier-management/purchase-order-receiving-manual";

interface CylinderRegistrationModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (serialNumber: string) => void;
    serialNumber: string;
    productId: string | number;
    currentBranchId?: string | number;
    userId?: string | number;
    productName: string;
}

export function CylinderRegistrationModal({ 
    open, onClose, onSuccess, serialNumber, productId, currentBranchId, userId, productName 
}: CylinderRegistrationModalProps) {
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const [tareWeight, setTareWeight] = React.useState("");
    const [expiryDate, setExpiryDate] = React.useState("");

    // Reset state on open
    React.useEffect(() => {
        if (open) {
            setTareWeight("");
            setExpiryDate("");
            setError("");
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        
        if (!tareWeight || !expiryDate) {
            setError("Tare Weight and Expiration Date are mandatory.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "register_serial",
                    serialNumber,
                    tareWeight: tareWeight || undefined,
                    expiryDate: expiryDate || undefined,
                    currentBranchId,
                    productId,
                    userId
                })
            });
            const data = await res.json();
            if (data?.error) throw new Error(data.error);

            // Registration successful!
            onSuccess(serialNumber);
            onClose();
        } catch (err: unknown) {
            setError((err as Error).message || "An error occurred during registration.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent 
                showCloseButton={false}
                className="!max-w-[450px] !w-[95vw] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-background"
                onPointerDownOutside={() => onClose()}
            >
                {/* Header */}
                <div className="relative bg-primary p-6 text-white overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="relative z-10 flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                    <Box className="w-4 h-4 text-white" />
                                </div>
                                <DialogTitle className="text-lg font-black uppercase tracking-tight m-0">
                                    Register Cylinder
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-[10px] font-bold text-white/75 uppercase tracking-widest mt-1.5 m-0 truncate max-w-[300px]">
                                {productName}
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Form Body */}
                <div className="p-6">
                    {error && (
                        <div className="mb-6 rounded-xl bg-destructive/10 border border-destructive/20 p-4 flex items-start gap-3">
                            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                            <div className="text-xs font-medium text-destructive">{error}</div>
                        </div>
                    )}

                    <form id="cylinder-registration-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Serial Number</Label>
                            <Input 
                                value={serialNumber} 
                                readOnly 
                                disabled
                                className="bg-muted font-mono font-bold"
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tare Weight <span className="text-red-500">*</span></Label>
                            <Input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0.00"
                                value={tareWeight}
                                onChange={(e) => setTareWeight(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Expiration Date <span className="text-red-500">*</span></Label>
                            <Input 
                                type="date" 
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-4 bg-muted/20 border-t border-border/50 flex justify-end gap-3">
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={onClose} 
                        disabled={loading}
                        className="rounded-xl"
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        form="cylinder-registration-form" 
                        disabled={loading}
                        className="rounded-xl shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Register
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
