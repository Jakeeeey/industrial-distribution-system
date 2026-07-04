// src/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/components/TraceDrawer.tsx
"use client";

import * as React from "react";
import { CylinderSummary } from "../types";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { History, Clock } from "lucide-react";

interface TraceDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    cylinder: CylinderSummary | null;
}

export function TraceDrawer({ isOpen, onClose, cylinder }: TraceDrawerProps) {
    if (!cylinder) return null;

    const getCustodyBadge = () => {
        let label = "OUTSIDE BRANCH";
        let color = "bg-muted text-muted-foreground border-border";

        if (cylinder.direction === "IN") {
            label = "IN BRANCH";
            color = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200/50";
        } else if (cylinder.direction === "Review") {
            label = "NEEDS REVIEW";
            color = "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200/50";
        } else {
            const doc = cylinder.lastMovementType.toLowerCase();
            if (doc.includes("pos") || doc.includes("sales invoice") || doc.includes("sales_invoice")) {
                label = "WITH CUSTOMER";
                color = "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200/50";
            } else if (doc.includes("refill") || doc.includes("return to supplier") || doc.includes("rts")) {
                label = "SUPPLIER / REFILL";
                color = "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200/50";
            } else if (doc.includes("transfer") || doc.includes("dispatch")) {
                label = "IN TRANSIT";
                color = "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200/50";
            }
        }

        return (
            <Badge variant="outline" className={cn("px-2.5 py-0.5 text-[10px] font-semibold tracking-wider", color)}>
                {label}
            </Badge>
        );
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[92vw] sm:max-w-[500px] p-0 flex flex-col h-full bg-background border-l border-border shadow-xl">
                {/* Header */}
                <SheetHeader className="px-6 py-5 border-b shrink-0 bg-card shadow-none">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
                            <History className="w-4 h-4 text-muted-foreground" />
                            Cylinder Trace Details
                        </SheetTitle>
                    </div>
                    <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                        Historical transaction records and timeline for serial {cylinder.serialNumber}.
                    </SheetDescription>
                </SheetHeader>

                {/* Content body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">
                    {/* Cylinder Summary Card */}
                    <Card className="border border-border/80 bg-card shadow-xs">
                        <CardContent className="p-5 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Serial Asset</span>
                                    <h3 className="text-lg font-bold text-foreground font-mono">
                                        {cylinder.serialNumber}
                                    </h3>
                                </div>
                                {getCustodyBadge()}
                            </div>

                            <Separator />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Product</span>
                                    <span className="text-xs font-semibold text-foreground leading-tight block">{cylinder.productName}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Last Branch</span>
                                    <span className="text-xs font-semibold text-foreground leading-tight block">{cylinder.lastHandlingBranch}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Last Movement</span>
                                    <span className="text-xs font-semibold text-foreground leading-tight block">{cylinder.lastMovementType}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Document No.</span>
                                    <span className="text-xs font-mono font-medium text-foreground leading-tight block">{cylinder.lastDocumentNo}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Last Moved Date</span>
                                    <span className="text-xs font-semibold text-foreground leading-tight block">{cylinder.lastMovementDate}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Transactions</span>
                                    <span className="text-xs font-semibold text-foreground leading-tight block">{cylinder.movementCount} total movements</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline section */}
                    <div className="space-y-4 pt-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Movement Timeline</span>
                        
                        <div className="relative pl-5 space-y-6 before:absolute before:left-[4px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                            {cylinder.movements.map((m, idx) => {
                                const isIN = m.inQty > 0 && m.outQty === 0;
                                const isOUT = m.outQty > 0 && m.inQty === 0;
                                return (
                                    <div key={`${m.documentNo}-${idx}`} className="relative pl-2">
                                        {/* Simple Dot */}
                                        <span 
                                            className={cn(
                                                "absolute -left-[24px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background z-10",
                                                isIN && "bg-emerald-500",
                                                isOUT && "bg-rose-500",
                                                (!isIN && !isOUT) && "bg-amber-500"
                                            )}
                                        />
                                        
                                        {/* Clean text row */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-foreground">{m.documentType}</span>
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                                                    <Clock className="w-3 h-3 text-muted-foreground/60" />
                                                    {m.movementAt}
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                <span className={cn(
                                                    "font-bold text-[9px] uppercase tracking-wider",
                                                    isIN && "text-emerald-600 dark:text-emerald-400",
                                                    isOUT && "text-rose-600 dark:text-rose-400",
                                                    (!isIN && !isOUT) && "text-amber-600 dark:text-amber-400"
                                                )}>
                                                    {isIN ? "IN" : isOUT ? "OUT" : "REVIEW"}
                                                </span>
                                                {" · "}
                                                <span>Doc: <span className="font-mono text-foreground font-semibold">{m.documentNo}</span></span>
                                                {m.branchName && (
                                                    <span> · <span className="font-medium text-foreground">{m.branchName}</span></span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
