"use client";

import React, { useState, useRef, useEffect } from "react";
import { useActivePickingContext } from "../providers/ActivePickingProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    CheckCircle2, 
    AlertCircle, 
    ArrowRight, 
    Trash2, 
    ChevronDown, 
    ChevronUp, 
    RefreshCcw, 
    ArrowLeft,
    Save,
    ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function PickingWorkbench() {
    const { 
        activePickingId, 
        pickings, 
        details, 
        isLoadingDetails, 
        processSerial, 
        isProcessingSerial,
        serialsMap,
        isLoadingSerials,
        fetchSerials,
        removeSerial,
        completePicking
    } = useActivePickingContext();

    const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null);
    const [serialInput, setSerialInput] = useState("");
    const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
    const inputRef = useRef<HTMLInputElement>(null);

    const activePicking = pickings.find(p => p.id === activePickingId);
    const selectedDetail = details.find(d => d.id === selectedDetailId);

    // Auto-focus input when a product is selected
    useEffect(() => {
        if (selectedDetailId && inputRef.current) {
            inputRef.current.focus();
        }
    }, [selectedDetailId]);

    const toggleRow = (id: number) => {
        const isNowExpanded = !expandedRows[id];
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
        
        if (isNowExpanded) {
            fetchSerials(id);
        }
    };

    if (!activePickingId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-lg border shadow-sm p-8 text-center">
                <div className="bg-muted p-4 rounded-full mb-4">
                    <ClipboardList className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">No Picking Selected</h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                    Select a picking order from the sidebar to begin manual entry of serial numbers.
                </p>
            </div>
        );
    }

    const handleSerialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDetailId || !serialInput.trim() || isProcessingSerial || !activePicking) return;

        const detail = details.find(d => d.id === selectedDetailId);
        if (!detail) return;

        if (detail.product && (detail.picked_quantity + 1) > detail.product.running_inventory_unit) {
            toast.error(`Cannot pick more than available stock (${detail.product.running_inventory_unit})`);
            return;
        }

        const success = await processSerial(selectedDetailId, serialInput.trim(), null, activePicking.branch_id || 0);
        if (success) {
            setSerialInput("");
            inputRef.current?.focus();
            
            // Automatically ensure serials are loaded
            fetchSerials(selectedDetailId);
        }
    };

    const handleComplete = async () => {
        if (!activePickingId) return;
        await completePicking(activePickingId, "Picked");
    };

    return (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* Header Details */}
            <Card className="shrink-0 border-primary/20 shadow-sm">
                <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                {activePicking?.consolidator_no}
                                <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200">
                                    {activePicking?.status}
                                </Badge>
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Enter product serial numbers to fulfill this picking order.
                            </p>
                        </div>
                        <Button 
                            variant="default" 
                            className="bg-green-600 hover:bg-green-700 shadow-md flex items-center gap-2"
                            onClick={handleComplete}
                        >
                            <Save className="h-4 w-4" />
                            Save & Finish Operation
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card rounded-lg border shadow-sm">
                {selectedDetail ? (
                    /* Manual Serial Entry View */
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setSelectedDetailId(null)}
                                    className="hover:bg-background"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <h3 className="font-bold text-lg">{selectedDetail.product?.product_name}</h3>
                                    <p className="text-xs text-muted-foreground">SKU: {selectedDetail.product?.product_code}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Progress</div>
                                <div className="text-xl font-black">
                                    <span className="text-primary">{selectedDetail.picked_quantity}</span>
                                    <span className="text-muted-foreground/30"> / </span>
                                    <span>{selectedDetail.ordered_quantity}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-6 space-y-8">
                            {/* Manual Input Form */}
                            <div className="max-w-2xl mx-auto space-y-6">
                                <form onSubmit={handleSerialSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Manual Serial Input</label>
                                        <div className="relative">
                                            <Input
                                                ref={inputRef}
                                                placeholder="Enter serial number..."
                                                value={serialInput}
                                                onChange={(e) => setSerialInput(e.target.value)}
                                                disabled={isProcessingSerial}
                                                className={cn(
                                                    "h-14 text-xl font-mono tracking-widest px-4",
                                                    isProcessingSerial && "bg-muted animate-pulse"
                                                )}
                                            />
                                            {isProcessingSerial && (
                                                <RefreshCcw className="absolute right-4 top-4.5 h-6 w-6 animate-spin text-muted-foreground" />
                                            )}
                                        </div>
                                    </div>

                                    <Button 
                                        className="w-full h-14 text-lg font-bold shadow-lg transition-all" 
                                        type="submit"
                                        disabled={isProcessingSerial || !serialInput.trim()}
                                    >
                                        {isProcessingSerial ? "Verifying On-hand..." : "Submit Serial Number"}
                                        {!isProcessingSerial && <ArrowRight className="ml-2 h-5 w-5" />}
                                    </Button>

                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-900/10 dark:border-blue-800">
                                        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                            Every serial number entered will be verified against on-hand stocks. 
                                            You can save your progress at any time using the button above.
                                        </p>
                                    </div>
                                </form>

                                {/* List of Serials for this product */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">
                                            Registered Serials
                                        </h4>
                                        <Badge variant="secondary" className="font-bold">
                                            {serialsMap[selectedDetail.id]?.length || 0} Total
                                        </Badge>
                                    </div>

                                    {isLoadingSerials[selectedDetail.id] ? (
                                        <div className="text-center py-8 animate-pulse text-muted-foreground">Loading serials...</div>
                                    ) : (serialsMap[selectedDetail.id]?.length || 0) === 0 ? (
                                        <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground italic">
                                            No serials registered for this product yet.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {serialsMap[selectedDetail.id]?.map((mapping) => (
                                                <div 
                                                    key={mapping.id} 
                                                    className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow group"
                                                >
                                                    <span className="font-mono text-sm font-bold tracking-wider">{mapping.serial_number}</span>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => removeSerial(mapping.id, selectedDetail.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Product List View */
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="py-4 border-b bg-muted/30 flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-lg">Expected Products</CardTitle>
                            <Badge variant="secondary" className="font-bold">
                                {details.length} Items
                            </Badge>
                        </CardHeader>
                        <div className="flex-1 overflow-auto">
                            {isLoadingDetails ? (
                                <div className="p-12 text-center text-muted-foreground animate-pulse">Loading product list...</div>
                            ) : details.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">No items found for this picking.</div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead className="w-[50px]"></TableHead>
                                            <TableHead>Product Details</TableHead>
                                            <TableHead className="text-center">Stock</TableHead>
                                            <TableHead className="text-center">Order</TableHead>
                                            <TableHead className="text-center">Picked</TableHead>
                                            <TableHead className="text-right pr-6">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {details.map((detail) => {
                                            const isComplete = detail.picked_quantity >= detail.ordered_quantity;
                                            const isExpanded = !!expandedRows[detail.id];
                                            const serials = serialsMap[detail.id] || [];
                                            
                                            return (
                                                <React.Fragment key={detail.id}>
                                                    <TableRow 
                                                        className={cn(
                                                            "transition-colors group",
                                                            isComplete && "bg-green-50/30 dark:bg-green-900/5 opacity-80"
                                                        )}
                                                    >
                                                        <TableCell>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8"
                                                                onClick={() => toggleRow(detail.id)}
                                                            >
                                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            <div className="font-bold">{detail.product?.product_name || `Product ID: ${detail.product_id}`}</div>
                                                            <div className="text-xs text-muted-foreground font-mono">
                                                                {detail.product?.product_code || 'N/A'}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary" className="opacity-40 font-normal">Hidden</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold">
                                                            {detail.ordered_quantity}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className={cn(
                                                                "inline-flex items-center justify-center min-w-[2.5rem] py-1 px-2 rounded-lg font-black text-sm shadow-inner",
                                                                isComplete ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                                                            )}>
                                                                {detail.picked_quantity}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            <Button 
                                                                variant={isComplete ? "outline" : "default"} 
                                                                size="sm"
                                                                className={cn(
                                                                    "w-28 font-bold shadow-sm transition-all",
                                                                    !isComplete && "hover:translate-x-1"
                                                                )}
                                                                onClick={() => setSelectedDetailId(detail.id)}
                                                            >
                                                                {isComplete ? (
                                                                    <><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Review</>
                                                                ) : (
                                                                    "Select Product"
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                    
                                                    {isExpanded && (
                                                        <TableRow className="bg-muted/5 border-l-4 border-l-primary/30">
                                                            <TableCell colSpan={6} className="p-0">
                                                                <div className="p-4 bg-background/40 border-y space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Registered Serials ({serials.length})</span>
                                                                        {isLoadingSerials[detail.id] && <RefreshCcw className="h-3 w-3 animate-spin text-muted-foreground" />}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {serials.length === 0 ? (
                                                                            <span className="text-xs text-muted-foreground italic">No serials entered yet.</span>
                                                                        ) : (
                                                                            serials.map(s => (
                                                                                <Badge key={s.id} variant="outline" className="font-mono text-[10px] bg-background">
                                                                                    {s.serial_number}
                                                                                </Badge>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
