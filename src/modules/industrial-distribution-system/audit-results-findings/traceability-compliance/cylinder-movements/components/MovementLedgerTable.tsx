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
import { ChevronLeft, ChevronRight, Download, HelpCircle, Search, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle 
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface MovementLedgerTableProps {
    data: SerialMovement[];
    onViewTrace: (serialNumber: string) => void;
    productNameFilter: string;
}

const ITEMS_PER_PAGE = 15;

export function MovementLedgerTable({ data, onViewTrace, productNameFilter }: MovementLedgerTableProps) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [directionFilter, setDirectionFilter] = React.useState("all");
    const [sortBy, setSortBy] = React.useState<"movementAt" | "serialNumber" | "documentType" | "documentNo" | null>(null);
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
    const [currentPage, setCurrentPage] = React.useState(1);

    // Reset page when data changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [data]);

    // ─── Filter Logic ────────────────────────────────────────────────────────
    const filteredData = React.useMemo(() => {
        return data.filter((r) => {

            const matchesSearch = 
                r.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.documentType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.documentNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.branchName.toLowerCase().includes(searchQuery.toLowerCase());
            
            const isIN = r.inQty > 0 && r.outQty === 0;
            const isOUT = r.outQty > 0 && r.inQty === 0;
            
            let direction = "Review";
            if (isIN) direction = "IN";
            else if (isOUT) direction = "OUT";

            const matchesDirection = directionFilter === "all" || direction === directionFilter;

            return matchesSearch && matchesDirection;
        });
    }, [data, searchQuery, directionFilter]);

    // ─── Sort Logic ──────────────────────────────────────────────────────────
    const sortedData = React.useMemo(() => {
        if (!sortBy) return filteredData;
        
        return [...filteredData].sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];

            if (typeof valA === "string" && typeof valB === "string") {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortBy, sortOrder]);

    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = React.useMemo(() => {
        return sortedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedData, startIndex]);

    if (data.length === 0) {
        return (
            <Card className="border border-dashed border-border/80 flex flex-col items-center justify-center p-12 text-center bg-card/25 shadow-none">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground mb-3">
                    <HelpCircle className="w-5 h-5" />
                </div>
                <CardTitle className="text-sm font-bold text-foreground mb-1">No Ledger Entries</CardTitle>
                <CardDescription className="text-xs text-muted-foreground max-w-sm">
                    Select a cylinder product to browse raw transaction ledger entries.
                </CardDescription>
            </Card>
        );
    }

    const handleSort = (field: "movementAt" | "serialNumber" | "documentType" | "documentNo") => {
        if (sortBy === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortBy(field);
            setSortOrder("asc");
        }
        setCurrentPage(1);
    };

    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    // Client-side Excel Export of filtered results
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
            "Customer Code": r.customerCode || "—",
            "Customer Name": r.customerName || "—",
            "Supplier Name": r.supplierName || "—",
            "Handling Branch": r.branchName,
        }));

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Movement Ledger");
        XLSX.writeFile(wb, `Cylinder_Movement_Ledger_${productNameFilter.replace(/\s+/g, "_") || "All"}.xlsx`);
    };

    return (
        <Card className="border border-border/80 shadow-xs overflow-hidden bg-card">
            <CardHeader className="px-5 py-4 border-b flex flex-row items-center justify-between flex-wrap gap-3 bg-muted/5 space-y-0">
                <div className="space-y-1">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Movement Ledger</CardTitle>
                    <CardDescription className="text-xs">
                        Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, sortedData.length)} of {sortedData.length.toLocaleString()} entries.
                    </CardDescription>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExport} 
                    className="gap-2 text-xs font-bold border-input bg-background shadow-xs hover:bg-muted"
                >
                    <Download className="w-3.5 h-3.5" /> Export Ledger
                </Button>
            </CardHeader>

            {/* Filters Row */}
            <div className="px-5 py-4 border-b flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-muted/5">
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                    <div className="relative max-w-xs flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                        <Input
                            placeholder="Search serial, type, doc..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="pl-8 h-8 text-xs bg-background border-input"
                        />
                    </div>
                    <Select
                        value={directionFilter}
                        onValueChange={(val) => {
                            setDirectionFilter(val);
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-background border-input">
                            <SelectValue placeholder="All Directions" />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                            <SelectItem value="all">All Directions</SelectItem>
                            <SelectItem value="IN">Inward</SelectItem>
                            <SelectItem value="OUT">Outward</SelectItem>
                            <SelectItem value="Review">Needs Review</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/15 border-b">
                            <TableRow>
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
                                    onClick={() => handleSort("movementAt")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Date & Time <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
                                    onClick={() => handleSort("serialNumber")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Serial <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead className="font-bold text-xs tracking-wider uppercase">Product</TableHead>
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
                                    onClick={() => handleSort("documentType")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Transaction Type <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
                                    onClick={() => handleSort("documentNo")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Document No. <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead className="font-bold text-xs tracking-wider uppercase text-center">Movement</TableHead>
                                <TableHead className="font-bold text-xs tracking-wider uppercase">Custodian / Supplier</TableHead>
                                <TableHead className="font-bold text-xs tracking-wider uppercase">Branch</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-xs text-muted-foreground">
                                        No ledger log entries match your current filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((r, idx) => {
                                    const isIN = r.inQty > 0 && r.outQty === 0;
                                    const isOUT = r.outQty > 0 && r.inQty === 0;
                                    return (
                                        <TableRow 
                                            key={`${r.serialNumber}-${r.documentNo}-${idx}`}
                                            className="cursor-pointer hover:bg-muted/30 transition-colors"
                                            onClick={() => onViewTrace(r.serialNumber)}
                                        >
                                            <TableCell className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                                                {r.movementAt}
                                            </TableCell>
                                            <TableCell className="font-bold text-primary select-all font-mono tracking-wider">
                                                {r.serialNumber}
                                            </TableCell>
                                            <TableCell className="max-w-[150px] truncate font-semibold text-foreground/90" title={r.productName}>
                                                {r.productName}
                                            </TableCell>
                                            <TableCell className="font-bold text-foreground truncate max-w-[150px] text-xs">{r.documentType}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground select-all">{r.documentNo}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border-none",
                                                        isIN && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                                        isOUT && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                                                        (!isIN && !isOUT) && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                    )}
                                                >
                                                    {isIN && "INWARD"}
                                                    {isOUT && "OUTWARD"}
                                                    {!isIN && !isOUT && "REVIEW"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate">
                                                {r.customerName ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-foreground text-xs leading-tight">{r.customerName}</span>
                                                        <span className="text-[10px] text-muted-foreground font-mono">{r.customerCode}</span>
                                                    </div>
                                                ) : r.supplierName ? (
                                                    <span className="font-semibold text-amber-600 dark:text-amber-400 text-xs">{r.supplierName}</span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="truncate max-w-[150px] font-medium text-muted-foreground">{r.branchName}</TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-5 py-4 border-t flex items-center justify-between bg-muted/5">
                        <span className="text-xs text-muted-foreground font-semibold">
                            Page {currentPage} of {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={handlePrev}
                                className="h-8 px-2 font-bold text-xs bg-background"
                            >
                                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === totalPages}
                                onClick={handleNext}
                                className="h-8 px-2 font-bold text-xs bg-background"
                            >
                                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
