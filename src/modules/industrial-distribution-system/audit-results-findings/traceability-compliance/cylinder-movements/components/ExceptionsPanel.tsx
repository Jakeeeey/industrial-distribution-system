// src/modules/industrial-distribution-system/audit-results-findings/traceability-compliance/cylinder-movements/components/ExceptionsPanel.tsx
"use client";

import * as React from "react";
import { ExceptionDetail } from "../types";
import { Button } from "@/components/ui/button";
// Antigravity: Removed unused HelpCircle and cn imports to resolve lint warnings
import { 
    Clock, 
    RefreshCw, 
    Calendar, 
    AlertTriangle, 
    ArrowRight, 
    Check, 
    Search,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight 
} from "lucide-react";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ExceptionsPanelProps {
    exceptions: ExceptionDetail[];
    onViewTrace: (serialNumber: string) => void;
}

const ITEMS_PER_PAGE = 10;

export function ExceptionsPanel({ exceptions, onViewTrace }: ExceptionsPanelProps) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [typeFilter, setTypeFilter] = React.useState("all");
    const [sortBy, setSortBy] = React.useState<"serialNumber" | "exceptionType" | "title" | null>(null);
    const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
    const [currentPage, setCurrentPage] = React.useState(1);

    // Reset pagination when filter change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [exceptions]);

    const getIcon = (type: string) => {
        switch (type) {
            case "refill_overdue":
                return <Clock className="w-4 h-4 text-amber-600 shrink-0" />;
            case "unresolved_transfer":
                return <RefreshCw className="w-4 h-4 text-purple-600 shrink-0" />;
            case "stale_asset":
                return <Calendar className="w-4 h-4 text-blue-600 shrink-0" />;
            case "conflicting_movement":
            default:
                return <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />;
        }
    };

    const getToneLabel = (type: string) => {
        switch (type) {
            case "refill_overdue":
                return "OVERDUE REFILL";
            case "unresolved_transfer":
                return "UNRESOLVED TRANSFER";
            case "stale_asset":
                return "STALE ASSET";
            case "conflicting_movement":
            default:
                return "CONFLICTING MOVE";
        }
    };

    // ─── Filter logic ────────────────────────────────────────────────────────
    const filteredExceptions = React.useMemo(() => {
        return exceptions.filter((e) => {
            const matchesSearch = 
                e.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.description.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesType = typeFilter === "all" || e.exceptionType === typeFilter;
            
            return matchesSearch && matchesType;
        });
    }, [exceptions, searchQuery, typeFilter]);

    // ─── Sort logic ──────────────────────────────────────────────────────────
    const sortedExceptions = React.useMemo(() => {
        if (!sortBy) return filteredExceptions;
        
        return [...filteredExceptions].sort((a, b) => {
            const valA = a[sortBy].toLowerCase();
            const valB = b[sortBy].toLowerCase();
            
            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });
    }, [filteredExceptions, sortBy, sortOrder]);

    // ─── Pagination logic ────────────────────────────────────────────────────
    const totalPages = Math.ceil(sortedExceptions.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedExceptions = React.useMemo(() => {
        return sortedExceptions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedExceptions, startIndex]);

    // Antigravity: Moved early return after all React hooks to satisfy react-hooks/rules-of-hooks
    if (exceptions.length === 0) {
        return (
            <Card className="border border-dashed border-border/80 flex flex-col items-center justify-center p-12 text-center bg-card/25 shadow-none">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 mb-3">
                    <Check className="w-5 h-5" />
                </div>
                <CardTitle className="text-sm font-bold text-foreground mb-1">No Exceptions Found</CardTitle>
                <CardDescription className="text-xs text-muted-foreground max-w-sm">
                    All cylinders under the selected product are currently traced correctly within standard parameters.
                </CardDescription>
            </Card>
        );
    }

    const handleSort = (field: "serialNumber" | "exceptionType" | "title") => {
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
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Cylinder Exceptions</CardTitle>
                    <CardDescription className="text-xs">
                        Review and resolve unusual, incomplete, or stalled serialized cylinder movements.
                    </CardDescription>
                </div>
                <Badge variant="destructive" className="font-extrabold text-xs px-2.5 py-0.5 rounded-full">
                    {filteredExceptions.length} match{filteredExceptions.length === 1 ? "" : "es"}
                </Badge>
            </CardHeader>

            {/* Filters Row */}
            <div className="px-5 py-4 border-b flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-muted/5">
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                    <div className="relative max-w-xs flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                        <Input
                            placeholder="Search serial, title..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="pl-8 h-8 text-xs bg-background border-input"
                        />
                    </div>
                    <Select
                        value={typeFilter}
                        onValueChange={(val) => {
                            setTypeFilter(val);
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-background border-input">
                            <SelectValue placeholder="All Exceptions" />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                            <SelectItem value="all">All Exceptions</SelectItem>
                            <SelectItem value="refill_overdue">Overdue Refill</SelectItem>
                            <SelectItem value="unresolved_transfer">Unresolved Transfer</SelectItem>
                            <SelectItem value="stale_asset">Stale Asset</SelectItem>
                            <SelectItem value="conflicting_movement">Conflicting Movement</SelectItem>
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
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
                                    onClick={() => handleSort("exceptionType")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Exception Type <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead 
                                    className="font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
                                    onClick={() => handleSort("title")}
                                >
                                    <div className="flex items-center gap-1.5">
                                        Issue <ArrowUpDown className="w-3.5 h-3.5" />
                                    </div>
                                </TableHead>
                                <TableHead className="font-bold text-xs tracking-wider uppercase">Description</TableHead>
                                <TableHead className="font-bold text-xs tracking-wider uppercase text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedExceptions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-xs text-muted-foreground">
                                        No exception logs match your current search criteria.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedExceptions.map((e) => (
                                    <TableRow 
                                        key={e.id} 
                                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                                        onClick={() => onViewTrace(e.serialNumber)}
                                    >
                                        <TableCell className="font-semibold text-foreground font-mono select-all">
                                            {e.serialNumber}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-bold text-[9px] px-2 py-0.5 uppercase tracking-wider border-muted-foreground/30 text-muted-foreground">
                                                {getToneLabel(e.exceptionType)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-bold text-foreground/90 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {getIcon(e.exceptionType)}
                                                {e.title}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={e.description}>
                                            {e.description}
                                        </TableCell>
                                        <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onViewTrace(e.serialNumber)}
                                                className="h-8 font-semibold text-xs border border-input hover:bg-muted bg-background shadow-xs"
                                            >
                                                Trace <ArrowRight className="w-3 h-3 ml-1.5" />
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
