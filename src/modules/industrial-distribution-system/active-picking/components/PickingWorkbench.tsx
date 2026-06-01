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
    Trash2,
    ChevronDown,
    ChevronUp,
    RefreshCcw,
    Save,
    ClipboardList,
    Plus
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

    const [serialInput, setSerialInput] = useState("");
    const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
    const inputRef = useRef<HTMLInputElement>(null);

    const activePicking = pickings.find(p => p.id === activePickingId);

    // Auto-focus main input when a picking is selected
    useEffect(() => {
        if (activePickingId && inputRef.current) {
            inputRef.current.focus();
        }
    }, [activePickingId]);

    const toggleRow = (id: number) => {
        const isExpanding = !expandedRows[id];
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
        if (isExpanding) {
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
                    Select a picking order from the sidebar to begin processing serial numbers.
                </p>
            </div>
        );
    }

    const handleSerialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!serialInput.trim() || isProcessingSerial || !activePicking) return;

        const currentSerial = serialInput.trim();
        const success = await processSerial(activePickingId, currentSerial, activePicking.branch_id || 0);

        if (success) {
            setSerialInput("");
            inputRef.current?.focus();

            // The success logic in the hook already refreshes the specific detail quantity and its serials
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
                                <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200 uppercase tracking-tighter">
                                    {activePicking?.status}
                                </Badge>
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Enter serial numbers to automatically match and fulfill items.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 font-bold"
                                onClick={() => {
                                    toast.success("Progress saved successfully", {
                                        description: "All scans are secured in the database."
                                    });
                                }}
                            >
                                <Save className="h-4 w-4" />
                                Save Progress
                            </Button>
                            <Button
                                variant="default"
                                className="bg-green-600 hover:bg-green-700 shadow-md flex items-center gap-2 font-bold"
                                onClick={handleComplete}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Finish & Complete
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card rounded-lg border shadow-sm">
                <CardHeader className="py-4 px-6 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">Expected Products</CardTitle>
                        <Badge variant="secondary" className="font-bold">
                            {details.length} Items
                        </Badge>
                    </div>

                    {/* Global Serial Input - Moved outside per revision */}
                    <form onSubmit={handleSerialSubmit} className="flex items-center gap-2 w-full max-w-md ml-4">
                        <div className="relative flex-1">
                            <Input
                                ref={inputRef}
                                placeholder="Enter serial number to pick..."
                                value={serialInput}
                                onChange={(e) => setSerialInput(e.target.value)}
                                disabled={isProcessingSerial}
                                className={cn(
                                    "h-10 text-sm font-mono tracking-widest px-3 border-2 focus-visible:ring-primary/20",
                                    isProcessingSerial && "bg-muted animate-pulse border-primary/50"
                                )}
                            />
                            {isProcessingSerial && (
                                <RefreshCcw className="absolute right-3 top-2.5 h-5 w-5 animate-spin text-primary" />
                            )}
                        </div>
                        <Button
                            type="submit"
                            size="sm"
                            className="h-10 px-4 font-bold shadow-sm"
                            disabled={isProcessingSerial || !serialInput.trim()}
                        >
                            {isProcessingSerial ? "Matching..." : <Plus className="h-5 w-5" />}
                        </Button>
                    </form>
                </CardHeader>

                <div className="flex-1 overflow-auto">
                    {isLoadingDetails ? (
                        <div className="divide-y">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                                    <div className="w-8 h-8 rounded bg-muted"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-muted rounded w-3/4"></div>
                                        <div className="h-3 bg-muted rounded w-1/4"></div>
                                    </div>
                                    <div className="w-16 h-8 bg-muted rounded"></div>
                                    <div className="w-12 h-8 bg-muted rounded"></div>
                                    <div className="w-24 h-6 bg-muted rounded-full"></div>
                                </div>
                            ))}
                        </div>
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
                                    <TableHead className="text-right pr-6">Status</TableHead>
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
                                                    isComplete ? "bg-green-50/20 dark:bg-green-900/5 opacity-80" : "hover:bg-muted/30"
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
                                                    <div className="font-bold leading-tight">{detail.product?.product_name || `Product ID: ${detail.product_id}`}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono mt-1">
                                                        SKU: {detail.product?.product_code || 'N/A'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary" className="opacity-40 font-normal text-[10px]">Hidden</Badge>
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-muted-foreground">
                                                    {detail.ordered_quantity}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className={cn(
                                                        "inline-flex items-center justify-center min-w-[2.5rem] py-1 px-2 rounded-lg font-black text-sm border shadow-sm",
                                                        isComplete ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"
                                                    )}>
                                                        {detail.picked_quantity}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    {isComplete ? (
                                                        <Badge className="bg-green-600 text-white hover:bg-green-600 border-none px-3">
                                                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> FULFILLED
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/10">
                                                            PENDING
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>

                                            {isExpanded && (
                                                <TableRow className="bg-muted/5 border-l-4 border-l-primary/30">
                                                    <TableCell colSpan={6} className="p-0">
                                                        <div className="p-4 bg-background/40 border-y space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Registered Serials ({serials.length})</span>
                                                                {isLoadingSerials[detail.id] && <RefreshCcw className="h-3 w-3 animate-spin text-primary" />}
                                                            </div>

                                                            {serials.length === 0 ? (
                                                                <div className="text-xs text-muted-foreground italic py-2">No serials entered yet.</div>
                                                            ) : (
                                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                                                    {serials.map(s => (
                                                                        <div
                                                                            key={s.id}
                                                                            className="flex items-center justify-around gap-2 p-1.5 rounded-md border bg-background text-[10px] font-mono group/serial"
                                                                        >
                                                                            <span className="truncate">{s.serial_number}</span>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-5 w-5 text-destructive opacity-0 group-hover/serial:opacity-100 transition-opacity"
                                                                                onClick={() => removeSerial(s.id, detail.id)}
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
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

            {/* Legend / Info Footer */}
            <div className="p-3 bg-muted/20 border rounded-lg flex items-center gap-4 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>Fulfilled</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span>Pending</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Enter any on-hand serial number to automatically match it to its product row.</span>
                </div>
            </div>
        </div>
    );
}
