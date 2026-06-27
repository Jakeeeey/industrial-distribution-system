// src/modules/.../purchase-order-creation-serial/components/SerialTaggingWorkspace.tsx
// Purpose: The main tagging workspace panel shown on the right side.
// Layout: Detail panel layout.

"use client";

import * as React from "react";
import {
    CalendarDays, Building2, ScanLine, Info,
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
            <div className="min-w-0 border border-border rounded-xl bg-background shadow-sm overflow-hidden flex flex-col h-[calc(100vh-120px)] sticky top-4 self-start">
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
            <div className="min-w-0 border border-border rounded-xl bg-background shadow-sm overflow-hidden flex flex-col h-[calc(100vh-120px)] sticky top-4 self-start">
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

    return (
        <div className="min-w-0 border border-border rounded-xl bg-background shadow-sm overflow-hidden flex flex-col h-[calc(100vh-120px)] sticky top-4 self-start">
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
                    <div className="shrink-0">
                        <Button
                            id="rapid-scan-open-btn"
                            type="button"
                            variant="outline"
                            className="h-9 gap-2 font-bold shadow-sm"
                            onClick={() => setRapidScanOpen(true)}
                            disabled={isTagged}
                        >
                            <ScanLine className="h-4 w-4 text-primary" />
                            Rapid Scan
                        </Button>
                    </div>
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
                                onAddSerial={isTagged ? () => {} : hook.addDraftSerial}
                                onRemoveDraft={isTagged ? () => {} : hook.removeDraftSerial}
                            />
                        ))
                    )}
                </div>

                {/* ── Summary & Actions ── */}
                <SerialTaggingSummary
                    po={po}
                    totalOrderedCount={hook.totalOrderedCount}
                    totalSavedCount={hook.totalSavedCount}
                    totalDraftCount={hook.totalDraftCount}
                    canSubmit={hook.canSubmit}
                    isSubmitting={hook.isSubmitting}
                    onSubmit={hook.submitSerials}
                />
            </div>

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
