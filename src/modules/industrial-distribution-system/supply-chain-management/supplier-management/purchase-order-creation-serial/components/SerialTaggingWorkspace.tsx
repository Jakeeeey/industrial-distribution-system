// src/modules/.../purchase-order-creation-serial/components/SerialTaggingWorkspace.tsx
// Purpose: The main tagging workspace panel shown on the right side.
// Layout: Detail panel layout.

"use client";

import * as React from "react";
import {
    CalendarDays, Building2, ScanLine, Info, Save, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SerialTaggingPODetail } from "../types/serial-po.types";
import type { UseSerialTaggingReturn } from "../hooks/useSerialPOCreation";
import { SerialEntryPanel } from "./SerialEntryPanel";
import { SerialTaggingSummary } from "./SerialTaggingSummary";
import { RapidScanModal } from "./RapidScanModal";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SerialTaggingWorkspaceProps {
    po: SerialTaggingPODetail | null;
    loading: boolean;
    hook: UseSerialTaggingReturn;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SerialTaggingWorkspace({ po, loading, hook }: SerialTaggingWorkspaceProps) {
    const [rapidScanOpen, setRapidScanOpen] = React.useState(false);

    // Group lines by branch for tabbed display
    const branchGroups = React.useMemo(() => {
        if (!po) return [];
        const map = new Map<string, typeof po.lines>();
        for (const line of po.lines) {
            const key = line.branchName;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(line);
        }
        return Array.from(map.entries()).map(([branchName, lines]) => ({ branchName, lines }));
    }, [po]);

    const [activeBranch, setActiveBranch] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (branchGroups.length > 0) {
            setActiveBranch(branchGroups[0].branchName);
        }
    }, [branchGroups]);

    const activeLines = React.useMemo(() =>
        branchGroups.find((g) => g.branchName === activeBranch)?.lines ?? [],
        [branchGroups, activeBranch]
    );

    if (!po && !loading) {
        return (
            <div className="min-w-0 border border-border rounded-xl bg-background shadow-sm overflow-hidden flex flex-col h-full">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 shrink-0">
                    <div className="min-w-0">
                        <div className="text-sm font-black text-foreground uppercase tracking-tight">
                            Serial Tagging Workspace
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                            Select a PO to review
                        </div>
                    </div>
                </div>
                <div className="flex-1 p-8 flex items-center justify-center">
                    <div className="rounded-lg border border-dashed border-border w-full h-full min-h-[300px] flex items-center justify-center text-sm text-muted-foreground p-8 text-center">
                        Select a Refill Purchase Order on the left to start tagging serial numbers.
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-w-0 border border-border rounded-xl bg-background shadow-sm overflow-hidden flex flex-col h-full">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-3 shrink-0">
                    <Skeleton className="h-6 w-48" />
                </div>
                <div className="p-4 space-y-4">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    if (!po) return null; // Fallback, shouldn't reach here

    const isTagged = po.isTagged;
    const isReadOnly = isTagged || po.inventoryStatus !== 13;

    return (
        <div className="min-w-0 border border-border rounded-xl bg-background shadow-sm overflow-hidden flex flex-col h-full">
            {/* ── Header ── */}
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap shrink-0">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-black text-foreground uppercase tracking-tight">
                            Serial Tagging Workspace
                        </div>
                        {isTagged && (
                            <Badge className="text-[10px] font-black bg-emerald-500/15 text-emerald-700 border border-emerald-500/20 px-1.5 h-4">
                                FULLY TAGGED
                            </Badge>
                        )}
                        {(po.inventoryStatus === 8 || po.inventoryStatus === 4) && (
                            <Badge variant="destructive" className="text-[10px] font-black px-1.5 h-4">
                                REJECTED
                            </Badge>
                        )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="font-bold text-foreground">{po.poNumber}</span>
                        <span>•</span>
                        <span className="truncate">{po.supplierName}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {po.date}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-black h-5">
                        ID: {po.poId}
                    </Badge>
                </div>
            </div>

            <div className="p-4 space-y-6 flex-1 overflow-y-auto">
                {/* ── Fully tagged notice ── */}
                {isTagged && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-sm text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
                        <Info className="h-4 w-4 shrink-0" />
                        This PO has been fully tagged. All serial numbers have been saved.
                    </div>
                )}
                {/* ── Rejected notice ── */}
                {(po.inventoryStatus === 8 || po.inventoryStatus === 4) && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive font-medium flex flex-col gap-1">
                        <div className="flex items-center gap-2 font-black uppercase tracking-wider">
                            <Info className="h-4 w-4 shrink-0" />
                            This PO was Rejected ({po.inventoryStatusLabel || "Rejected"})
                        </div>
                        {po.remark && <div className="text-foreground/90 font-medium">Reason: {po.remark}</div>}
                    </div>
                )}
                {po.inventoryStatus !== 13 && po.inventoryStatus !== 8 && po.inventoryStatus !== 4 && !isTagged && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
                        <Info className="h-4 w-4 shrink-0" />
                        This PO is not ready for tagging (Status: {po.inventoryStatusLabel || "Pending"}). Serial entry is disabled until approved.
                    </div>
                )}

                {/* ── Action & Tabs ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    {/* Branch tabs */}
                    <div className="space-y-2">
                        {branchGroups.length > 1 && (
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Branches
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {branchGroups.map(({ branchName, lines }) => {
                                const branchTotal = lines.reduce((s, l) => s + l.savedSerials.length + l.draftSerials.length, 0);
                                const branchOrdered = lines.reduce((s, l) => s + l.orderedQty, 0);
                                const done = branchTotal === branchOrdered && branchOrdered > 0;
                                return (
                                    <button
                                        key={branchName}
                                        type="button"
                                        onClick={() => setActiveBranch(branchName)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors",
                                            activeBranch === branchName
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-muted/60 text-muted-foreground border-border hover:border-primary/40"
                                        )}
                                    >
                                        <Building2 className="h-3 w-3" />
                                        {branchName}
                                        <Badge
                                            variant="secondary"
                                            className={cn(
                                                "text-[9px] font-black h-4 px-1 ml-0.5",
                                                activeBranch === branchName
                                                    ? "bg-white/20 text-white border-transparent"
                                                    : done
                                                    ? "bg-emerald-500/15 text-emerald-700"
                                                    : ""
                                            )}
                                        >
                                            {branchTotal}/{branchOrdered}
                                        </Badge>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Rapid Scan button */}
                    {!isReadOnly && (
                        <div className="shrink-0">
                            <Button
                                id="rapid-scan-open-btn"
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setRapidScanOpen(true)}
                                disabled={isReadOnly}
                                className="h-8 text-xs font-bold gap-1.5 rounded-lg border-primary/30 hover:bg-primary/5 text-primary"
                            >
                                <ScanLine className="h-3.5 w-3.5" />
                                Rapid Scan
                            </Button>
                        </div>
                    )}
                </div>

                {/* ── Product Lines ── */}
                <div className="space-y-3">
                    {activeLines.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                            No product lines for this branch.
                        </div>
                    ) : (
                        activeLines.map((line) => (
                            <SerialEntryPanel
                                key={line.lineId}
                                line={line}
                                isReadOnly={isReadOnly}
                                onAddSerial={isReadOnly ? () => {} : hook.addDraftSerial}
                                onRemoveDraft={isReadOnly ? () => {} : hook.removeDraftSerial}
                            />
                        ))
                    )}
                </div>

                {/* ── Summary ── */}
                <SerialTaggingSummary
                    po={po}
                    totalOrderedCount={hook.totalOrderedCount}
                    totalSavedCount={hook.totalSavedCount}
                    totalDraftCount={hook.totalDraftCount}
                />
            </div>

            {/* ── Fixed Action Bar ── */}
            {!isReadOnly && (
                <div className="p-4 bg-background/95 backdrop-blur-xl border-t border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between shrink-0 z-10">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {!hook.canSubmit && hook.totalDraftCount === 0 && (
                            <>
                                <Info className="h-4 w-4 shrink-0" />
                                <span>Add serials to enable saving.</span>
                            </>
                        )}
                        {!hook.canSubmit && hook.totalDraftCount > 0 && (
                            <span className="text-orange-500 font-medium flex items-center gap-1.5">
                                <Info className="h-4 w-4 shrink-0" />
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
                                (hook.totalSavedCount + hook.totalDraftCount) === hook.totalOrderedCount && hook.totalOrderedCount > 0 && !hook.isSubmitting && "bg-emerald-600 hover:bg-emerald-700 text-white"
                            )}
                            disabled={!hook.canSubmit || hook.isSubmitting}
                            onClick={hook.submitSerials}
                        >
                            {hook.isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    {(hook.totalSavedCount + hook.totalDraftCount) === hook.totalOrderedCount && hook.totalOrderedCount > 0 ? "Confirm & Save All" : `Save ${hook.totalDraftCount} Drafts`}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Rapid Scan Modal ── */}
            <RapidScanModal
                poId={po.poId}
                open={rapidScanOpen}
                onClose={() => setRapidScanOpen(false)}
                lines={po.lines}
                onAddSerial={hook.addDraftSerial}
            />
        </div>
    );
}
