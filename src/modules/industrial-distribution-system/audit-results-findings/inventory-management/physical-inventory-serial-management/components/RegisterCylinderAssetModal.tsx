"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createCylinderAssetsBulk } from "../providers/fetchProvider";
import { toast } from "sonner";
import type { CylinderAssetUpsertPayload } from "../types";

type Props = {
    open: boolean;
    serials: string[];
    productId: number | null;
    branchId: number | null;
    onOpenChange: (open: boolean) => void;
    onSuccess: (serials: string[]) => void;
    onClear?: () => void;
};

export function RegisterCylinderAssetModal(props: Props) {
    const { open, serials, productId, branchId, onOpenChange, onSuccess, onClear } = props;

    // individual row states
    const [rows, setRows] = React.useState<Record<string, {
        condition: CylinderAssetUpsertPayload["cylinder_condition"];
        expirationDate: string;
        tareWeight: string;
    }>>({});

    // undo history (stores the previous rows state)
    const [history, setHistory] = React.useState<typeof rows | null>(null);

    // bulk apply states
    const [bulkCondition, setBulkCondition] = React.useState<CylinderAssetUpsertPayload["cylinder_condition"]>("GOOD");
    const [bulkExpiration, setBulkExpiration] = React.useState("");
    const [bulkTare, setBulkTare] = React.useState("");

    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            const initialRows: typeof rows = {};
            serials.forEach(s => {
                initialRows[s] = {
                    condition: "GOOD",
                    expirationDate: "",
                    tareWeight: "",
                };
            });
            setRows(initialRows);
            setHistory(null);
            setBulkCondition("GOOD");
            setBulkExpiration("");
            setBulkTare("");
        }
    }, [open, serials]);

    const applyBulkField = (field: "condition" | "expirationDate" | "tareWeight") => {
        // Save current state to history for undo
        setHistory({ ...rows });

        const nextRows = { ...rows };
        serials.forEach(s => {
            const value = field === "condition" ? bulkCondition : 
                          field === "expirationDate" ? bulkExpiration : 
                          bulkTare;
            
            nextRows[s] = {
                ...nextRows[s],
                [field]: value,
            };
        });
        setRows(nextRows);
        toast.info(`Applied ${field} to all rows.`);
    };

    const undoBulk = () => {
        if (history) {
            setRows(history);
            setHistory(null);
            toast.info("Bulk action undone.");
        }
    };

    const updateRow = (serial: string, field: keyof typeof rows[string], value: string) => {
        setRows(prev => ({
            ...prev,
            [serial]: {
                ...prev[serial],
                [field]: value,
            }
        }));
    };

    const handleSave = async () => {
        if (!productId || !branchId) {
            toast.error("Required context (Product/Branch) is missing.");
            return;
        }

        if (serials.length === 0) return;

        try {
            setIsSaving(true);
            
            const payloads: CylinderAssetUpsertPayload[] = serials.map((serial) => {
                const data = rows[serial];
                return {
                    product_id: productId,
                    serial_number: serial,
                    cylinder_status: "AVAILABLE",
                    cylinder_condition: data?.condition ?? "GOOD",
                    current_branch_id: branchId,
                    expiration_date: data?.expirationDate ? data.expirationDate : null,
                    tare_weight: data?.tareWeight ? parseFloat(data.tareWeight) : null,
                };
            });

            await createCylinderAssetsBulk(payloads);
            toast.success(`${serials.length} cylinder assets registered.`);
            onSuccess(serials);
            onOpenChange(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to register assets.";
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-[850px] max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle>Bulk Register Cylinders</DialogTitle>
                            <DialogDescription>
                                Apply specific fields to all <span className="font-bold text-primary">{serials.length}</span> serials.
                            </DialogDescription>
                        </div>
                        {history && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 border-amber-500 text-amber-600 hover:bg-amber-50"
                                onClick={undoBulk}
                            >
                                <Loader2 className="mr-2 h-3 w-3 rotate-180" />
                                Undo Last Apply
                            </Button>
                        )}
                    </div>
                </DialogHeader>
                
                <div className="flex-1 overflow-hidden flex flex-col gap-4 px-6 py-4">
                    {/* Granular Bulk Actions */}
                    <div className="bg-muted/30 p-3 rounded-xl border grid grid-cols-3 gap-4 shrink-0">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-muted-foreground font-black flex items-center justify-between">
                                Bulk Condition
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-4 px-1 text-[9px] hover:bg-primary/10 hover:text-primary"
                                    onClick={() => applyBulkField("condition")}
                                >
                                    Apply to All
                                </Button>
                            </Label>
                            <Select value={bulkCondition} onValueChange={(v: CylinderAssetUpsertPayload["cylinder_condition"]) => setBulkCondition(v)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GOOD">GOOD</SelectItem>
                                    <SelectItem value="FOR_REPAIR">FOR_REPAIR</SelectItem>
                                    <SelectItem value="DAMAGED">DAMAGED</SelectItem>
                                    <SelectItem value="SCRAP">SCRAP</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-muted-foreground font-black flex items-center justify-between">
                                Bulk Expiration
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-4 px-1 text-[9px] hover:bg-primary/10 hover:text-primary"
                                    onClick={() => applyBulkField("expirationDate")}
                                >
                                    Apply to All
                                </Button>
                            </Label>
                            <Input 
                                type="date" 
                                className="h-8 text-xs" 
                                value={bulkExpiration}
                                onChange={(e) => setBulkExpiration(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-muted-foreground font-black flex items-center justify-between">
                                Bulk Tare (KG)
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-4 px-1 text-[9px] hover:bg-primary/10 hover:text-primary"
                                    onClick={() => applyBulkField("tareWeight")}
                                >
                                    Apply to All
                                </Button>
                            </Label>
                            <Input 
                                type="number" 
                                placeholder="0.00" 
                                className="h-8 text-xs" 
                                value={bulkTare}
                                onChange={(e) => setBulkTare(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Individual Rows Table */}
                    <div className="border rounded-xl flex-1 overflow-auto bg-background">
                        <table className="w-full text-xs border-collapse">
                            <thead className="sticky top-0 bg-muted/50 border-b z-10">
                                <tr>
                                    <th className="text-left p-2 font-bold text-muted-foreground w-[180px]">Serial</th>
                                    <th className="text-left p-2 font-bold text-muted-foreground w-[120px]">Condition</th>
                                    <th className="text-left p-2 font-bold text-muted-foreground w-[140px]">Expiration</th>
                                    <th className="text-left p-2 font-bold text-muted-foreground">Tare (KG)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {serials.map((s) => (
                                    <tr key={s} className="hover:bg-muted/5 transition-colors">
                                        <td className="p-2 font-mono font-medium truncate">{s}</td>
                                        <td className="p-2">
                                            <Select 
                                                value={rows[s]?.condition || "GOOD"} 
                                                onValueChange={(v: CylinderAssetUpsertPayload["cylinder_condition"]) => updateRow(s, "condition", v)}
                                            >
                                                <SelectTrigger className="h-7 text-[11px] py-0 px-2">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="GOOD">GOOD</SelectItem>
                                                    <SelectItem value="FOR_REPAIR">FOR_REPAIR</SelectItem>
                                                    <SelectItem value="DAMAGED">DAMAGED</SelectItem>
                                                    <SelectItem value="SCRAP">SCRAP</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className="p-2">
                                            <Input 
                                                type="date" 
                                                className="h-7 text-[11px] py-0 px-2" 
                                                value={rows[s]?.expirationDate || ""}
                                                onChange={(e) => updateRow(s, "expirationDate", e.target.value)}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <Input 
                                                type="number" 
                                                step="0.01" 
                                                placeholder="0.00"
                                                className="h-7 text-[11px] py-0 px-2" 
                                                value={rows[s]?.tareWeight || ""}
                                                onChange={(e) => updateRow(s, "tareWeight", e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-muted/20">
                    <div className="flex justify-between items-center w-full">
                        {onClear && (
                            <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                                onClick={() => { onClear(); onOpenChange(false); }}
                                disabled={isSaving}
                            >
                                Clear All
                            </Button>
                        )}
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-8" onClick={() => onOpenChange(false)} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button size="sm" className="h-8" onClick={() => void handleSave()} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Register All Assets
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
