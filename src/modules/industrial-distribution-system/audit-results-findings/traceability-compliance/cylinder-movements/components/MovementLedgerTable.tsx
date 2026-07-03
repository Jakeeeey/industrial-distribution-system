// src/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/components/MovementLedgerTable.tsx
"use client";

import * as React from "react";
import { SerialMovement } from "../types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { getLedgerSortOrder } from "../service";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

interface MovementLedgerTableProps {
    data: SerialMovement[];
    onViewTrace: (serialNumber: string) => void;
    productNameFilter: string;
}

const ITEMS_PER_PAGE = 15;

export function MovementLedgerTable({ data, onViewTrace, productNameFilter }: MovementLedgerTableProps) {
    const [currentPage, setCurrentPage] = React.useState(1);

    // Reset page when data changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [data]);

    // Apply the specified sort order: movementAt DESC, then serialNumber ASC
    const sortedData = React.useMemo(() => {
        return getLedgerSortOrder(data);
    }, [data]);

    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = React.useMemo(() => {
        return sortedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedData, startIndex]);

    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    // Client-side Excel Export
    const handleExport = () => {
        if (sortedData.length === 0) return;
        
        const exportRows = sortedData.map((r) => ({
            "Date & Time": r.movementAt,
            "Serial Number": r.serialNumber,
            "Product": r.productName,
            "Transaction Type": r.documentType,
            "Document No.": r.documentNo,
            "Movement Direction": r.inQty > 0 ? "IN" : (r.outQty > 0 ? "OUT" : "Review"),
            "In Qty": r.inQty,
            "Out Qty": r.outQty,
            "Handling Branch": r.branchName,
        }));

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Movement Ledger");
        XLSX.writeFile(wb, `Cylinder_Movement_Ledger_${productNameFilter.replace(/\s+/g, "_") || "All"}.xlsx`);
    };

    if (sortedData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-xl bg-card">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground text-xl mb-3">
                    ▤
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">No Ledger Entries</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Select a cylinder product to browse raw transaction ledger entries.
                </p>
            </div>
        );
    }

    return (
        <div className="border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3 bg-card">
                <div>
                    <h3 className="text-sm font-semibold text-card-foreground">Movement Ledger</h3>
                    <p className="text-xs text-muted-foreground">
                        Raw transaction logs sorted by newest activity first. Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, sortedData.length)} of {sortedData.length.toLocaleString()} entries.
                    </p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExport} 
                    className="gap-2 text-xs font-semibold text-muted-foreground border-input"
                >
                    <Download className="w-3.5 h-3.5" /> Export Ledger
                </Button>
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Date & Time</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Serial</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Product</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Transaction Type</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Document No.</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase text-center">Movement</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Branch</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.map((r, idx) => {
                            const isIN = r.inQty > 0 && r.outQty === 0;
                            const isOUT = r.outQty > 0 && r.inQty === 0;
                            return (
                                <TableRow 
                                    key={`${r.serialNumber}-${r.documentNo}-${idx}`}
                                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                                    onClick={() => onViewTrace(r.serialNumber)}
                                >
                                    <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                        {r.movementAt}
                                    </TableCell>
                                    <TableCell className="font-semibold text-primary select-all">
                                        {r.serialNumber}
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate" title={r.productName}>
                                        {r.productName}
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground truncate max-w-[150px]">{r.documentType}</TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground select-all">{r.documentNo}</TableCell>
                                    <TableCell className="text-center">
                                        <span 
                                            className={cn(
                                                "inline-flex items-center text-xs font-bold font-mono",
                                                isIN && "text-emerald-600 dark:text-emerald-400",
                                                isOUT && "text-rose-600 dark:text-rose-400",
                                                (!isIN && !isOUT) && "text-amber-600 dark:text-amber-400"
                                            )}
                                        >
                                            {isIN && "↙ IN"}
                                            {isOUT && "↗ OUT"}
                                            {(!isIN && !isOUT) && "⚠ Review"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="truncate max-w-[150px]">{r.branchName}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="px-5 py-4 border-t flex items-center justify-between bg-muted/10">
                    <span className="text-xs text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={handlePrev}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={handleNext}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
