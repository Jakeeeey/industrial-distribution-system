// src/modules/.../purchase-order-creation-serial/components/SerialEntryPanel.tsx
// Purpose: Serial number entry panel per product line.
// Revised: Qty is now READ-ONLY (fixed from purchase_order_products.ordered_quantity).
//          Saved serials (from DB) shown as read-only chips.
//          Draft serials (this session) shown as removable chips.
//
// Input methods:
//   1. Type + Enter (keyboard)
//   2. Barcode scanner (fires Enter → auto-submit)
//   3. Bulk paste (newline/comma/semicolon separated)
//
// Status ring colors:
//   🔴 Orange → entered < required (incomplete)
//   🟡 Red    → entered > required (excess — shouldn't happen but guard it)
//   🟢 Green  → entered === required (complete ✓)

"use client";

import * as React from "react";
import { X, ScanBarcode, ClipboardPaste, Trash2, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SerialTaggingLine } from "../types/serial-po.types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SerialEntryPanelProps {
    line: SerialTaggingLine;
    onAddSerial: (lineId: number, serial: string) => void;
    onRemoveDraft: (lineId: number, index: number) => void;
}

// ─── Status Derivation ────────────────────────────────────────────────────────

function getStatus(entered: number, required: number): "incomplete" | "complete" | "excess" {
    if (required === 0) return "complete";
    if (entered === required) return "complete";
    if (entered > required) return "excess";
    return "incomplete";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SerialEntryPanel({ line, onAddSerial, onRemoveDraft }: SerialEntryPanelProps) {
    const [inputValue, setInputValue] = React.useState("");
    const [isValidating, setIsValidating] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const totalEntered = line.savedSerials.length + line.draftSerials.length;
    const required = line.orderedQty;
    const status = getStatus(totalEntered, required);

    // Border color by status
    const borderClass = {
        complete: "border-emerald-500/60 ring-1 ring-emerald-500/20",
        incomplete: "border-orange-400/40",
        excess: "border-red-500/60 ring-1 ring-red-500/20",
    }[status];

    // ── Validate serial via cylinder-assets API ────────────────────────────────
    const commitSerial = React.useCallback(async (raw: string) => {
        const sn = raw.trim().toUpperCase();
        if (!sn) return;

        // Local duplicate check (saved + draft)
        const existing = [
            ...line.savedSerials.map((s) => s.serial_number.toUpperCase()),
            ...line.draftSerials.map((s) => s.serial_number.toUpperCase()),
        ];
        if (existing.includes(sn)) {
            toast.warning(`Serial "${sn}" is already in the list.`);
            return;
        }

        setIsValidating(true);
        try {
            const res = await fetch(
                `/api/ids/scm/supplier-management/purchase-order-creation-serial/cylinder-assets?serial_number=${encodeURIComponent(sn)}`
            );
            if (!res.ok) throw new Error("Verification API failed");
            const data = await res.json();

            if (!data.exists) {
                toast.error(`Serial "${sn}" is not registered in cylinder assets.`);
                return;
            }

            // Validate product match
            const assetProductId = Number(data.asset?.product_id);
            if (assetProductId && assetProductId !== line.productId) {
                toast.error(
                    `Serial "${sn}" belongs to "${data.asset?.product_name || "another product"}", not "${line.productName}".`
                );
                return;
            }

            // Validate EMPTY status
            if (!data.is_empty) {
                toast.error(
                    `Serial "${sn}" is not EMPTY (status: "${data.asset?.cylinder_status || "UNKNOWN"}").`
                );
                return;
            }

            onAddSerial(line.lineId, sn);
            setInputValue("");
            toast.success(`Serial verified: ${sn}`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to validate serial number.");
        } finally {
            setIsValidating(false);
        }
    }, [line.savedSerials, line.draftSerials, line.productId, line.productName, line.lineId, onAddSerial]);

    // ── Keyboard: Enter submits ────────────────────────────────────────────────
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            commitSerial(inputValue);
        }
    }, [inputValue, commitSerial]);

    // ── Bulk paste (newline / comma / semicolon) ───────────────────────────────
    const processBulkTokens = React.useCallback(async (tokens: string[]) => {
        if (tokens.length === 0) return;
        setIsValidating(true);
        let added = 0;
        let skipped = 0;
        try {
            for (const t of tokens) {
                const sn = t.trim().toUpperCase();
                if (!sn) continue;
                const existing = [
                    ...line.savedSerials.map((s) => s.serial_number.toUpperCase()),
                    ...line.draftSerials.map((s) => s.serial_number.toUpperCase()),
                ];
                if (existing.includes(sn)) continue;

                const res = await fetch(
                    `/api/ids/scm/supplier-management/purchase-order-creation-serial/cylinder-assets?serial_number=${encodeURIComponent(sn)}`
                );
                if (!res.ok) continue;
                const data = await res.json();
                if (!data.exists) continue;
                const assetProductId = Number(data.asset?.product_id);
                if (assetProductId && assetProductId !== line.productId) continue;
                if (!data.is_empty) { skipped++; continue; }
                onAddSerial(line.lineId, sn);
                added++;
            }
            if (added > 0) {
                toast.success(
                    skipped > 0
                        ? `Added ${added} serials. Skipped ${skipped} non-EMPTY.`
                        : `Added ${added} serials.`
                );
            } else {
                toast.warning(skipped > 0 ? `Skipped ${skipped} non-EMPTY serials.` : "No valid serials added.");
            }
            setInputValue("");
        } finally {
            setIsValidating(false);
        }
    }, [line.savedSerials, line.draftSerials, line.productId, line.lineId, onAddSerial]);

    const handlePaste = React.useCallback(async (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData("text");
        if (pasted.includes("\n") || pasted.includes(",") || pasted.includes(";")) {
            e.preventDefault();
            const tokens = pasted.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
            if (tokens.length > 1) { await processBulkTokens(tokens); return; }
        }
    }, [processBulkTokens]);

    const handleManualPaste = React.useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            const tokens = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
            await processBulkTokens(tokens);
        } catch {
            inputRef.current?.focus();
        }
    }, [processBulkTokens]);

    const panelId = `serial-panel-${line.lineId}`;

    return (
        <div
            id={panelId}
            className={cn(
                "rounded-xl border bg-card shadow-sm transition-all duration-200",
                borderClass
            )}
        >
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
                <div className="flex items-center gap-2.5 min-w-0">
                    {/* Status dot */}
                    <div className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        status === "complete" && "bg-emerald-500",
                        status === "incomplete" && "bg-orange-400 animate-pulse",
                        status === "excess" && "bg-red-500"
                    )} />

                    <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{line.productName}</p>
                        <p className="text-[10px] text-muted-foreground">
                            {line.sku} • {line.branchName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Serial count badge */}
                    <Badge
                        variant={status === "complete" ? "default" : "outline"}
                        className={cn(
                            "text-[10px] font-black tabular-nums",
                            status === "complete" && "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
                            status === "incomplete" && "bg-orange-500/10 text-orange-600 border-orange-400/30",
                            status === "excess" && "bg-red-500/10 text-red-600 border-red-400/30"
                        )}
                    >
                        {totalEntered} / {required} SERIAL{required !== 1 ? "S" : ""}
                    </Badge>

                    {/* Qty is read-only (fixed from DB) */}
                    <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        QTY: {required}
                    </span>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="p-4 space-y-3">
                {/* Serial input row */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            id={`serial-input-${line.lineId}`}
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder={isValidating ? "Validating…" : "Scan or type serial number, then press Enter…"}
                            className="pl-9 pr-8 h-9 text-xs font-mono"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={isValidating || status === "complete"}
                        />
                        {isValidating && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <svg className="animate-spin h-3.5 w-3.5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    <Button
                        id={`serial-add-btn-${line.lineId}`}
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => commitSerial(inputValue)}
                        disabled={!inputValue.trim() || isValidating || status === "complete"}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>

                    <Button
                        id={`serial-paste-btn-${line.lineId}`}
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={handleManualPaste}
                        title="Paste serials from clipboard (newline/comma separated)"
                        disabled={isValidating || status === "complete"}
                    >
                        <ClipboardPaste className="h-4 w-4" />
                    </Button>
                </div>

                {/* Status message */}
                {status === "incomplete" && totalEntered > 0 && (
                    <p className="text-[10px] text-orange-500 font-medium">
                        {required - totalEntered} more serial{required - totalEntered !== 1 ? "s" : ""} needed
                    </p>
                )}
                {status === "incomplete" && totalEntered === 0 && (
                    <p className="text-[10px] text-muted-foreground">
                        Scan or type {required} serial number{required !== 1 ? "s" : ""} for this line.
                    </p>
                )}
                {status === "excess" && (
                    <p className="text-[10px] text-red-500 font-medium">
                        {totalEntered - required} too many — remove draft serials until count matches.
                    </p>
                )}
                {status === "complete" && (
                    <p className="text-[10px] text-emerald-600 font-bold">
                        ✓ All {required} serials registered for this line
                    </p>
                )}

                {/* ── Saved serials (read-only, already in DB) ── */}
                {line.savedSerials.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                            Saved ({line.savedSerials.length})
                        </p>
                        <ScrollArea className={line.savedSerials.length > 4 ? "h-24" : undefined}>
                            <div className="space-y-1">
                                {line.savedSerials.map((s, idx) => (
                                    <div
                                        key={`saved-${s.serial_number}-${idx}`}
                                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
                                    >
                                        <span className="text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                            <Lock className="h-2.5 w-2.5 opacity-60" />
                                            {String(idx + 1).padStart(2, "0")}. {s.serial_number}
                                        </span>
                                        <span className="text-[9px] text-emerald-600 font-black">SAVED</span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* ── Draft serials (this session, removable) ── */}
                {line.draftSerials.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                            Draft — not yet saved ({line.draftSerials.length})
                        </p>
                        <ScrollArea className={line.draftSerials.length > 4 ? "h-24" : undefined}>
                            <div className="space-y-1">
                                {line.draftSerials.map((s, idx) => (
                                    <div
                                        key={`draft-${s.serial_number}-${idx}`}
                                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 group"
                                    >
                                        <span className="text-[11px] font-mono font-medium text-blue-700 dark:text-blue-300">
                                            {String(line.savedSerials.length + idx + 1).padStart(2, "0")}. {s.serial_number}
                                        </span>
                                        <Button
                                            id={`remove-draft-${line.lineId}-${idx}`}
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                            onClick={() => onRemoveDraft(line.lineId, idx)}
                                            aria-label={`Remove draft serial ${s.serial_number}`}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Empty state */}
                {line.savedSerials.length === 0 && line.draftSerials.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-4 gap-1.5 text-muted-foreground/60">
                        <ScanBarcode className="h-5 w-5" />
                        <p className="text-[10px]">Scan or type the first serial number</p>
                    </div>
                )}
            </div>
        </div>
    );
}
