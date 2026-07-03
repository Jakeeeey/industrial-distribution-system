// src/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/components/ExceptionsPanel.tsx
"use client";

import * as React from "react";
import { ExceptionDetail } from "../types";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw, Calendar, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExceptionsPanelProps {
    exceptions: ExceptionDetail[];
    onViewTrace: (serialNumber: string) => void;
}

export function ExceptionsPanel({ exceptions, onViewTrace }: ExceptionsPanelProps) {
    if (exceptions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-xl bg-card">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 text-xl mb-3">
                    ✓
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">No Exceptions Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    All cylinders under the selected product are currently traced correctly within standard parameters.
                </p>
            </div>
        );
    }

    const getIcon = (type: string) => {
        switch (type) {
            case "refill_overdue":
                return <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
            case "unresolved_transfer":
                return <RefreshCw className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
            case "stale_asset":
                return <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
            case "conflicting_movement":
            default:
                return <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
        }
    };

    const getBgColor = (type: string) => {
        switch (type) {
            case "refill_overdue":
                return "bg-amber-500/10";
            case "unresolved_transfer":
                return "bg-purple-500/10";
            case "stale_asset":
                return "bg-blue-500/10";
            case "conflicting_movement":
            default:
                return "bg-rose-500/10";
        }
    };

    return (
        <div className="border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-card">
                <div>
                    <h3 className="text-sm font-semibold text-card-foreground">Cylinder Movement Exceptions</h3>
                    <p className="text-xs text-muted-foreground">
                        Review and resolve unusual, incomplete, or stalled serialized cylinder movements.
                    </p>
                </div>
                <span className="inline-flex items-center justify-center bg-rose-500/10 text-rose-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {exceptions.length} exception{exceptions.length === 1 ? "" : "s"}
                </span>
            </div>

            <ul className="divide-y">
                {exceptions.map((e) => (
                    <li 
                        key={e.id} 
                        className="flex items-center justify-between p-5 hover:bg-muted/30 transition-colors gap-4 flex-wrap sm:flex-nowrap cursor-pointer"
                        onClick={() => onViewTrace(e.serialNumber)}
                    >
                        <div className="flex items-start gap-4">
                            <div className={cn("flex items-center justify-center w-10 h-10 rounded-xl shrink-0 mt-0.5", getBgColor(e.exceptionType))}>
                                {getIcon(e.exceptionType)}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-foreground mb-0.5">{e.title}</div>
                                <div className="text-xs text-muted-foreground mb-1 select-all">{e.description}</div>
                                <span className="inline-flex text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {e.productName}
                                </span>
                            </div>
                        </div>
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onViewTrace(e.serialNumber)}
                                className="h-9 font-semibold text-xs border border-input hover:bg-muted"
                            >
                                View Trace <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
