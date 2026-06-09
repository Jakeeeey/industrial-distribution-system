"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Printer,
  Hash,
  Barcode as BarcodeIcon,
  ArrowLeft,
  Search,
} from "lucide-react";

import type {
  EnrichedSerial,
  PrintOptions,
  ProductGroup,
  ViewMode,
} from "../type";
import { InventoryPrintView } from "./InventoryPrintView";

interface InventoryDetailModalProps {
  product: ProductGroup | null;
  open: boolean;
  onClose: () => void;
  setViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredSerials: EnrichedSerial[];
  printOptions: PrintOptions;
  setPrintOptions: (opts: Partial<PrintOptions>) => void;
  initialStockFilter?: "full" | "empty" | null;
}

export function InventoryDetailModal({
  product,
  open,
  onClose,
  setViewMode,
  filteredSerials,
  printOptions,
  setPrintOptions,
  initialStockFilter,
  searchQuery,
  setSearchQuery,
}: InventoryDetailModalProps) {
  const [activeMode, setActiveMode] = useState<
    "list" | "choice" | "serial" | "barcode"
  >(() => "list");

  const [activeStockFilter, setActiveStockFilter] = useState<
    "full" | "empty" | null
  >(() => initialStockFilter ?? null);

  const [selectedSerialIds, setSelectedSerialIds] = useState<Set<number>>(
    () => new Set(filteredSerials.map((s) => s.id)),
  );
  const printRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.0);

  const toggleSelectAll = () => {
    if (selectedSerialIds.size === displayedSerials.length) {
      setSelectedSerialIds(new Set());
    } else {
      setSelectedSerialIds(new Set(displayedSerials.map((s) => s.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedSerialIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fullSerials = useMemo(() => {
    return filteredSerials.filter((s) => s.isFull);
  }, [filteredSerials]);

  const emptySerials = useMemo(() => {
    return filteredSerials.filter((s) => !s.isFull);
  }, [filteredSerials]);

  // Apply the stock filter on top of filteredSerials
  const displayedSerials =
    activeStockFilter === "full"
      ? fullSerials
      : activeStockFilter === "empty"
        ? emptySerials
        : filteredSerials;

  const toggleSelectAllFull = () => {
    const allFullIds = fullSerials.map((s) => s.id);
    const hasAllFullSelected = allFullIds.every((id) =>
      selectedSerialIds.has(id),
    );
    setSelectedSerialIds((prev) => {
      const next = new Set(prev);
      if (hasAllFullSelected) {
        allFullIds.forEach((id) => next.delete(id));
      } else {
        allFullIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectAllEmpty = () => {
    const allEmptyIds = emptySerials.map((s) => s.id);
    const hasAllEmptySelected = allEmptyIds.every((id) =>
      selectedSerialIds.has(id),
    );
    setSelectedSerialIds((prev) => {
      const next = new Set(prev);
      if (hasAllEmptySelected) {
        allEmptyIds.forEach((id) => next.delete(id));
      } else {
        allEmptyIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const hasBothTypes = product
    ? product.fullCount > 0 && product.emptyCount > 0
    : false;

  // When a stock filter is active, only one column; otherwise normal split logic
  const effectiveHasBothTypes = activeStockFilter === null && hasBothTypes;
  const shouldSplitSingleType =
    !effectiveHasBothTypes && displayedSerials.length > 10;
  const halfIndex = shouldSplitSingleType
    ? Math.ceil(displayedSerials.length / 2)
    : 0;

  const leftHalfSerials = useMemo(() => {
    if (!shouldSplitSingleType) return [];
    return displayedSerials.slice(0, halfIndex);
  }, [displayedSerials, shouldSplitSingleType, halfIndex]);

  const rightHalfSerials = useMemo(() => {
    if (!shouldSplitSingleType) return [];
    return displayedSerials.slice(halfIndex);
  }, [displayedSerials, shouldSplitSingleType, halfIndex]);

  const toggleSelectAllLeftHalf = () => {
    const leftIds = leftHalfSerials.map((s) => s.id);
    const hasAllLeftSelected = leftIds.every((id) => selectedSerialIds.has(id));
    setSelectedSerialIds((prev) => {
      const next = new Set(prev);
      if (hasAllLeftSelected) {
        leftIds.forEach((id) => next.delete(id));
      } else {
        leftIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectAllRightHalf = () => {
    const rightIds = rightHalfSerials.map((s) => s.id);
    const hasAllRightSelected = rightIds.every((id) =>
      selectedSerialIds.has(id),
    );
    setSelectedSerialIds((prev) => {
      const next = new Set(prev);
      if (hasAllRightSelected) {
        rightIds.forEach((id) => next.delete(id));
      } else {
        rightIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectedSerialsToPrint = useMemo(() => {
    return filteredSerials.filter((s) => selectedSerialIds.has(s.id));
  }, [filteredSerials, selectedSerialIds]);

  const printViewOptions = useMemo(
    () => ({
      mode: (activeMode === "serial" || activeMode === "barcode"
        ? activeMode
        : "serial") as "serial" | "barcode",
      paperSize: printOptions.paperSize,
      orientation: printOptions.orientation,
      columns: printOptions.columns,
      cardDisplay: printOptions.cardDisplay,
    }),
    [
      activeMode,
      printOptions.paperSize,
      printOptions.orientation,
      printOptions.columns,
      printOptions.cardDisplay,
    ],
  );

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${product?.productName ?? "Inventory"} - ${activeMode === "serial" ? "Serial Numbers" : "Barcodes"}`,
  });

  const onGeneratePrint = useCallback(() => {
    handlePrint();
  }, [handlePrint]);

  // Note: initial state for mode, stock filter, and selected serials is
  // provided via useState initializers. We rely on the parent to remount
  // this component when `product` changes (pass a `key` based on product id)
  // so the initializers run with the latest props and no effect is needed.

  if (!product) return null;

  const typeLabel =
    activeStockFilter === "full"
      ? "Full Cylinders"
      : activeStockFilter === "empty"
        ? "Empty Cylinders"
        : product.fullCount > 0
          ? "Full Cylinders"
          : "Empty Cylinders";

  const headerBgClass =
    activeStockFilter === "full"
      ? "bg-emerald-500/5"
      : activeStockFilter === "empty"
        ? "bg-rose-500/5"
        : product.fullCount > 0
          ? "bg-emerald-500/5"
          : "bg-rose-500/5";

  const textThemeClass =
    activeStockFilter === "full"
      ? "text-emerald-700 dark:text-emerald-400"
      : activeStockFilter === "empty"
        ? "text-rose-700 dark:text-rose-400"
        : product.fullCount > 0
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-rose-700 dark:text-rose-400";

  const isSplit = effectiveHasBothTypes || shouldSplitSingleType;

  // Card display options helpers
  const cardDisplay = printOptions.cardDisplay ?? {
    showBarcodeNumber: true,
    showSerialNumber: true,
    showProductName: false,
    showStatusBadge: true,
  };

  const updateCardDisplay = (key: keyof typeof cardDisplay, value: boolean) => {
    setPrintOptions({
      cardDisplay: {
        ...cardDisplay,
        [key]: value,
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        id="inventory-detail-modal"
        className={
          activeMode === "choice"
            ? "sm:max-w-md p-6 bg-background rounded-xl"
            : activeMode === "list"
              ? `${
                  isSplit ? "sm:max-w-3xl" : "sm:max-w-xl"
                } max-h-[90vh] flex flex-col p-6 bg-background rounded-xl overflow-hidden`
              : "sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-zinc-100 dark:bg-zinc-950 rounded-xl"
        }
      >
        {activeMode === "list" ? (
          // ── Serial List Screen ──────────────────────────────────
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-xl font-bold tracking-tight">
                {product.productName}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {product.categoryName} · {product.totalCount} Cylinders On-Hand
              </p>
            </DialogHeader>

            {/* Stock metrics summary — clickable to filter */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const next = activeStockFilter === "full" ? null : "full";
                  setActiveStockFilter(next);
                  // Re-select visible serials on filter change
                  const pool = next === "full" ? fullSerials : filteredSerials;
                  setSelectedSerialIds(new Set(pool.map((s) => s.id)));
                }}
                className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 border transition-all duration-150 ${
                  activeStockFilter === "full"
                    ? "bg-emerald-500/20 border-emerald-500/40 ring-2 ring-emerald-500/30"
                    : "bg-emerald-500/10 border-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/30"
                }`}
              >
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  Full Cylinders{activeStockFilter === "full" ? " ✓" : ""}
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {product.fullCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = activeStockFilter === "empty" ? null : "empty";
                  setActiveStockFilter(next);
                  const pool =
                    next === "empty" ? emptySerials : filteredSerials;
                  setSelectedSerialIds(new Set(pool.map((s) => s.id)));
                }}
                className={`flex items-center justify-between rounded-lg px-3.5 py-2.5 border transition-all duration-150 ${
                  activeStockFilter === "empty"
                    ? "bg-rose-500/20 border-rose-500/40 ring-2 ring-rose-500/30"
                    : "bg-rose-500/10 border-rose-500/10 hover:bg-rose-500/20 hover:border-rose-500/30"
                }`}
              >
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                  Empty Cylinders{activeStockFilter === "empty" ? " ✓" : ""}
                </span>
                <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">
                  {product.emptyCount}
                </span>
              </button>
            </div>

            {/* Active filter indicator */}
            {activeStockFilter && (
              <div
                className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg border shrink-0 ${
                  activeStockFilter === "full"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
                }`}
              >
                <span className="font-semibold">
                  Showing {activeStockFilter === "full" ? "Full" : "Empty"}{" "}
                  cylinders only
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveStockFilter(null);
                    setSelectedSerialIds(
                      new Set(filteredSerials.map((s) => s.id)),
                    );
                  }}
                  className="text-[10px] font-bold underline underline-offset-2 hover:opacity-70 transition-opacity"
                >
                  Show All
                </button>
              </div>
            )}

            {/* Modal search */}
            <div className="relative w-full max-w-md shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter serial number or barcode..."
                className="pl-9 pr-10"
              />

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* List/Table */}
            {effectiveHasBothTypes ? (
              <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
                {/* LEFT COLUMN: Full Cylinders */}
                <div className="flex flex-col min-h-0 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/30">
                  <div className="bg-emerald-500/5 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Full Cylinders ({fullSerials.length})
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-card border-b z-10">
                        <tr className="bg-muted/40 text-muted-foreground text-[10px] uppercase font-black tracking-wider">
                          <th className="py-2.5 px-4 w-12 text-center">
                            <Checkbox
                              checked={
                                fullSerials.length > 0 &&
                                fullSerials.every((s) =>
                                  selectedSerialIds.has(s.id),
                                )
                              }
                              onCheckedChange={toggleSelectAllFull}
                            />
                          </th>
                          <th className="py-2.5 px-4 w-12">#</th>
                          <th className="py-2.5 px-4">Serial Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fullSerials.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="text-center py-6 text-xs text-muted-foreground"
                            >
                              No full cylinders.
                            </td>
                          </tr>
                        ) : (
                          fullSerials.map((s, idx) => (
                            <tr
                              key={s.id}
                              className="border-b last:border-0 hover:bg-muted/30 text-xs"
                            >
                              <td className="py-2.5 px-4 text-center">
                                <Checkbox
                                  checked={selectedSerialIds.has(s.id)}
                                  onCheckedChange={() => toggleSelectOne(s.id)}
                                />
                              </td>
                              <td className="py-2.5 px-4 font-mono text-muted-foreground">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-4 font-bold font-mono text-foreground">
                                {s.serialNumber}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT COLUMN: Empty Cylinders */}
                <div className="flex flex-col min-h-0 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/30">
                  <div className="bg-rose-500/5 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                      Empty Cylinders ({emptySerials.length})
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-card border-b z-10">
                        <tr className="bg-muted/40 text-muted-foreground text-[10px] uppercase font-black tracking-wider">
                          <th className="py-2.5 px-4 w-12 text-center">
                            <Checkbox
                              checked={
                                emptySerials.length > 0 &&
                                emptySerials.every((s) =>
                                  selectedSerialIds.has(s.id),
                                )
                              }
                              onCheckedChange={toggleSelectAllEmpty}
                            />
                          </th>
                          <th className="py-2.5 px-4 w-12">#</th>
                          <th className="py-2.5 px-4">Serial Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emptySerials.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="text-center py-6 text-xs text-muted-foreground"
                            >
                              No empty cylinders.
                            </td>
                          </tr>
                        ) : (
                          emptySerials.map((s, idx) => (
                            <tr
                              key={s.id}
                              className="border-b last:border-0 hover:bg-muted/30 text-xs"
                            >
                              <td className="py-2.5 px-4 text-center">
                                <Checkbox
                                  checked={selectedSerialIds.has(s.id)}
                                  onCheckedChange={() => toggleSelectOne(s.id)}
                                />
                              </td>
                              <td className="py-2.5 px-4 font-mono text-muted-foreground">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-4 font-bold font-mono text-foreground">
                                {s.serialNumber}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : shouldSplitSingleType ? (
              <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
                {/* LEFT HALF COLUMN */}
                <div className="flex flex-col min-h-0 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/30">
                  <div
                    className={`${headerBgClass} px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0`}
                  >
                    <span className={`text-xs font-bold ${textThemeClass}`}>
                      {typeLabel} (1 - {halfIndex})
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-card border-b z-10">
                        <tr className="bg-muted/40 text-muted-foreground text-[10px] uppercase font-black tracking-wider">
                          <th className="py-2.5 px-4 w-12 text-center">
                            <Checkbox
                              checked={
                                leftHalfSerials.length > 0 &&
                                leftHalfSerials.every((s) =>
                                  selectedSerialIds.has(s.id),
                                )
                              }
                              onCheckedChange={toggleSelectAllLeftHalf}
                            />
                          </th>
                          <th className="py-2.5 px-4 w-12">#</th>
                          <th className="py-2.5 px-4">Serial Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leftHalfSerials.map((s, idx) => (
                          <tr
                            key={s.id}
                            className="border-b last:border-0 hover:bg-muted/30 text-xs"
                          >
                            <td className="py-2.5 px-4 text-center">
                              <Checkbox
                                checked={selectedSerialIds.has(s.id)}
                                onCheckedChange={() => toggleSelectOne(s.id)}
                              />
                            </td>
                            <td className="py-2.5 px-4 font-mono text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4 font-bold font-mono text-foreground">
                              {s.serialNumber}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT HALF COLUMN */}
                <div className="flex flex-col min-h-0 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/30">
                  <div
                    className={`${headerBgClass} px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0`}
                  >
                    <span className={`text-xs font-bold ${textThemeClass}`}>
                      {typeLabel} ({halfIndex + 1} - {displayedSerials.length})
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-card border-b z-10">
                        <tr className="bg-muted/40 text-muted-foreground text-[10px] uppercase font-black tracking-wider">
                          <th className="py-2.5 px-4 w-12 text-center">
                            <Checkbox
                              checked={
                                rightHalfSerials.length > 0 &&
                                rightHalfSerials.every((s) =>
                                  selectedSerialIds.has(s.id),
                                )
                              }
                              onCheckedChange={toggleSelectAllRightHalf}
                            />
                          </th>
                          <th className="py-2.5 px-4 w-12">#</th>
                          <th className="py-2.5 px-4">Serial Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rightHalfSerials.map((s, idx) => (
                          <tr
                            key={s.id}
                            className="border-b last:border-0 hover:bg-muted/30 text-xs"
                          >
                            <td className="py-2.5 px-4 text-center">
                              <Checkbox
                                checked={selectedSerialIds.has(s.id)}
                                onCheckedChange={() => toggleSelectOne(s.id)}
                              />
                            </td>
                            <td className="py-2.5 px-4 font-mono text-muted-foreground">
                              {idx + halfIndex + 1}
                            </td>
                            <td className="py-2.5 px-4 font-bold font-mono text-foreground">
                              {s.serialNumber}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-card border-b z-10">
                    <tr className="bg-muted/40 text-muted-foreground text-[10px] uppercase font-black tracking-wider">
                      <th className="py-2.5 px-4 w-12 text-center">
                        <Checkbox
                          checked={
                            displayedSerials.length > 0 &&
                            displayedSerials.every((s) =>
                              selectedSerialIds.has(s.id),
                            )
                          }
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="py-2.5 px-4">#</th>
                      <th className="py-2.5 px-4">Serial Number</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSerials.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center py-10 text-xs text-muted-foreground"
                        >
                          No serial numbers found for this product.
                        </td>
                      </tr>
                    ) : (
                      displayedSerials.map((s, idx) => (
                        <tr
                          key={s.id}
                          className="border-b last:border-0 hover:bg-muted/30 text-xs"
                        >
                          <td className="py-2.5 px-4 text-center">
                            <Checkbox
                              checked={selectedSerialIds.has(s.id)}
                              onCheckedChange={() => toggleSelectOne(s.id)}
                            />
                          </td>
                          <td className="py-2.5 px-4 font-mono text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-bold font-mono text-foreground">
                            {s.serialNumber}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                                s.isFull
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t mt-1">
              <Button
                variant="outline"
                onClick={onClose}
                className="h-10 px-4 text-xs font-bold"
              >
                Close
              </Button>
              <Button
                onClick={() => setActiveMode("choice")}
                disabled={selectedSerialIds.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-5 text-xs font-bold"
              >
                Show Printables ({selectedSerialIds.size})
              </Button>
            </div>
          </div>
        ) : activeMode === "choice" ? (
          // ── Mode Choice Screen ──────────────────────────────────
          <div className="flex flex-col items-center justify-center py-4 gap-6">
            <DialogHeader className="text-center w-full relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveMode("list")}
                className="absolute left-0 top-0 h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-center text-xl font-bold tracking-tight">
                LPG Inventory Printables
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 w-full mt-2">
              {/* Serial List Card */}
              <div
                onClick={() => {
                  setActiveMode("serial");
                  setViewMode("serial");
                }}
                className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card p-5 flex flex-col items-center text-center gap-3 cursor-pointer hover:border-blue-600 dark:hover:border-blue-500 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-all duration-200 shadow-sm"
              >
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <Hash className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-sm">Serial Number Report</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-normal">
                    Preview and print a formatted sheet of all cylinder serial
                    numbers.
                  </p>
                </div>
              </div>

              {/* Barcode Card */}
              <div
                onClick={() => {
                  setActiveMode("barcode");
                  setViewMode("barcode");
                }}
                className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-card p-5 flex flex-col items-center text-center gap-3 cursor-pointer hover:border-indigo-600 dark:hover:border-indigo-500 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-all duration-200 shadow-sm"
              >
                <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <BarcodeIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-sm">Barcode Report</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-normal">
                    Preview and print sheets of standard scanning barcodes.
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setActiveMode("list")}
                className="w-full h-11"
              >
                Back
              </Button>
            </div>
          </div>
        ) : (
          // ── Paper Print Preview Screen ──────────────────────────────
          <>
            {/* Header controls */}
            <DialogHeader className="p-4 bg-white dark:bg-zinc-900 shrink-0">
              {/* ROW 1: Title + Back */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setActiveMode("choice")}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>

                  <div className="min-w-0">
                    <DialogTitle className="text-base font-bold truncate">
                      {product.productName}
                    </DialogTitle>

                    <p className="text-xs text-muted-foreground truncate">
                      {product.categoryName} ·{" "}
                      {activeMode === "serial"
                        ? "Serial Number Report"
                        : "Barcode Report"}
                    </p>
                  </div>
                </div>
              </div>

              {/* ROW 2: Controls */}
              <div className="flex items-center gap-3 justify-end flex-wrap">
                {/* Layout */}
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Layout
                  </Label>

                  <Select
                    value={printOptions.orientation}
                    onValueChange={(v) => {
                      const newOrientation = v as "portrait" | "landscape";
                      setPrintOptions({ orientation: newOrientation });
                      setZoom(newOrientation === "landscape" ? 0.8 : 1.2);
                    }}
                  >
                    <SelectTrigger className="w-[100px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Size */}
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Size
                  </Label>

                  <Select
                    value={printOptions.paperSize}
                    onValueChange={(v) =>
                      setPrintOptions({ paperSize: v as "A4" | "Letter" })
                    }
                  >
                    <SelectTrigger className="w-[85px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="Letter">Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Columns */}
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Cols
                  </Label>

                  <Select
                    value={String(printOptions.columns || 3)}
                    onValueChange={(v) =>
                      setPrintOptions({ columns: Number(v) })
                    }
                  >
                    <SelectTrigger className="w-[80px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Col</SelectItem>
                      <SelectItem value="3">3 Col</SelectItem>
                      <SelectItem value="4">4 Col</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Zoom */}
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Zoom
                  </Label>

                  <Select
                    value={String(zoom)}
                    onValueChange={(v) => setZoom(Number(v))}
                  >
                    <SelectTrigger className="w-[85px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">50%</SelectItem>
                      <SelectItem value="0.6">60%</SelectItem>
                      <SelectItem value="0.7">70%</SelectItem>
                      <SelectItem value="0.8">80%</SelectItem>
                      <SelectItem value="0.9">90%</SelectItem>
                      <SelectItem value="1">100%</SelectItem>
                      <SelectItem value="1.2">120%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={onGeneratePrint}
                    size="sm"
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-8"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="h-8"
                  >
                    Close
                  </Button>
                </div>
              </div>

              {/* ROW 3: Card Display Options */}
              <div className="flex items-center gap-4 pt-2 border-t border-border/40 flex-wrap justify-end">
                {/* <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider shrink-0">
                                    Card Shows:
                                </span> */}

                {/* Barcode number — only relevant in barcode mode */}
                {activeMode === "barcode" && (
                  <label
                    htmlFor="card-show-barcode-number"
                    className="flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <Checkbox
                      id="card-show-barcode-number"
                      checked={cardDisplay.showBarcodeNumber}
                      onCheckedChange={(v) =>
                        updateCardDisplay("showBarcodeNumber", !!v)
                      }
                    />
                    <span className="text-xs font-semibold text-foreground">
                      Barcode Number
                    </span>
                  </label>
                )}

                {/* Serial Number */}
                {activeMode === "serial" && (
                  <label
                    htmlFor="card-show-serial-number"
                    className="flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <Checkbox
                      id="card-show-serial-number"
                      checked={cardDisplay.showSerialNumber}
                      onCheckedChange={(v) =>
                        updateCardDisplay("showSerialNumber", !!v)
                      }
                    />
                    <span className="text-xs font-semibold text-foreground">
                      Serial Number
                    </span>
                  </label>
                )}

                {/* Product Name */}
                <label
                  htmlFor="card-show-product-name"
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <Checkbox
                    id="card-show-product-name"
                    checked={cardDisplay.showProductName}
                    onCheckedChange={(v) =>
                      updateCardDisplay("showProductName", !!v)
                    }
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Product Name
                  </span>
                </label>

                {/* Full / Empty Badge */}
                <label
                  htmlFor="card-show-status-badge"
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <Checkbox
                    id="card-show-status-badge"
                    checked={cardDisplay.showStatusBadge}
                    onCheckedChange={(v) =>
                      updateCardDisplay("showStatusBadge", !!v)
                    }
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Full/Empty Badge
                  </span>
                </label>
              </div>
            </DialogHeader>

            {/* Preview canvas */}
            <div
              ref={previewContainerRef}
              className="flex-1 overflow-auto p-8 bg-zinc-200/50 dark:bg-zinc-950/50 custom-scrollbar"
            >
              {/* OUTER CENTER LAYER */}
              <div className="w-full flex justify-center">
                {/* FIXED VISUAL CANVAS (critical part) */}
                <div className="relative">
                  {/* SCALE STAGE (isolated rendering surface) */}
                  <div
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "top center",
                    }}
                    className="inline-block"
                  >
                    {/* ACTUAL PRINT SURFACE */}
                    <div className="bg-white text-black shadow-lg">
                      <InventoryPrintView
                        ref={printRef}
                        productName={product.productName}
                        serials={selectedSerialsToPrint}
                        options={printViewOptions}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
