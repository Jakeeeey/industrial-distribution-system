"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PackageSearch,
  Search,
  CheckSquare,
  Square,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

/**
 * AG-COMMENT: Helper to extract numeric ID from number, string, or object ({ id, product_id, branch_id })
 */
function parseNumericId(val: unknown): number {
  if (!val) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val === "string") {
    const n = parseInt(val, 10);
    return isNaN(n) ? 0 : n;
  }
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    const raw = obj.product_id ?? obj.branch_id ?? obj.id ?? 0;
    return parseNumericId(raw);
  }
  return 0;
}

/**
 * AG-COMMENT: Shape returned from v_serial_onhand via the onhand-serials API route.
 * v_serial_onhand provides: id, product_id, parent_id, branch_id, serial_number, status (Full/Empty)
 * Only 'Full' serials are ever returned by the API (status = 'Full' filter applied server-side).
 */
interface OnHandSerial {
  id: number;
  serial_number: string;
  product_id: number;
  parent_id?: number | null;
  branch_id: number;
  status?: string; // 'Full' or 'Empty' — only 'Full' records are returned
}

interface SerialPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productId: number | unknown;
  branchId: number | unknown;
  /** Already-assigned serials for THIS product item (pre-selected when editing) */
  initialSerials?: string[];
  /** Serials already used by OTHER items in the same adjustment (excluded from selection) */
  excludeSerials?: string[];
  onSave: (serials: string[]) => void;
}

/**
 * AG-COMMENT: SerialPickerModal — Stock OUT serial selection interface.
 *
 * Presents a searchable, checkable grid of FULL on-hand serials sourced from
 * vos_database.v_serial_onhand for the selected branch + product.
 *
 * Rules:
 *  - Only serials with status = 'Full' are shown (filter enforced on API side)
 *  - Registration is NEVER offered — this modal is strictly for picking
 *  - Serials already picked by other line-items are excluded
 *  - Previously saved serials for THIS item are pre-selected
 *  - Supports smooth full scrolling for arbitrarily large serial sets
 *
 * Used exclusively when adjustment type = "OUT".
 */
export function SerialPickerModal({
  open,
  onOpenChange,
  productName,
  productId,
  branchId,
  initialSerials = [],
  excludeSerials = [],
  onSave,
}: SerialPickerModalProps) {
  const [allSerials, setAllSerials] = useState<OnHandSerial[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSerials));
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const resolvedBranchId = useMemo(() => parseNumericId(branchId), [branchId]);
  const resolvedProductId = useMemo(() => parseNumericId(productId), [productId]);

  const fetchAvailableSerials = useCallback(async (bId?: number, pId?: number) => {
    const activeBranch = bId ?? resolvedBranchId;
    const activeProduct = pId ?? resolvedProductId;

    if (!activeBranch) {
      setFetchError("Branch must be selected before picking serials.");
      return;
    }
    if (!activeProduct) {
      setFetchError("Product must be selected before picking serials.");
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        branchId: String(activeBranch),
        productId: String(activeProduct),
      });
      const res = await fetch(
        `/api/ids/scm/inventory-management/stock-adjustment-serial-registration/onhand-serials?${params.toString()}`
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch available serials");
      setAllSerials(result.data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch available serials";
      setFetchError(msg);
      console.error("SerialPickerModal fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedBranchId, resolvedProductId]);

  // AG-COMMENT: Re-initialise selections and re-fetch whenever the modal opens or target IDs update
  useEffect(() => {
    if (!open) return;
    setSelected(new Set(initialSerials));
    setSearch("");
    setFetchError(null);
    fetchAvailableSerials();
  }, [open, resolvedBranchId, resolvedProductId, fetchAvailableSerials]); // eslint-disable-line react-hooks/exhaustive-deps

  // AG-COMMENT: Exclude serials already used by OTHER items; still show if THIS item has it selected
  const filteredSerials = useMemo(() => {
    const excludeSet = new Set(excludeSerials.map((s) => s.toUpperCase()));
    return allSerials.filter((s) => {
      const sn = String(s.serial_number).toUpperCase();
      const isCurrentlySelected = selected.has(s.serial_number);
      // Allow display if already selected for this item even if in excludeSet
      if (excludeSet.has(sn) && !isCurrentlySelected) return false;
      if (!search.trim()) return true;
      return sn.includes(search.trim().toUpperCase());
    });
  }, [allSerials, excludeSerials, selected, search]);

  const toggleSerial = (serialNumber: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serialNumber)) {
        next.delete(serialNumber);
      } else {
        next.add(serialNumber);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    // AG-COMMENT: Select all currently visible (search-filtered) serials
    setSelected((prev) => {
      const next = new Set(prev);
      filteredSerials.forEach((s) => next.add(s.serial_number));
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredSerials.forEach((s) => next.delete(s.serial_number));
      return next;
    });
  };

  const handleSave = () => {
    if (selected.size === 0) {
      toast.error("No serials selected", {
        description: "Please select at least one serial number to pick for this adjustment.",
      });
      return;
    }
    onSave(Array.from(selected));
    onOpenChange(false);
  };

  const allFilteredSelected =
    filteredSerials.length > 0 && filteredSerials.every((s) => selected.has(s.serial_number));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[900px] border-none shadow-2xl overflow-hidden p-0 bg-card h-[90vh] sm:h-[650px] max-h-[850px] flex flex-col">
        {/* Header */}
        <div className="bg-primary p-4 sm:p-6 text-white shadow-inner shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 dark:bg-black/20 p-2 rounded-lg backdrop-blur-md">
                <PackageSearch className="h-6 w-6 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white/95">
                Pick On-Hand Serials
              </DialogTitle>
            </div>
            <p className="text-white/80 text-sm font-medium">
              Selecting FULL on-hand serials for:{" "}
              <span className="text-white font-bold underline decoration-white/30 underline-offset-4">
                {productName}
              </span>
            </p>
            <p className="text-white/60 text-xs mt-1">
              Only Full serials currently on-hand at this branch are shown.
            </p>
          </DialogHeader>
        </div>

        {/* Controls bar */}
        <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-border flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search serial number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl border-primary/20 focus:border-primary font-mono text-xs"
              autoFocus
            />
          </div>
          {/* Bulk actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={allFilteredSelected ? handleDeselectAll : handleSelectAll}
              disabled={filteredSerials.length === 0}
              className="h-9 px-3 text-xs font-bold gap-1.5 rounded-lg"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare className="h-3.5 w-3.5" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5" />
                  Select All
                </>
              )}
            </Button>
            <span className="text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">
              {selected.size} PICKED
            </span>
          </div>
        </div>

        {/* Serial list with direct overflow-y-auto scrollable container */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
          {isLoading ? (
            <div className="h-full min-h-[250px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 opacity-60">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">
                  Loading on-hand serials...
                </p>
              </div>
            </div>
          ) : fetchError ? (
            <div className="h-full min-h-[250px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center max-w-sm">
                <div className="p-3 bg-red-100 dark:bg-red-950/20 rounded-full">
                  <AlertCircle className="h-7 w-7 text-red-500" />
                </div>
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{fetchError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAvailableSerials()}
                  className="mt-1 gap-1.5 font-bold"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            </div>
          ) : filteredSerials.length === 0 ? (
            <div className="h-full min-h-[250px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 opacity-50 text-center py-12">
                <PackageSearch className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm font-bold text-muted-foreground">
                  {allSerials.length === 0
                    ? "No FULL on-hand serials found for this product at the selected branch."
                    : "No serials match your search."}
                </p>
                {allSerials.length === 0 && (
                  <p className="text-xs text-muted-foreground/70 max-w-xs">
                    Ensure inventory has been received at this branch before creating a Stock Out
                    adjustment.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* AG-COMMENT: Grid of selectable serial cards with full native scrollability */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pb-6">
              {filteredSerials.map((serial) => {
                const isSelected = selected.has(serial.serial_number);
                return (
                  <button
                    key={serial.id}
                    type="button"
                    onClick={() => toggleSerial(serial.serial_number)}
                    className={`relative flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-150 ${
                      isSelected
                        ? "border-primary bg-primary/10 dark:bg-primary/20 ring-2 ring-primary/30 shadow-md"
                        : "border-border bg-muted/5 hover:bg-muted/30 hover:border-primary/30"
                    }`}
                  >
                    {/* Selection indicator */}
                    <div
                      className={`absolute top-2 right-2 transition-all ${
                        isSelected ? "text-primary" : "text-muted-foreground/30"
                      }`}
                    >
                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </div>

                    {/* Serial number */}
                    <span className="font-mono text-xs font-bold text-foreground pr-5 leading-tight break-all">
                      {serial.serial_number}
                    </span>

                    {/* Status badge — always 'Full' for this picker */}
                    <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                      {serial.status || "Full"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="bg-muted/10 p-4 sm:p-6 border-t border-border flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
          <div className="flex-1 flex items-center">
            <p className="text-xs text-muted-foreground font-medium">
              {filteredSerials.length} serial(s) on-hand ·{" "}
              <span className="text-primary font-bold">{selected.size} selected</span>
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-11 font-bold text-muted-foreground hover:bg-card hover:text-foreground rounded-xl transition-all"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={selected.size === 0 || isLoading}
            className="h-11 px-8 font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/10 rounded-xl transition-all gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Pick {selected.size > 0 ? selected.size : ""} Serial{selected.size !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
