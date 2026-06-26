// src/modules/.../purchase-order-creation-serial/components/SerialTaggingSummary.tsx
// Purpose: Summary block and bottom action bar for the tagging workspace.
// Redesigned to fit the master-detail layout.

"use client";

import * as React from "react";
import { Barcode, Cylinder, Save, Loader2, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SerialTaggingPODetail } from "../types/serial-po.types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SerialTaggingSummaryProps {
    po: SerialTaggingPODetail;
    totalOrderedCount: number;
    totalSavedCount: number;
    totalDraftCount: number;
    canSubmit: boolean;
    isSubmitting: boolean;
    onSubmit: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SerialTaggingSummary({
    po,
    totalOrderedCount,
    totalSavedCount,
    totalDraftCount,
    canSubmit,
    isSubmitting,
    onSubmit,
}: SerialTaggingSummaryProps) {
    const totalEntered = totalSavedCount + totalDraftCount;
    const serialsComplete = totalEntered === totalOrderedCount && totalOrderedCount > 0;

    // Group lines by branch for breakdown
    const branchBreakdown = React.useMemo(() => {
        const map = new Map<string, { branchName: string; ordered: number; saved: number; draft: number }>();
        for (const line of po.lines) {
            const existing = map.get(line.branchName) ?? { branchName: line.branchName, ordered: 0, saved: 0, draft: 0 };
            map.set(line.branchName, {
                ...existing,
                ordered: existing.ordered + line.orderedQty,
                saved: existing.saved + line.savedSerials.length,
                draft: existing.draft + line.draftSerials.length,
            });
        }
        return Array.from(map.values());
    }, [po.lines]);

    const completionPct = totalOrderedCount > 0
        ? Math.min(100, Math.round((totalEntered / totalOrderedCount) * 100))
        : 0;

    return (
        <div className="space-y-4">
            <div className="p-5 border border-border rounded-xl bg-muted/30 space-y-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                    <span>Tagging Summary</span>
                    <span className={cn(
                        "tabular-nums",
                        serialsComplete ? "text-emerald-600 dark:text-emerald-400" : "text-orange-500"
                    )}>
                        {completionPct}% Complete
                    </span>
                </div>

                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-500",
                            serialsComplete ? "bg-emerald-500" : "bg-primary"
                        )}
                        style={{ width: `${completionPct}%` }}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-background p-3 flex flex-col gap-1 border border-border/50">
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Cylinder className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase tracking-wider">Ordered Quantity</span>
                        </div>
                        <span className="text-xl font-black tabular-nums text-foreground">{totalOrderedCount}</span>
                    </div>

                    <div className={cn(
                        "rounded-lg p-3 flex flex-col gap-1 border",
                        serialsComplete && totalOrderedCount > 0
                            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                            : totalEntered > 0
                            ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                            : "bg-background border-border/50"
                    )}>
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Barcode className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase tracking-wider">Serials Entered</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "text-xl font-black tabular-nums",
                                serialsComplete ? "text-emerald-600" : totalEntered > 0 ? "text-blue-600" : "text-foreground"
                            )}>
                                {totalEntered}
                            </span>
                            {totalOrderedCount > 0 && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[8px] font-black px-1.5 h-4",
                                        serialsComplete
                                            ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                                            : "border-blue-400/30 text-blue-600 bg-blue-500/10"
                                    )}
                                >
                                    {serialsComplete ? "COMPLETE" : `${totalOrderedCount - totalEntered} REMAINING`}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {(totalSavedCount > 0 || totalDraftCount > 0) && (
                    <div className="space-y-1.5 pt-2 border-t border-border/50">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground font-medium flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                Saved in Database
                            </span>
                            <span className="font-bold text-foreground">{totalSavedCount}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground font-medium flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                Draft (Unsaved)
                            </span>
                            <span className="font-bold text-foreground">{totalDraftCount}</span>
                        </div>
                    </div>
                )}
                
                {branchBreakdown.length > 1 && (
                    <div className="space-y-2 pt-2 border-t border-border/50">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-2">
                            Branch Completion
                        </p>
                        {branchBreakdown.map((b) => {
                            const total = b.saved + b.draft;
                            const done = total === b.ordered && b.ordered > 0;
                            return (
                                <div key={b.branchName} className="flex justify-between text-xs">
                                    <span className="text-muted-foreground font-medium truncate pr-2">
                                        {b.branchName}
                                    </span>
                                    <span className={cn(
                                        "font-bold tabular-nums whitespace-nowrap",
                                        done ? "text-emerald-600" : "text-foreground"
                                    )}>
                                        {total} / {b.ordered}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Action Bar ── */}
            <div className="sticky bottom-[-16px] -mx-4 -mb-4 p-4 bg-background/95 backdrop-blur-xl border-t border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between z-10">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {!canSubmit && totalDraftCount === 0 && (
                        <>
                            <Info className="h-4 w-4" />
                            <span>Add serials to enable saving.</span>
                        </>
                    )}
                    {!canSubmit && totalDraftCount > 0 && (
                        <span className="text-orange-500 font-medium flex items-center gap-1.5">
                            <Info className="h-4 w-4" />
                            All lines must match ordered quantity to save.
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        id="serial-tagging-submit-btn"
                        type="button"
                        className={cn(
                            "h-10 rounded-xl font-black uppercase tracking-wider px-6",
                            serialsComplete && !isSubmitting && "bg-emerald-600 hover:bg-emerald-700 text-white"
                        )}
                        disabled={!canSubmit || isSubmitting}
                        onClick={onSubmit}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                {serialsComplete ? "Confirm & Save All" : `Save ${totalDraftCount} Drafts`}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
