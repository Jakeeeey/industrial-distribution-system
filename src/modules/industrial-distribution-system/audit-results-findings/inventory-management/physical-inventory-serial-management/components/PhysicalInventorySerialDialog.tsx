//src/modules/industrial-distribution-system/supply-chain-management/physical-inventory-serial-management/components/PhysicalInventorySerialDialog.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import type {
    GroupedPhysicalInventoryChildRow,
    PhysicalInventoryDetailSerialRow,
    PhysicalInventoryDetailRow,
    ProductRow,
} from "../types";
import {
    createPhysicalInventoryDetailSerial,
    deletePhysicalInventoryDetailSerial,
    fetchPhysicalInventoryDetailSerial,
    fetchPhysicalInventoryDetailSerialByDetailId,
    fetchHistoricalSerialScan,
    fetchSerialOnhandByTag,
    fetchSerialOnhandByBranch,
    updatePhysicalInventoryDetail,
    fetchCylinderAssetBySerial,
    updateCylinderAsset,
} from "../providers/fetchProvider";
import {
    computeAmount,
    computeDifferenceCost,
    computeVariance,
} from "../utils/compute";
import { RegisterCylinderAssetModal } from "./RegisterCylinderAssetModal";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2 } from "lucide-react";

type SerialSavedPayload = {
    updatedDetail: PhysicalInventoryDetailRow;
    serialCount: number;
};

type Props = {
    open: boolean;
    row: GroupedPhysicalInventoryChildRow | null;
    branchId: number | null;
    products?: ProductRow[];
    onOpenChange: (open: boolean) => void;
    onSaved?: (payload: SerialSavedPayload) => Promise<void> | void;
};

function normalizeTag(value: string): string {
    return value.trim().toUpperCase();
}

function sameTag(a: string, b: string): boolean {
    return normalizeTag(a) === normalizeTag(b);
}

function isValidExactSerialTag(value: string): boolean {
    return normalizeTag(value).length > 0;
}

function getSerialValidationMessage(value: string): string {
    const normalized = normalizeTag(value);

    if (!normalized) {
        return "Serial tag is required.";
    }

    return "";
}

export function PhysicalInventorySerialDialog(props: Props) {
    const {
        open,
        row,
        branchId,
        products = [],
        onOpenChange,
        onSaved,
    } = props;

    const [tags, setTags] = React.useState<PhysicalInventoryDetailSerialRow[]>([]);
    const [allPiTags, setAllPiTags] = React.useState<PhysicalInventoryDetailSerialRow[]>([]);
    const [serialInput, setSerialInput] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [onhandCache, setOnhandCache] = React.useState<Map<string, number>>(new Map());
    const [isSaving, setIsSaving] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<number | null>(null);
    const [pendingSerials, setPendingSerials] = React.useState<string[]>([]);
    const [showRegistrationModal, setShowRegistrationModal] = React.useState(false);
    const [flash, setFlash] = React.useState<"success" | "error" | null>(null);

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const refocusTimerRef = React.useRef<number | null>(null);

    const detailId = row?.detail_id ?? null;
    const phId = row?.ph_id ?? null;

    const clearRefocusTimer = React.useCallback(() => {
        if (refocusTimerRef.current !== null) {
            window.clearTimeout(refocusTimerRef.current);
            refocusTimerRef.current = null;
        }
    }, []);

    const focusInput = React.useCallback((shouldSelect?: boolean) => {
        clearRefocusTimer();

        refocusTimerRef.current = window.setTimeout(() => {
            const input = inputRef.current;
            if (!input) return;

            input.focus();

            if (shouldSelect) {
                input.select();
            }
        }, 0);
    }, [clearRefocusTimer]);

    const loadTags = React.useCallback(async () => {
        if (!detailId) {
            setTags([]);
            setAllPiTags([]);
            return;
        }

        try {
            setIsLoading(true);

            const CACHE_KEY = `serial_onhand_${branchId}`;
            const cachedStorage = localStorage.getItem(CACHE_KEY);
            const nextCache = new Map<string, number>();

            if (cachedStorage) {
                try {
                    const parsed = JSON.parse(cachedStorage);
                    if (Array.isArray(parsed)) {
                        for (const [key, val] of parsed) {
                            nextCache.set(key, val);
                        }
                    }
                } catch {
                    // ignore parse error
                }
            }

            const [detailTags, piTags] = await Promise.all([
                fetchPhysicalInventoryDetailSerialByDetailId(detailId),
                phId ? fetchPhysicalInventoryDetailSerial(phId) : Promise.resolve([]),
            ]);

            setTags(detailTags);
            setAllPiTags(piTags);

            if (nextCache.size === 0 && branchId) {
                const onhandRows = await fetchSerialOnhandByBranch(branchId);
                for (const row of onhandRows) {
                    nextCache.set(row.serial, row.productId);
                }
                localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(nextCache.entries())));
            }

            setOnhandCache(nextCache);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to load Serial tags.";
            toast.error(message);
        } finally {
            setIsLoading(false);
            focusInput();
        }
    }, [detailId, phId, branchId, focusInput]);

    React.useEffect(() => {
        if (!open) {
            setSerialInput("");
            setTags([]);
            setAllPiTags([]);
            setPendingSerials([]);
            clearRefocusTimer();
            return;
        }

        void loadTags();
    }, [clearRefocusTimer, loadTags, open]);

    React.useEffect(() => {
        if (!open) return;

        const timer = window.setTimeout(() => {
            focusInput();
        }, 50);

        return () => window.clearTimeout(timer);
    }, [focusInput, open]);

    React.useEffect(() => {
        return () => {
            clearRefocusTimer();
        };
    }, [clearRefocusTimer]);

    const hasDuplicateInCurrentPi = React.useCallback(
        (serialTag: string): boolean => {
            return allPiTags.some((tag) => sameTag(tag.serial_number, serialTag));
        },
        [allPiTags],
    );

    const persistRowFromSerialCount = React.useCallback(
        async (nextSerialCount: number): Promise<PhysicalInventoryDetailRow> => {
            if (!detailId || !row) {
                throw new Error("Detail row is not available.");
            }

            const nextVariance = computeVariance(nextSerialCount, row.system_count);
            const nextDifferenceCost = computeDifferenceCost(
                nextVariance,
                row.unit_price,
            );
            const nextAmount = computeAmount(nextSerialCount, row.unit_price);

            return updatePhysicalInventoryDetail(detailId, {
                physical_count: nextSerialCount,
                variance: nextVariance,
                difference_cost: nextDifferenceCost,
                amount: nextAmount,
            });
        },
        [detailId, row],
    );

    const persistTag = React.useCallback(
        async (serialTag: string) => {
            if (!detailId) {
                toast.error("Detail row is not available.");
                focusInput(true);
                return;
            }

            if (!isValidExactSerialTag(serialTag)) {
                toast.error(
                    `Invalid Serial tag. It cannot be empty.`,
                );
                setSerialInput("");
                focusInput(true);
                return;
            }

            if (hasDuplicateInCurrentPi(serialTag)) {
                toast.error("This Serial tag already exists in the current PI.");
                setSerialInput("");
                setFlash("error");
                setTimeout(() => setFlash(null), 500);
                focusInput();
                return;
            }

            if (!branchId) {
                const message = "Branch is required before verifying Serial.";
                toast.error(message);
                setSerialInput("");
                focusInput();
                return;
            }

            // Verify where it belongs (Current On-hand)
            // Use local cache for instant lookup to support fast scan
            let serialProductId: number | null = null;
            const cachedProductId = onhandCache.get(serialTag);

            if (cachedProductId !== undefined) {
                serialProductId = cachedProductId;
            } else {
                try {
                    // Background fallback to API if not in cache (though pre-fetch should cover most)
                    const resolved = await fetchSerialOnhandByTag(serialTag, branchId);
                    if (resolved.ok && resolved.item) {
                        serialProductId = resolved.item.productId;
                        // Update cache for future scans in this session
                        setOnhandCache((prev) => {
                            const next = new Map(prev);
                            next.set(serialTag, serialProductId!);
                            localStorage.setItem(`serial_onhand_${branchId}`, JSON.stringify(Array.from(next.entries())));
                            return next;
                        });
                    }
                } catch {
                    // API error or 404
                }
            }

            // Not found in local branch on-hand? Check global cylinder_assets
            if (serialProductId === null) {
                const globalAsset = await fetchCylinderAssetBySerial(serialTag);
                if (globalAsset) {
                    // Mismatch Protection: If it exists but is for a DIFFERENT product
                    if (globalAsset.product_id !== row?.product_id) {
                        const message = `Serial ${serialTag} exists globally but belongs to product ID ${globalAsset.product_id}. This row is for "${row?.product_name || "a different product"}".`;
                        toast.error(message);
                        setSerialInput("");
                        focusInput();
                        return;
                    }

                    // Reassign to current branch!
                    // Status mirrors registration logic: EMPTY UOM → EMPTY, otherwise AVAILABLE
                    const reassignStatus: import("../types").CylinderAssetRow["cylinder_status"] =
                        (row?.unit_name ?? row?.unit_shortcut)?.toUpperCase() === "EMPTY"
                            ? "EMPTY"
                            : "AVAILABLE";
                    try {
                        await updateCylinderAsset(globalAsset.id, {
                            current_branch_id: branchId,
                            cylinder_status: reassignStatus,
                        });

                        // Update local cache for this session
                        setOnhandCache((prev) => {
                            const next = new Map(prev);
                            next.set(serialTag, globalAsset.product_id);
                            localStorage.setItem(`serial_onhand_${branchId}`, JSON.stringify(Array.from(next.entries())));
                            return next;
                        });

                        serialProductId = globalAsset.product_id;
                        toast.info(`Serial ${serialTag} reassigned to this branch.`);
                    } catch {
                        toast.error("Failed to reassign serial to current branch.");
                        return;
                    }
                } else {
                    // Not found globally either? Add to pending queue!
                    setPendingSerials((prev) => [...new Set([...prev, serialTag])]);
                    setSerialInput("");
                    setFlash("success");
                    setTimeout(() => setFlash(null), 500);
                    focusInput();
                    return;
                }
            }

            // If the Serial belongs to a DIFFERENT product (found in on-hand or reassigned), prohibit it
            if (serialProductId !== null && serialProductId !== row?.product_id) {
                const mismatchedProduct = products.find(p => p.product_id === serialProductId);
                const mismatchedName = mismatchedProduct?.product_name || `Product ID ${serialProductId}`;

                const message = `Scanned Serial belongs to "${mismatchedName}", but this row is for "${row?.product_name || "a different product"}".`;
                toast.error(message, {
                    description: `Serial: ${serialTag}`,
                });
                setSerialInput("");
                setFlash("error");
                setTimeout(() => setFlash(null), 500);
                focusInput();
                return;
            }

            // Final safety check: if we got here but still don't have a cylinder_asset record
            // (this handles cases where it was in v-serial-onhand but missing from cylinder_assets)
            const cylinderAsset = await fetchCylinderAssetBySerial(serialTag);
            if (!cylinderAsset) {
                setPendingSerials((prev) => [...new Set([...prev, serialTag])]);
                setSerialInput("");
                setFlash("success");
                setTimeout(() => setFlash(null), 500);
                focusInput();
                return;
            }

            // Verify historical records
            const historical = await fetchHistoricalSerialScan(serialTag);
            if (historical && historical.product_id !== row?.product_id) {
                const message = `This Serial was previously registered to product ID ${historical.product_id}, but this row is for "${row?.product_name || "a different product"}".`;
                toast.error(message, {
                    description: `Serial: ${serialTag}`,
                });
                setSerialInput("");
                focusInput();
                return;
            }

            const created = await createPhysicalInventoryDetailSerial({
                pi_detail_id: detailId,
                serial_number: serialTag,
            });

            const nextSerialCount = tags.length + 1;
            const updatedDetail = await persistRowFromSerialCount(nextSerialCount);

            setTags((prev) => [created, ...prev]);
            setAllPiTags((prev) => [created, ...prev]);
            setSerialInput("");

            if (onSaved) {
                await onSaved({
                    updatedDetail,
                    serialCount: nextSerialCount,
                });
            }

            toast.success("Serial tag added.");
            setFlash("success");
            setTimeout(() => setFlash(null), 500);
            focusInput();
        },
        [
            detailId,
            focusInput,
            hasDuplicateInCurrentPi,
            onSaved,
            persistRowFromSerialCount,
            tags.length,
            branchId,
            onhandCache,
            row?.product_id,
            row?.product_name,
            row?.unit_name,
            row?.unit_shortcut,
            products,
        ],
    );

    const handleRegistrationSuccess = async (registeredSerials: string[]) => {
        if (!detailId) return;

        try {
            setIsSaving(true);

            // For each registered serial, create a PI detail serial record
            const createdTags: PhysicalInventoryDetailSerialRow[] = [];

            for (const serial of registeredSerials) {
                const created = await createPhysicalInventoryDetailSerial({
                    pi_detail_id: detailId,
                    serial_number: serial,
                });
                createdTags.push(created);
            }

            const nextSerialCount = tags.length + registeredSerials.length;
            const updatedDetail = await persistRowFromSerialCount(nextSerialCount);

            setTags((prev) => [...createdTags, ...prev]);
            setAllPiTags((prev) => [...createdTags, ...prev]);
            setSerialInput("");

            setOnhandCache((prev) => {
                const next = new Map(prev);
                for (const serial of registeredSerials) {
                    next.set(serial, row!.product_id);
                }
                if (branchId) {
                    localStorage.setItem(`serial_onhand_${branchId}`, JSON.stringify(Array.from(next.entries())));
                }
                return next;
            });

            if (onSaved) {
                await onSaved({
                    updatedDetail,
                    serialCount: nextSerialCount,
                });
            }

            setPendingSerials([]);
            focusInput();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to add registered serials.";
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddTagManual = React.useCallback(async () => {
        const normalized = normalizeTag(serialInput);
        const validationMessage = getSerialValidationMessage(normalized);

        if (validationMessage) {
            toast.error(validationMessage);
            focusInput(true);
            return;
        }

        try {
            setIsSaving(true);
            await persistTag(normalized);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to add Serial tag.";
            toast.error(message);
            focusInput(true);
        } finally {
            setIsSaving(false);
            focusInput();
        }
    }, [focusInput, persistTag, serialInput]);

    const handleDeleteTag = React.useCallback(
        async (id: number) => {
            try {
                setDeletingId(id);
                await deletePhysicalInventoryDetailSerial(id);

                const nextSerialCount = Math.max(0, tags.length - 1);
                const updatedDetail = await persistRowFromSerialCount(nextSerialCount);

                setTags((prev) => prev.filter((rowItem) => rowItem.id !== id));
                setAllPiTags((prev) => prev.filter((rowItem) => rowItem.id !== id));

                if (onSaved) {
                    await onSaved({
                        updatedDetail,
                        serialCount: nextSerialCount,
                    });
                }

                toast.success("Serial tag removed.");
                focusInput();
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Failed to delete Serial tag.";
                toast.error(message);
                focusInput();
            } finally {
                setDeletingId(null);
            }
        },
        [focusInput, onSaved, persistRowFromSerialCount, tags.length],
    );

    const inputErrorMessage = React.useMemo(() => {
        if (!serialInput) return "";
        return getSerialValidationMessage(serialInput);
    }, [serialInput]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[96vh] w-[94vw] p-0 sm:max-w-2xl sm:w-full sm:rounded-2xl flex flex-col overflow-hidden">
                <div className="shrink-0 px-6 pt-6 pb-2">
                    <DialogHeader>
                        <DialogTitle>Serial Tag Review</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                            Review saved Serial tags, manually add missing tags, or
                            remove incorrect ones.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-6 pb-6 gap-4">
                    <div className="rounded-xl border bg-muted/30 p-3 text-[11px] sm:p-4 sm:text-sm shrink-0">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <p className="col-span-2 sm:col-span-1">
                                <span className="font-semibold text-muted-foreground mr-1">Product:</span>
                                <span className="font-medium text-foreground">{row?.product_name ?? "—"}</span>
                            </p>
                            <p>
                                <span className="font-semibold text-muted-foreground mr-1">UOM:</span>
                                <span className="font-medium text-foreground">{row?.unit_name ?? row?.unit_shortcut ?? "—"}</span>
                            </p>
                            <p className="hidden sm:block">
                                <span className="font-semibold text-muted-foreground mr-1">Product ID:</span>
                                <span className="font-medium text-foreground">{row?.product_id ?? "—"}</span>
                            </p>
                            <p>
                                <span className="font-semibold text-muted-foreground mr-1">Count:</span>
                                <span className="font-bold text-primary">{tags.length}</span>
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2 shrink-0">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                ref={inputRef}
                                placeholder="Scan or enter Serial tag"
                                value={serialInput}
                                maxLength={100}
                                onChange={(e) => {
                                    const nextValue = e.target.value.toUpperCase();
                                    setSerialInput(nextValue);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        if (!isSaving) {
                                            void handleAddTagManual();
                                        }
                                    }
                                }}
                                onBlur={() => {
                                    if (!open || isSaving || deletingId !== null) return;
                                    focusInput();
                                }}
                                disabled={!detailId || isSaving}
                                className={`${inputErrorMessage ? "border-destructive" : ""} ${flash === "success"
                                        ? "border-green-500 ring-2 ring-green-500/20 bg-green-50"
                                        : flash === "error"
                                            ? "border-red-500 ring-2 ring-red-500/20 bg-red-50"
                                            : ""
                                    } transition-all duration-200`}
                            />

                            <Button
                                type="button"
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => void handleAddTagManual()}
                                disabled={!detailId || isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Manual
                                    </>
                                )}
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Scan a serial barcode or type it in manually.
                        </p>

                        {inputErrorMessage ? (
                            <p className="text-xs text-destructive">{inputErrorMessage}</p>
                        ) : null}

                        <p className="text-[10px] text-muted-foreground sm:text-xs">
                            This field stays armed for continuous scan input.
                        </p>
                    </div>

                    <div className="rounded-xl border flex-1 min-h-[200px] overflow-y-auto bg-background">
                        <div className="divide-y p-1">
                            {pendingSerials.length > 0 && (
                                <div className="bg-amber-50/50 p-3 flex flex-col gap-2 border-b">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-amber-700">
                                            {pendingSerials.length} UNREGISTERED SERIALS
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 text-[10px] bg-amber-600 text-white hover:bg-amber-700"
                                            onClick={() => setShowRegistrationModal(true)}
                                        >
                                            Register All
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {pendingSerials.map((s) => (
                                            <span key={s} className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-medium border border-amber-200">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isLoading ? (
                                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading Serial tags...
                                </div>
                            ) : tags.length ? (
                                tags.map((tag) => (
                                    <div
                                        key={tag.id}
                                        className="flex items-center justify-between gap-3 p-4"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">
                                                {tag.serial_number}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Created at: {tag.created_at ?? "—"}
                                            </p>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="cursor-pointer shrink-0"
                                            onClick={() => void handleDeleteTag(tag.id)}
                                            disabled={deletingId === tag.id}
                                        >
                                            {deletingId === tag.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Remove
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                ))
                            ) : (
                                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                                    No Serial tags registered yet.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </DialogContent>

            <RegisterCylinderAssetModal
                open={showRegistrationModal}
                onOpenChange={(isOpen) => {
                    setShowRegistrationModal(isOpen);
                    if (!isOpen) {
                        focusInput();
                    }
                }}
                serials={pendingSerials}
                productId={row?.product_id ?? null}
                branchId={branchId}
                uomName={row?.unit_name ?? row?.unit_shortcut ?? null}
                onSuccess={(serials) => {
                    void handleRegistrationSuccess(serials);
                }}
                onClear={() => setPendingSerials([])}
                onRemoveRow={(serial) => setPendingSerials((prev) => prev.filter((s) => s !== serial))}
            />
        </Dialog>
    );
}
