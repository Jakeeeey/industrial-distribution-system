// src/modules/.../purchase-order-creation-serial/hooks/useSerialPOCreation.ts
// Purpose: State orchestrator for the Cylinder Refill Serial Tagging module.
// Revised: Removed all PO creation logic. Now manages PO list selection + serial tagging state.
//
// Phase 1 — PO List: user selects an approved refill PO (inventory_status=13).
// Phase 2 — Tagging Workspace: user enters draft serials, submits, DB is updated.

"use client";

import * as React from "react";
import { toast } from "sonner";
import * as provider from "../services/fetchProviders";
import type {
    SerialTaggingPOListItem,
    SerialTaggingPODetail,
    TagSerialsResult,
} from "../types/serial-po.types";
import { useSerialTaggingStore } from "../store/serialTaggingStore";

// ─── Hook Return Type ─────────────────────────────────────────────────────────

export type UseSerialTaggingReturn = {
    // ── Phase 1: PO List ──
    poList: SerialTaggingPOListItem[];
    isLoadingList: boolean;
    listError: string;
    refreshList: () => Promise<void>;
    statusTab: "all" | "ready" | "for_approval" | "tagged" | "rejected";
    onTabChange: (tab: "all" | "ready" | "for_approval" | "tagged" | "rejected") => void;
    // ── Phase 2: Tagging Workspace ──
    selectedPO: SerialTaggingPODetail | null;
    isLoadingDetail: boolean;
    isSubmitting: boolean;
    // ── Actions ──
    selectPO: (poId: number) => Promise<void>;
    backToList: () => void;
    addDraftSerial: (lineId: number, serial: string) => void;
    removeDraftSerial: (lineId: number, index: number) => void;
    submitSerials: () => Promise<(TagSerialsResult & { updatedDetail: SerialTaggingPODetail }) | null>;
    // ── Derived ──
    canSubmit: boolean;
    totalDraftCount: number;
    totalSavedCount: number;
    totalOrderedCount: number;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSerialTagging(): UseSerialTaggingReturn {
    // ── Phase 1 state ─────────────────────────────────────────────────────────
    const [poList, setPoList] = React.useState<SerialTaggingPOListItem[]>([]);
    const [isLoadingList, setIsLoadingList] = React.useState(true);
    const [listError, setListError] = React.useState("");
    const [statusTab, setStatusTab] = React.useState<"all" | "ready" | "for_approval" | "tagged" | "rejected">("ready");

    // ── Phase 2 state ─────────────────────────────────────────────────────────
    const [rawSelectedPO, setRawSelectedPO] = React.useState<SerialTaggingPODetail | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // ── Zustand Store ─────────────────────────────────────────────────────────
    const store = useSerialTaggingStore();
    const drafts = useSerialTaggingStore((state) => state.drafts);

    // Dynamically inject drafts into the selected PO
    const selectedPO = React.useMemo(() => {
        if (!rawSelectedPO) return null;
        const poDrafts = drafts[rawSelectedPO.poId] || {};
        return {
            ...rawSelectedPO,
            lines: rawSelectedPO.lines.map((l) => ({
                ...l,
                draftSerials: poDrafts[l.lineId] || [],
            })),
        };
    }, [rawSelectedPO, drafts]);

    // Dynamically inject drafts into the PO list items for real-time sidebar count updates
    const poListWithDrafts = React.useMemo(() => {
        return poList.map((po) => {
            const poDrafts = drafts[po.poId] || {};
            const draftCount = Object.values(poDrafts).reduce(
                (sum, lineDrafts) => sum + (lineDrafts?.length || 0),
                0
            );
            return {
                ...po,
                totalSerials: po.totalSerials + draftCount,
            };
        });
    }, [poList, drafts]);

    // ── Load PO list on mount / status tab change ─────────────────────────────
    const refreshList = React.useCallback(async () => {
        try {
            setIsLoadingList(true);
            setListError("");
            const data = await provider.fetchRefillPOs(statusTab);
            setPoList(data ?? []);
        } catch (e: unknown) {
            const msg = String((e as Error).message ?? e);
            setListError(msg);
            toast.error(`Failed to load PO list: ${msg}`);
        } finally {
            setIsLoadingList(false);
        }
    }, [statusTab]);

    React.useEffect(() => {
        refreshList();
    }, [refreshList]);

    const onTabChange = React.useCallback((tab: "all" | "ready" | "for_approval" | "tagged" | "rejected") => {
        setStatusTab(tab);
    }, []);

    // ── Select a PO → load its detail ────────────────────────────────────────
    const selectPO = React.useCallback(async (poId: number) => {
        try {
            setIsLoadingDetail(true);
            setRawSelectedPO(null);
            const detail = await provider.fetchPODetail(poId);
            setRawSelectedPO(detail);
        } catch (e: unknown) {
            toast.error(`Failed to load PO detail: ${(e as Error).message}`);
        } finally {
            setIsLoadingDetail(false);
        }
    }, []);

    // ── Navigate back to PO list ──────────────────────────────────────────────
    const backToList = React.useCallback(() => {
        setRawSelectedPO(null);
    }, []);

    // ── Add a draft serial to a line ──────────────────────────────────────────
    const addDraftSerial = React.useCallback((lineId: number, serial: string) => {
        const sn = serial.trim().toUpperCase();
        if (!sn || !rawSelectedPO) return;
        
        // Prevent duplicates in saved serials (draft duplicates are handled by store)
        const line = rawSelectedPO.lines.find(l => l.lineId === lineId);
        if (!line) return;
        if (line.savedSerials.some(s => s.serial_number.toUpperCase() === sn)) return;
        
        // Check capacity limit: do not exceed ordered quantity
        const poDrafts = drafts[rawSelectedPO.poId] || {};
        const lineDrafts = poDrafts[lineId] || [];
        const currentCount = line.savedSerials.length + lineDrafts.length;
        if (currentCount >= line.orderedQty) {
            toast.error(`Cannot exceed ordered quantity of ${line.orderedQty} for this product.`);
            return;
        }
        
        store.addDraft(rawSelectedPO.poId, lineId, sn);
    }, [rawSelectedPO, store, drafts]);

    // ── Remove a draft serial from a line (by index within draftSerials) ──────
    const removeDraftSerial = React.useCallback((lineId: number, index: number) => {
        if (!rawSelectedPO) return;
        store.removeDraft(rawSelectedPO.poId, lineId, index);
    }, [rawSelectedPO, store]);

    // ── Derived: can we submit? ────────────────────────────────────────────────
    // All lines must have (savedSerials + draftSerials).length === orderedQty
    // AND there must be at least one new draft serial to submit.
    const { canSubmit, totalDraftCount, totalSavedCount, totalOrderedCount } = React.useMemo(() => {
        if (!selectedPO) return { canSubmit: false, totalDraftCount: 0, totalSavedCount: 0, totalOrderedCount: 0 };

        let draft = 0;
        let saved = 0;
        let ordered = 0;
        let allFull = true;

        for (const line of selectedPO.lines) {
            const total = line.savedSerials.length + line.draftSerials.length;
            draft += line.draftSerials.length;
            saved += line.savedSerials.length;
            ordered += line.orderedQty;
            if (total !== line.orderedQty || line.orderedQty === 0) allFull = false;
        }

        return {
            canSubmit: allFull && draft > 0,
            totalDraftCount: draft,
            totalSavedCount: saved,
            totalOrderedCount: ordered,
        };
    }, [selectedPO]);

    // ── Submit drafted serials ────────────────────────────────────────────────
    const submitSerials = React.useCallback(async () => {
        if (!selectedPO || !canSubmit) return null;
        setIsSubmitting(true);
        try {
            // Build payload from draftSerials across all lines
            const entries = selectedPO.lines.flatMap((line) =>
                line.draftSerials.map((s) => ({
                    lineId: line.lineId,
                    productId: line.productId,
                    serial_number: s.serial_number,
                }))
            );

            const result = await provider.submitTaggedSerials({
                poId: selectedPO.poId,
                entries,
            });

            // Replace selectedPO with the updated detail from server
            if (result.updatedDetail) {
                // Clear the drafts from Zustand since they are now saved
                store.clearDraftsForPO(rawSelectedPO!.poId);
                setRawSelectedPO(result.updatedDetail);
                // Also update the list item's serial count
                setPoList((prev) =>
                    prev.map((po) =>
                        po.poId === result.updatedDetail!.poId
                            ? {
                                ...po,
                                totalSerials: result.updatedDetail!.lines.reduce((s, l) => s + l.savedSerials.length, 0),
                                isTagged: result.updatedDetail!.isTagged,
                              }
                            : po
                    )
                );
            }

            if (result.isTaggedNow) {
                toast.success(`PO ${result.poNumber} fully tagged! All serials registered.`);
            } else {
                toast.success(`${result.serialsInserted} serial(s) saved for PO ${result.poNumber}.`);
            }

            return result;
        } catch (e: unknown) {
            toast.error(`Save failed: ${(e as Error).message}`);
            return null;
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedPO, canSubmit, rawSelectedPO, store]);

    return {
        poList: poListWithDrafts, isLoadingList, listError, refreshList,
        statusTab, onTabChange,
        selectedPO, isLoadingDetail, isSubmitting,
        selectPO, backToList,
        addDraftSerial, removeDraftSerial, submitSerials,
        canSubmit, totalDraftCount, totalSavedCount, totalOrderedCount,
    };
}
