// src/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/components/CylinderListTable.tsx
"use client";

import * as React from "react";
import { CylinderSummary } from "../types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CylinderListTableProps {
    data: CylinderSummary[];
    onViewTrace: (serialNumber: string) => void;
}

const ITEMS_PER_PAGE = 10;

export function CylinderListTable({ data, onViewTrace }: CylinderListTableProps) {
    const [currentPage, setCurrentPage] = React.useState(1);

    // Reset pagination when data changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [data]);

    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = React.useMemo(() => {
        return data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [data, startIndex]);

    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-xl bg-card">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground text-xl mb-3">
                    ◌
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">No Cylinders Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Select a cylinder product or search for a specific serial number to display results.
                </p>
            </div>
        );
    }

    return (
        <div className="border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-card-foreground">Serial Cylinders</h3>
                    <p className="text-xs text-muted-foreground">
                        Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, data.length)} of {data.length.toLocaleString()} cylinders
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Serial Number</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Product</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Last Handling Branch</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase text-center">Direction</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Last Movement</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Document No.</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase">Last Movement Date</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase text-center">Movements</TableHead>
                            <TableHead className="font-bold text-xs tracking-wider uppercase text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.map((c) => (
                            <TableRow 
                                key={c.serialNumber} 
                                className="cursor-pointer hover:bg-muted/40 transition-colors"
                                onClick={() => onViewTrace(c.serialNumber)}
                            >
                                <TableCell className="font-semibold text-primary select-all">
                                    {c.serialNumber}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={c.productName}>
                                    {c.productName}
                                </TableCell>
                                <TableCell>{c.lastHandlingBranch}</TableCell>
                                <TableCell className="text-center">
                                    <span
                                        className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold",
                                            c.direction === "IN" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                            c.direction === "OUT" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                                            c.direction === "Review" && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                        )}
                                    >
                                        {c.direction === "IN" && "↙ IN"}
                                        {c.direction === "OUT" && "↗ OUT"}
                                        {c.direction === "Review" && "⚠ Review"}
                                    </span>
                                </TableCell>
                                <TableCell className="truncate max-w-[150px]">{c.lastMovementType}</TableCell>
                                <TableCell className="font-mono text-xs">{c.lastDocumentNo}</TableCell>
                                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                    {c.lastMovementDate}
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className="inline-flex items-center justify-center bg-muted text-muted-foreground text-xs font-semibold px-2 py-0.5 rounded-md min-w-[24px]">
                                        {c.movementCount}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        variant="link"
                                        className="text-primary hover:text-primary-dark font-bold p-0 h-auto gap-1 text-xs"
                                        onClick={() => onViewTrace(c.serialNumber)}
                                    >
                                        View Trace <ArrowRight className="w-3.5 h-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
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
