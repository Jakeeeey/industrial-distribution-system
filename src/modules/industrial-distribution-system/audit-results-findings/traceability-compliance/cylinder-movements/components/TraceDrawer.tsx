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

interface TraceDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    cylinder: CylinderSummary | null;
}

export function TraceDrawer({ isOpen, onClose, cylinder }: TraceDrawerProps) {
    if (!cylinder) return null;

    // Helper to get inferred custody label & style for header
    const getCustodyBadge = () => {
        let label = "OUTSIDE BRANCH";
        let color = "bg-rose-500/10 text-rose-600 dark:text-rose-400";

        if (cylinder.direction === "IN") {
            label = "IN BRANCH";
            color = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
        } else if (cylinder.direction === "Review") {
            label = "NEEDS REVIEW";
            color = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
        } else {
            const doc = cylinder.lastMovementType.toLowerCase();
            if (doc.includes("pos") || doc.includes("sales invoice") || doc.includes("sales_invoice")) {
                label = "WITH CUSTOMER";
                color = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
            } else if (doc.includes("refill") || doc.includes("return to supplier") || doc.includes("rts")) {
                label = "SUPPLIER / REFILL";
                color = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
            } else if (doc.includes("transfer") || doc.includes("dispatch")) {
                label = "IN TRANSIT";
                color = "bg-purple-500/10 text-purple-600 dark:text-purple-400";
            }
        }

        return (
            <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider", color)}>
                {label}
            </span>
        );
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[92vw] sm:max-w-[550px] p-0 flex flex-col h-full bg-background border-l shadow-2xl">
                <SheetHeader className="px-6 py-5 border-b shrink-0 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-lg font-bold text-foreground">Cylinder Trace Details</SheetTitle>
                    </div>
                    <SheetDescription className="text-xs text-muted-foreground">
                        Trace the complete transaction history and custody timeline for serial {cylinder.serialNumber}.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Cylinder Summary Card */}
                    <div className="rounded-xl border bg-gradient-to-b from-muted/30 to-background p-5 space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold text-foreground font-mono leading-none mb-1">
                                    {cylinder.serialNumber}
                                </h3>
                                <p className="text-xs font-semibold text-muted-foreground truncate max-w-[300px]" title={cylinder.productName}>
                                    {cylinder.productName}
                                </p>
                            </div>
                            {getCustodyBadge()}
                        </div>

                        <Separator className="bg-border" />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="block text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider mb-0.5">Last Handling Branch</span>
                                <span className="text-sm font-semibold text-foreground leading-tight block">{cylinder.lastHandlingBranch}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider mb-0.5">Last Transaction</span>
                                <span className="text-sm font-semibold text-foreground leading-tight block">{cylinder.lastMovementType}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider mb-0.5">Last Document No.</span>
                                <span className="text-sm font-mono font-medium text-foreground leading-tight block">{cylinder.lastDocumentNo}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider mb-0.5">Last Movement Date</span>
                                <span className="text-sm font-semibold text-foreground leading-tight block">{cylinder.lastMovementDate}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider mb-0.5">Total Transactions</span>
                                <span className="text-sm font-bold text-foreground leading-tight block">{cylinder.movementCount} movement{cylinder.movementCount === 1 ? "" : "s"}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider mb-0.5">Latest Direction</span>
                                <span className={cn(
                                    "text-sm font-extrabold leading-tight block",
                                    cylinder.direction === "IN" && "text-emerald-600 dark:text-emerald-400",
                                    cylinder.direction === "OUT" && "text-rose-600 dark:text-rose-400",
                                    cylinder.direction === "Review" && "text-amber-600 dark:text-amber-400"
                                )}>
                                    {cylinder.direction === "IN" && "↙ IN"}
                                    {cylinder.direction === "OUT" && "↗ OUT"}
                                    {cylinder.direction === "Review" && "⚠ Needs Review"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Timeline section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Movement Timeline</h4>
                        <div className="relative pl-6 space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                            {cylinder.movements.map((m, idx) => {
                                const isIN = m.inQty > 0 && m.outQty === 0;
                                const isOUT = m.outQty > 0 && m.inQty === 0;
                                return (
                                    <div key={`${m.documentNo}-${idx}`} className="relative group">
                                        {/* Dot */}
                                        <span 
                                            className={cn(
                                                "absolute -left-[25px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-background ring-1 ring-border z-10 transition-all",
                                                isIN && "bg-emerald-500",
                                                isOUT && "bg-rose-500",
                                                (!isIN && !isOUT) && "bg-amber-500"
                                            )}
                                        />
                                        
                                        {/* Content */}
                                        <div className="space-y-1">
                                            <div className="text-[11px] font-bold text-muted-foreground">{m.movementAt}</div>
                                            <div className="text-sm font-bold text-foreground leading-tight">{m.documentType}</div>
                                            <div className="text-xs text-muted-foreground">
                                                <strong className={cn(
                                                    "font-bold",
                                                    isIN && "text-emerald-600 dark:text-emerald-400",
                                                    isOUT && "text-rose-600 dark:text-rose-400",
                                                    (!isIN && !isOUT) && "text-amber-600 dark:text-amber-400"
                                                )}>
                                                    {isIN && "↙ IN"}
                                                    {isOUT && "↗ OUT"}
                                                    {(!isIN && !isOUT) && "⚠ Review"}
                                                </strong>
                                                {" · "}
                                                <span>Document: <strong className="font-mono font-medium select-all">{m.documentNo}</strong></span>
                                            </div>
                                            <div className="text-xs text-muted-foreground font-medium italic">
                                                {isIN ? `Cylinder received into ${m.branchName || "branch"}.` : `Cylinder dispatched out from ${m.branchName || "branch"}.`}
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
