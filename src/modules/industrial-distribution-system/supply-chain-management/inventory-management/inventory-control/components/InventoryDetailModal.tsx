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
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    Printer,
    Hash,
    Barcode as BarcodeIcon,
    ArrowLeft,
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
}

export function InventoryDetailModal({
    product,
    open,
    onClose,
    setViewMode,
    filteredSerials,
    printOptions,
    setPrintOptions,
}: InventoryDetailModalProps) {
    const [activeMode, setActiveMode] = useState<"choice" | "serial" | "barcode">("choice");
    const [prevProduct, setPrevProduct] = useState<ProductGroup | null>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1.0);

    // useEffect(() => {
    //     const container = previewContainerRef.current;
    //     if (!container) return;

    //     const handleWheel = (e: WheelEvent) => {
    //         // Check if Ctrl key is pressed (also handles trackpad pinch-to-zoom)
    //         if (e.ctrlKey) {
    //             e.preventDefault();
    //             const direction = e.deltaY < 0 ? 1 : -1;
    //             const zoomStep = 0.05;
    //             setZoom((prev) => {
    //                 const newZoom = Math.min(Math.max(prev + direction * zoomStep, 0.3), 2.0);
    //                 return Number(newZoom.toFixed(2));
    //             });
    //         }
    //     };

    //     container.addEventListener("wheel", handleWheel, { passive: false });
    //     return () => {
    //         container.removeEventListener("wheel", handleWheel);
    //     };
    // }, []);

    const printViewOptions = useMemo(() => ({
        mode: activeMode as "serial" | "barcode",
        paperSize: printOptions.paperSize,
        orientation: printOptions.orientation,
        columns: printOptions.columns,
    }), [activeMode, printOptions.paperSize, printOptions.orientation, printOptions.columns]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `${product?.productName ?? "Inventory"} - ${activeMode === "serial" ? "Serial Numbers" : "Barcodes"}`,
    });

    const onGeneratePrint = useCallback(() => {
        handlePrint();
    }, [handlePrint]);

    // Reset view selection to choice when product changes/dialog opens
    if (product !== prevProduct) {
        setPrevProduct(product);
        if (product) {
            setActiveMode("choice");
        }
    }

    if (!product) return null;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent
                showCloseButton={false}
                id="inventory-detail-modal"
                className={
                    activeMode === "choice"
                        ? "sm:max-w-md p-6 bg-background rounded-xl"
                        : "sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-zinc-100 dark:bg-zinc-950 rounded-xl"
                }
            >
                {activeMode === "choice" ? (
                    // ── Mode Choice Screen ──────────────────────────────────
                    <div className="flex flex-col items-center justify-center py-4 gap-6">
                        <DialogHeader className="text-center w-full">
                            <DialogTitle className="text-center text-xl font-bold tracking-tight">
                                LPG Inventory Printables
                            </DialogTitle>
                            {/* <p className="text-sm text-muted-foreground mt-1">
                                Select label or list format for <strong>{product.productName}</strong>
                            </p> */}
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
                                        Preview and print a formatted sheet of all cylinder serial numbers.
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
                            <Button variant="outline" onClick={onClose} className="w-full h-11">
                                Cancel
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
                                            {product.categoryName} · {activeMode === "serial" ? "Serial Number Report" : "Barcode Report"}
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

                                    <Button variant="outline" size="sm" onClick={onClose} className="h-8">
                                        Close
                                    </Button>
                                </div>
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
                                                serials={filteredSerials}
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
