// src/modules/.../purchase-order-creation-serial/CreateSerialPurchaseOrderModule.tsx
// Purpose: Root client component for the Cylinder Refill Serial Tagging module.
// Revised: Implements the side-by-side Master-Detail pattern.

"use client";

import * as React from "react";
import { useSerialTagging } from "./hooks/useSerialPOCreation";
import { RefillPOList } from "./components/RefillPOList";
import { SerialTaggingWorkspace } from "./components/SerialTaggingWorkspace";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateSerialPurchaseOrderModuleProps {
    encoderId?: number;
    preparerName?: string;
}

// ─── Module ───────────────────────────────────────────────────────────────────

export default function CreateSerialPurchaseOrderModule({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    encoderId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    preparerName,
}: CreateSerialPurchaseOrderModuleProps) {
    const hook = useSerialTagging();

    return (
        <div className="w-full h-full min-w-0 flex flex-col space-y-4">
            {/* ── Page Header ── */}
            <div className="space-y-1 shrink-0">
                <div className="text-2xl font-black">Cylinder Refill — Serial Tagging</div>
                <div className="text-sm text-muted-foreground">
                    Select an approved Refill PO to register cylinder serial numbers
                </div>
            </div>

            {/* ── Error Banner ── */}
            {hook.listError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shrink-0">
                    {hook.listError}
                </div>
            )}

            {/* ── 2-Column Grid Layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 min-w-0 flex-1 min-h-0">
                {/* ── Left: PO List (Master) ── */}
                <RefillPOList
                    items={hook.poList}
                    loading={hook.isLoadingList}
                    selectedId={hook.selectedPO?.poId}
                    onSelectPO={hook.selectPO}
                    onRefresh={hook.refreshList}
                />

                {/* ── Right: Tagging Workspace (Detail) ── */}
                <SerialTaggingWorkspace
                    po={hook.selectedPO}
                    loading={hook.isLoadingDetail}
                    hook={hook}
                />
            </div>
        </div>
    );
}
