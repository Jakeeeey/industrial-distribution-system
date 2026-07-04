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
import { ArrowRight, ChevronLeft, ChevronRight, HelpCircle, Search, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface CylinderListTableProps {
    data: CylinderSummary[];
    onViewTrace: (serialNumber: string) => void;
}

const ITEMS_PER_PAGE = 10;

export function CylinderListTable({ data, onViewTrace }: CylinderListTableProps) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [directionFilter, setDirectionFilter] = React.useState("all");
    const [sortBy, setSortBy] = React.useState<"serialNumber" | "lastHandlingBranch" | "direction" | "lastMovementDate" | "movementCount" | null>(null);
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
    const [currentPage, setCurrentPage] = React.useState(1);

    // Reset pagination when data changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [data]);

    // ─── Filter Logic ────────────────────────────────────────────────────────
    const filteredData = React.useMemo(() => {
        return data.filter((c) => {
            const matchesSearch = 
                c.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.lastHandlingBranch.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.lastMovementType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.lastDocumentNo.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesDirection = directionFilter === "all" || c.direction === directionFilter;
            
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

    // ─── Pagination Logic ────────────────────────────────────────────────────
    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = React.useMemo(() => {
        return sortedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedData, startIndex]);

    // Antigravity: Moved early return after all React hooks to satisfy react-hooks/rules-of-hooks
    if (data.length === 0) {
        return (
            <Card className="border border-dashed border-border/80 flex flex-col items-center justify-center p-12 text-center bg-card/25 shadow-none">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground mb-3">
                    <HelpCircle className="w-5 h-5" />
                </div>
                <CardTitle className="text-sm font-bold text-foreground mb-1">No Cylinders Found</CardTitle>
                <CardDescription className="text-xs text-muted-foreground max-w-sm">
                    Select a cylinder product or search for a specific serial number to display results.
                </CardDescription>
            </Card>
        );
    }

    const handleSort = (field: "serialNumber" | "lastHandlingBranch" | "direction" | "lastMovementDate" | "movementCount") => {
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

    return (
        <Card className="border border-border/80 shadow-xs overflow-hidden bg-card">
            <CardHeader className="px-5 py-4 border-b flex flex-row items-center justify-between space-y-0 bg-muted/5">
                <div className="space-y-1">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Serial Cylinders</CardTitle>
                    <CardDescription className="text-xs">
                        Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, sortedData.length)} of {sortedData.length.toLocaleString()} cylinders
                    </CardDescription>
                </div>
                <Badge variant="secondary" className="font-extrabold text-xs px-2.5 py-0.5 rounded-full">
                    {filteredData.length} match{filteredData.length === 1 ? "" : "es"}
                </Badge>
            </CardHeader>

            {/* Filters Row */}
            <div className="px-5 py-4 border-b flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-muted/5">
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                    <div className="relative max-w-xs flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                        <Input
                            placeholder="Search serial, branch, doc..."
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
                            <SelectItem value="IN">In Branch</SelectItem>
                            <SelectItem value="OUT">Outside Branch</SelectItem>
                            <SelectItem value="Review">Needs Review</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/10 border-b">
                            <TableRow>
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
                                    onClick={() => handleSort("serialNumber")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Serial Number <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead className="font-bold text-xs tracking-wider uppercase">Product</TableHead>
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
                                    onClick={() => handleSort("lastHandlingBranch")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Last Handling Branch <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase text-center cursor-pointer select-none"
                                    onClick={() => handleSort("direction")}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        Direction <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead className="font-bold text-xs tracking-wider uppercase">Last Movement</TableHead>
                                <TableHead className="font-bold text-xs tracking-wider uppercase">Document No.</TableHead>
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
                                    onClick={() => handleSort("lastMovementDate")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Last Movement Date <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase text-center cursor-pointer select-none"
                                    onClick={() => handleSort("movementCount")}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        Movements <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead className="font-bold text-xs tracking-wider uppercase text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-10 text-xs text-muted-foreground">
                                        No cylinder listings match your current filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((c) => (
                                    <TableRow 
                                        key={c.serialNumber} 
                                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                                        onClick={() => onViewTrace(c.serialNumber)}
                                    >
                                        <TableCell className="font-semibold text-foreground font-mono select-all">
                                            {c.serialNumber}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={c.productName}>
                                            {c.productName}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{c.lastHandlingBranch}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border-none",
                                                    c.direction === "IN" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                                    c.direction === "OUT" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                                                    c.direction === "Review" && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                )}
                                            >
                                                {c.direction === "IN" && "IN"}
                                                {c.direction === "OUT" && "OUT"}
                                                {c.direction === "Review" && "REVIEW"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="truncate max-w-[150px] font-medium text-xs text-foreground">{c.lastMovementType}</TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">{c.lastDocumentNo}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                            {c.lastMovementDate}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="inline-flex items-center justify-center font-bold px-2 py-0.5 rounded min-w-[24px]">
                                                {c.movementCount}
                                            </Badge>
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
                                ))
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
