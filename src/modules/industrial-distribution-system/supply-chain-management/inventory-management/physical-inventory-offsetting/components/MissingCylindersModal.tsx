// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/physical-inventory-offsetting/components/MissingCylindersModal.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertCircle,
    ArrowDownLeft,
    ArrowUpRight,
    Building2,
    Calendar,
    FileText,
    History,
    Loader2,
    PackageX,
    RefreshCw,
    Search,
    User,
} from "lucide-react";
import {
    fetchPhysicalInventoryDetailSerial,
    fetchPhysicalInventoryDetails,
    fetchProductLookupBundle,
    fetchSerialOnhandByBranch,
} from "@/modules/industrial-distribution-system/audit-results-findings/inventory-management/physical-inventory-serial-management/providers/fetchProvider";

/**
 * Serial Movement structure returned from Spring Boot / api/view-serial-movements/all
 */
export type SerialMovement = {
    movementAt: string;
    productId: number;
    productName: string;
    serialNumber: string;
    branchId: number;
    branchName: string;
    documentNo: string;
    documentType: string;
    inQty: number;
    outQty: number;
    customerCode: string | null;
    customerName: string | null;
    supplierName: string | null;
    uomIds: string | null;
};

/**
 * Normalized Last Movement details for a missing cylinder
 */
export type LastMovementInfo = {
    documentNo: string;
    documentType: string;
    movementAt: string;
    inQty: number;
    outQty: number;
    customerName: string | null;
    supplierName: string | null;
    branchName: string;
    direction: "IN" | "OUT" | "Assignment" | "Review";
};

/**
 * Structure representing a missing cylinder asset
 */
export type MissingCylinderItem = {
    serialNumber: string;
    productId: number;
    productName: string;
    productCode: string;
    lastMovement: LastMovementInfo | null;
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    phId: number | null;
    branchId: number | null;
    initialProductId?: number | null;
    initialProductLabel?: string | null;
    initialUom?: string | null;
    expectedShortage?: number | null;
};

/**
 * Formats ISO or raw movement date string to human-readable date/time
 */
function formatMovementDate(dateStr: string): string {
    if (!dateStr) return "—";
    const cleaned = dateStr.replace(/·/g, "").replace(/\s+/g, " ").trim();
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

/**
 * Modal dialog component displaying missing cylinders (scanned < expected system count)
 * with their exact last movement history from v_serial_movements.
 */
export function MissingCylindersModal({
    open,
    onOpenChange,
    phId,
    branchId,
    initialProductId = null,
    initialProductLabel = null,
    initialUom = null,
    expectedShortage = null,
}: Props) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [missingItems, setMissingItems] = React.useState<MissingCylinderItem[]>([]);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedProductId, setSelectedProductId] = React.useState<number | null>(initialProductId);

    // Sync initial product filter if provided
    React.useEffect(() => {
        if (open) {
            setSelectedProductId(initialProductId ?? null);
            setSearchQuery("");
        }
    }, [open, initialProductId]);

    // Load missing cylinders & last serial movement history
    const loadMissingCylinders = React.useCallback(async () => {
        if (!open || !phId || !branchId) return;

        try {
            setIsLoading(true);

            // Comment: Concurrent fetch for on-hand serials, scanned PI serials, PI details, lookup bundle, and serial movements
            const [onhandSerials, scannedPiSerials, piDetails, lookupBundle, movementRes] = await Promise.all([
                fetchSerialOnhandByBranch(branchId),
                fetchPhysicalInventoryDetailSerial(phId),
                fetchPhysicalInventoryDetails(phId),
                fetchProductLookupBundle(),
                fetch("/api/ids/arf/traceability-compliance/cylinder-movements", { cache: "no-store" })
                    .then((res) => (res.ok ? res.json() : { ok: false, data: [] }))
                    .catch(() => ({ ok: false, data: [] })),
            ]);

            // Build map of product lookup for name & code
            const productMap = new Map<number, { name: string; code: string }>();
            if (lookupBundle && Array.isArray(lookupBundle.products)) {
                for (const p of lookupBundle.products) {
                    productMap.set(p.product_id, {
                        name: p.product_name || `Product #${p.product_id}`,
                        code: p.product_code || "",
                    });
                }
            }

            // Build set of scanned serial numbers for this PI document (normalized uppercase)
            const scannedSerialSet = new Set<string>();
            for (const row of scannedPiSerials) {
                if (row.serial_number) {
                    scannedSerialSet.add(row.serial_number.trim().toUpperCase());
                }
            }

            // Build set of product IDs loaded in THIS Physical Inventory session (phId)
            const phProductIdsSet = new Set<number>();
            if (Array.isArray(piDetails)) {
                for (const d of piDetails) {
                    if (d.product_id) {
                        const pId = Number(d.product_id);
                        phProductIdsSet.add(pId);
                        // Also include parent/variant IDs for these products from lookup bundle
                        if (lookupBundle && Array.isArray(lookupBundle.products)) {
                            const prod = lookupBundle.products.find((p) => p.product_id === pId);
                            if (prod?.parent_id) phProductIdsSet.add(prod.parent_id);
                            for (const p of lookupBundle.products) {
                                if (p.parent_id === pId) phProductIdsSet.add(p.product_id);
                            }
                        }
                    }
                }
            }

            // Extract serial movements and group by serial number
            const rawMovements: SerialMovement[] = Array.isArray(movementRes.data) ? movementRes.data : [];
            const movementsBySerial = new Map<string, SerialMovement[]>();

            for (const m of rawMovements) {
                if (!m.serialNumber) continue;
                const sKey = m.serialNumber.trim().toUpperCase();
                if (!movementsBySerial.has(sKey)) {
                    movementsBySerial.set(sKey, []);
                }
                movementsBySerial.get(sKey)!.push(m);
            }

            // Identify missing serials: present in on-hand serials for branch, but NOT scanned in this PI
            // CRITICAL: Only include serials for products that are part of THIS Physical Inventory session!
            const missingList: MissingCylinderItem[] = [];

            for (const item of onhandSerials) {
                if (!phProductIdsSet.has(item.productId)) {
                    continue;
                }

                const cleanSerial = item.serial.trim().toUpperCase();
                if (!cleanSerial) continue;

                // If not scanned, it is missing!
                if (!scannedSerialSet.has(cleanSerial)) {
                    const prodInfo = productMap.get(item.productId) || {
                        name: `Product #${item.productId}`,
                        code: "",
                    };

                    // Compute last movement for this serial
                    let lastMovement: LastMovementInfo | null = null;
                    const movements = movementsBySerial.get(cleanSerial);

                    if (movements && movements.length > 0) {
                        // Sort by date descending to find latest transaction
                        const sorted = [...movements].sort((a, b) => {
                            const dA = new Date(a.movementAt.replace(/·/g, "").trim()).getTime() || 0;
                            const dB = new Date(b.movementAt.replace(/·/g, "").trim()).getTime() || 0;
                            if (dA !== dB) return dB - dA;
                            return b.inQty - a.inQty;
                        });

                        const latest = sorted[0];
                        let direction: "IN" | "OUT" | "Assignment" | "Review" = "Review";
                        if (latest.inQty > 0 && latest.outQty === 0) direction = "IN";
                        else if (latest.outQty > 0 && latest.inQty === 0) direction = "OUT";
                        else if (latest.inQty === 0 && latest.outQty === 0) direction = "Assignment";

                        lastMovement = {
                            documentNo: latest.documentNo || "—",
                            documentType: latest.documentType || "—",
                            movementAt: latest.movementAt || "",
                            inQty: latest.inQty,
                            outQty: latest.outQty,
                            customerName: latest.customerName || null,
                            supplierName: latest.supplierName || null,
                            branchName: latest.branchName || "",
                            direction,
                        };
                    }

                    missingList.push({
                        serialNumber: item.serial,
                        productId: item.productId,
                        productName: prodInfo.name,
                        productCode: prodInfo.code,
                        lastMovement,
                    });
                }
            }

            setMissingItems(missingList);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to load missing cylinder movements.";
            console.error("[MissingCylindersModal] Load error:", err);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }, [open, phId, branchId]);

    React.useEffect(() => {
        void loadMissingCylinders();
    }, [loadMissingCylinders]);

    // Unique products in missing list for filter dropdown with missing counts
    const productOptions = React.useMemo(() => {
        const map = new Map<number, { name: string; count: number }>();
        for (const item of missingItems) {
            const existing = map.get(item.productId);
            if (existing) {
                existing.count += 1;
            } else {
                map.set(item.productId, { name: item.productName, count: 1 });
            }
        }
        return Array.from(map.entries()).map(([id, info]) => ({
            id,
            name: info.name,
            count: info.count,
        }));
    }, [missingItems]);

    // Scoped missing items for the selected product (or all missing items if none selected)
    const scopedMissingItems = React.useMemo(() => {
        if (selectedProductId !== null) {
            return missingItems.filter((item) => item.productId === selectedProductId);
        }
        return missingItems;
    }, [missingItems, selectedProductId]);

    // Filter scoped missing cylinders by text search query
    const filteredMissingItems = React.useMemo(() => {
        if (!searchQuery.trim()) return scopedMissingItems;
        const q = searchQuery.trim().toLowerCase();

        return scopedMissingItems.filter((item) => {
            const serialMatch = item.serialNumber.toLowerCase().includes(q);
            const nameMatch = item.productName.toLowerCase().includes(q);
            const codeMatch = item.productCode.toLowerCase().includes(q);
            const docMatch = item.lastMovement?.documentNo.toLowerCase().includes(q) ?? false;
            const docTypeMatch = item.lastMovement?.documentType.toLowerCase().includes(q) ?? false;
            const customerMatch = item.lastMovement?.customerName?.toLowerCase().includes(q) ?? false;

            return serialMatch || nameMatch || codeMatch || docMatch || docTypeMatch || customerMatch;
        });
    }, [scopedMissingItems, searchQuery]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Comment: Wide modal container (w-[95vw] lg:max-w-[1300px] xl:max-w-[1450px]) to give full breathing room for serial movements columns */}
            <DialogContent className="w-[95vw] sm:max-w-[94vw] md:max-w-[92vw] lg:max-w-[1300px] xl:max-w-[1450px] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
                {/* Header */}
                <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/20">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
                                <PackageX className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold flex flex-wrap items-center gap-2">
                                    Missing Cylinders (Shortage)
                                    {initialProductLabel && (
                                        <Badge variant="outline" className="text-xs font-normal border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                            {initialProductLabel} {initialUom ? `(${initialUom})` : ""}
                                        </Badge>
                                    )}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Cylinders expected on-hand in system count but not scanned during Physical Inventory.
                                </DialogDescription>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void loadMissingCylinders()}
                            disabled={isLoading}
                            className="h-8 gap-1.5 text-xs cursor-pointer"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>

                    {/* Quick KPI stats (scoped per product with expected shortage breakdown) */}
                    <div className="grid grid-cols-3 gap-3 mt-4">
                        <Card className="rounded-xl border bg-background/60 shadow-none py-2 px-3">
                            <CardContent className="p-0 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        Expected Shortage
                                    </p>
                                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                                        {expectedShortage !== null ? expectedShortage : scopedMissingItems.length}{" "}
                                        <span className="text-xs font-normal text-muted-foreground">cylinders</span>
                                    </p>
                                </div>
                                <AlertCircle className="h-5 w-5 text-red-500/40" />
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl border bg-background/60 shadow-none py-2 px-3">
                            <CardContent className="p-0 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        Unscanned Branch Serials
                                    </p>
                                    <p className="text-lg font-bold text-foreground">
                                        {scopedMissingItems.length}{" "}
                                        <span className="text-xs font-normal text-muted-foreground">on-hand</span>
                                    </p>
                                </div>
                                <History className="h-5 w-5 text-muted-foreground/40" />
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl border bg-background/60 shadow-none py-2 px-3">
                            <CardContent className="p-0 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        Product Scope
                                    </p>
                                    <p className="text-sm font-semibold truncate max-w-[180px]">
                                        {selectedProductId
                                            ? (productOptions.find(p => p.id === selectedProductId)?.name || initialProductLabel || "Selected Product")
                                            : "All Products"}
                                        {initialUom ? ` (${initialUom})` : ""}
                                    </p>
                                </div>
                                <Building2 className="h-5 w-5 text-muted-foreground/40" />
                            </CardContent>
                        </Card>
                    </div>
                </DialogHeader>

                {/* Filter Toolbar */}
                <div className="px-6 py-3 border-b bg-muted/10 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search serial no, product, doc no, customer..."
                            className="pl-9 h-9 text-xs"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Product filter dropdown */}
                    {productOptions.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Product:</span>
                            <select
                                className="h-9 text-xs rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                                value={selectedProductId ?? ""}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedProductId(val ? Number(val) : null);
                                }}
                            >
                                <option value="">All Products ({missingItems.length})</option>
                                {productOptions.map((prod) => (
                                    <option key={prod.id} value={prod.id}>
                                        {prod.name} ({prod.count} missing)
                                    </option>
                                ))}
                            </select>
                            {selectedProductId !== null && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs px-2"
                                    onClick={() => setSelectedProductId(null)}
                                >
                                    Clear
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Content Table */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs font-medium">Tracing missing cylinders & serial movement history...</p>
                        </div>
                    ) : filteredMissingItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                                <PackageX className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">No missing cylinders found</h3>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                                {searchQuery || selectedProductId !== null
                                    ? "No missing serials match your search filter criteria."
                                    : "All expected on-hand cylinders have been scanned in this physical inventory!"}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border">
                            <Table className="w-full min-w-[960px]">
                                <TableHeader className="bg-muted/40">
                                    <TableRow className="h-9 hover:bg-transparent">
                                        <TableHead className="text-xs font-bold w-[160px]">Serial Number</TableHead>
                                        <TableHead className="text-xs font-bold w-[240px]">Product</TableHead>
                                        <TableHead className="text-xs font-bold w-[240px]">Last Doc No / Type</TableHead>
                                        <TableHead className="text-xs font-bold w-[200px]">Last Movement Date</TableHead>
                                        <TableHead className="text-xs font-bold min-w-[220px]">Last Customer / Location</TableHead>
                                        <TableHead className="text-xs font-bold w-[140px] text-center">Movement Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredMissingItems.map((item, idx) => {
                                        const last = item.lastMovement;
                                        return (
                                            <TableRow key={`${item.serialNumber}-${idx}`} className="h-12 hover:bg-muted/30">
                                                {/* Serial Number */}
                                                <TableCell className="py-2 font-mono text-xs font-bold text-red-700 dark:text-red-300">
                                                    <Badge variant="outline" className="font-mono text-xs border-red-300 bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300">
                                                        {item.serialNumber}
                                                    </Badge>
                                                </TableCell>

                                                {/* Product Name */}
                                                <TableCell className="py-2">
                                                    <p className="text-xs font-medium leading-snug text-foreground">
                                                        {item.productName}
                                                    </p>
                                                    {item.productCode && (
                                                        <p className="text-[10px] text-muted-foreground font-mono">
                                                            {item.productCode}
                                                        </p>
                                                    )}
                                                </TableCell>

                                                {/* Last Doc No / Type */}
                                                <TableCell className="py-2">
                                                    {last ? (
                                                        <div>
                                                            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                                                {last.documentNo}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {last.documentType}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">No movement recorded</span>
                                                    )}
                                                </TableCell>

                                                {/* Last Movement Date */}
                                                <TableCell className="py-2 text-xs text-muted-foreground">
                                                    {last?.movementAt ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                                                            <span>{formatMovementDate(last.movementAt)}</span>
                                                        </div>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </TableCell>

                                                {/* Customer / Location */}
                                                <TableCell className="py-2 text-xs">
                                                    {last ? (
                                                        last.customerName ? (
                                                            <div className="flex items-center gap-1.5 text-foreground">
                                                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                                <span className="font-medium max-w-[160px] truncate">{last.customerName}</span>
                                                            </div>
                                                        ) : last.supplierName ? (
                                                            <div className="flex items-center gap-1.5 text-foreground">
                                                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                                <span className="font-medium max-w-[160px] truncate">{last.supplierName}</span>
                                                            </div>
                                                        ) : last.branchName ? (
                                                            <span className="text-muted-foreground">{last.branchName}</span>
                                                        ) : (
                                                            "Branch On-Hand"
                                                        )
                                                    ) : (
                                                        "—"
                                                    )}
                                                </TableCell>

                                                {/* Movement Direction Status */}
                                                <TableCell className="py-2 text-center">
                                                    {last ? (
                                                        last.direction === "IN" ? (
                                                            <Badge variant="outline" className="text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1">
                                                                <ArrowDownLeft className="h-3 w-3" />
                                                                IN
                                                            </Badge>
                                                        ) : last.direction === "OUT" ? (
                                                            <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 gap-1">
                                                                <ArrowUpRight className="h-3 w-3" />
                                                                OUT
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                                                {last.direction}
                                                            </Badge>
                                                        )
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                            Initial
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
