// src/modules/.../purchase-order-creation-serial/components/RefillPOList.tsx
// Purpose: PO selection list for the Cylinder Refill Serial Tagging module.
// Side-by-side Master panel layout.
// Note: Draft counts are already injected into po.totalSerials by the hook (poListWithDrafts),
// so no direct store subscription is needed here.

"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SerialTaggingPOListItem } from "../types/serial-po.types";

import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

// ─── Props ────────────────────────────────────────────────────────────────────

interface RefillPOListProps {
    items: SerialTaggingPOListItem[];
    loading: boolean;
    selectedId?: number;
    onSelectPO: (poId: number) => void;
    onRefresh: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const APPROVED_STATUS = 13;
const DEFAULT_PAGE_SIZE = 10;

type FilterStatus = "all" | "ready" | "for_approval" | "tagged";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCardType(item: SerialTaggingPOListItem): "ready" | "tagged" | "pending" {
    if (item.inventoryStatus === APPROVED_STATUS && !item.isTagged) return "ready";
    if (item.isTagged) return "tagged";
    return "pending";
}

function getPaginationModel(totalPages: number, currentPage: number) {
    if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, i) => i + 1) as Array<
            number | "ellipsis"
        >;
    }

    const items: Array<number | "ellipsis"> = [];
    items.push(1);

    const left = Math.max(2, currentPage);
    const right = Math.min(totalPages - 1, currentPage);

    if (left > 2) items.push("ellipsis");

    for (let p = left; p <= right; p++) items.push(p);

    if (right < totalPages - 1) items.push("ellipsis");

    items.push(totalPages);
    return items;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RefillPOList({ items, loading, selectedId, onSelectPO, onRefresh }: RefillPOListProps) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all");
    const [page, setPage] = React.useState(1);
    const pageSize = DEFAULT_PAGE_SIZE;

    // ── Filter ────────────────────────────────────────────────────────────────
    const filteredItems = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return (items ?? []).filter((po) => {
            const textOk =
                !q ||
                po.poNumber.toLowerCase().includes(q) ||
                po.supplierName.toLowerCase().includes(q);

            const type = getCardType(po);
            const statusOk =
                filterStatus === "all" ||
                (filterStatus === "ready" && type === "ready") ||
                (filterStatus === "tagged" && type === "tagged") ||
                (filterStatus === "for_approval" && type === "pending");

            return textOk && statusOk;
        });
    }, [items, searchQuery, filterStatus]);

    const totalPages = React.useMemo(
        () => Math.max(1, Math.ceil(filteredItems.length / pageSize)),
        [filteredItems.length, pageSize]
    );

    React.useEffect(() => {
        setPage((p) => Math.min(Math.max(1, p), totalPages));
    }, [totalPages, filteredItems.length]);

    const paginated = React.useMemo(() => {
        const start = (page - 1) * pageSize;
        return (filteredItems ?? []).slice(start, start + pageSize);
    }, [filteredItems, page, pageSize]);

    const paginationModel = React.useMemo(
        () => getPaginationModel(totalPages, page),
        [totalPages, page]
    );

    const counts = React.useMemo(() => ({
        all: items.length,
        ready: items.filter((i) => getCardType(i) === "ready").length,
        tagged: items.filter((i) => getCardType(i) === "tagged").length,
        for_approval: items.filter((i) => getCardType(i) === "pending").length,
    }), [items]);

    const isDisabled = loading;

    return (
        <div className="min-w-0 border border-border rounded-xl bg-background shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-sm font-black text-foreground uppercase tracking-tight">
                        Select Refill PO
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                        {filteredItems.length} filtered / {items?.length ?? 0} total
                    </div>
                </div>

                <Badge variant="outline" className="text-[10px] font-black uppercase cursor-pointer hover:bg-muted" onClick={onRefresh}>
                    Refresh
                </Badge>
            </div>

            <div className="p-3 pb-0 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search PO#, Supplier..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 rounded-xl shadow-sm border-border bg-background"
                    />
                </div>
                
                {/* Status Chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {(["all", "ready", "for_approval", "tagged"] as FilterStatus[]).map((f) => {
                        const labels: Record<FilterStatus, string> = {
                            all: "All",
                            ready: "Ready",
                            for_approval: "Pending",
                            tagged: "Tagged",
                        };
                        return (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFilterStatus(f)}
                                className={cn(
                                    "text-[9px] whitespace-nowrap font-black px-2.5 py-1 rounded-full border transition-colors",
                                    filterStatus === f
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                                )}
                            >
                                {labels[f]} ({counts[f]})
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={cn("flex-1 p-3 space-y-2 overflow-y-auto", isDisabled ? "opacity-70 pointer-events-none" : "")}>
                {loading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">Loading list...</div>
                ) : paginated.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        No purchase orders found.
                    </div>
                ) : (
                    paginated.map((po) => {
                        const selected = selectedId === po.poId;
                        const cardType = getCardType(po);
                        // totalSerials already includes draft counts (injected by hook via poListWithDrafts)
                        const displaySerials = po.isTagged ? Math.max(po.totalSerials, po.totalOrderedQty) : po.totalSerials;
                        const progress = po.totalOrderedQty > 0 ? Math.round((displaySerials / po.totalOrderedQty) * 100) : 0;
                        const isCardDisabled = cardType !== "ready" && cardType !== "tagged";

                        return (
                            <button
                                key={po.poId}
                                type="button"
                                // Disable button if status is "pending" (for approval) to prevent selecting it
                                disabled={isCardDisabled}
                                onClick={() => {
                                    if (!isCardDisabled) {
                                        onSelectPO(po.poId);
                                    }
                                }}
                                className={cn(
                                    "w-full text-left rounded-lg border border-border bg-background p-3 transition focus:outline-none",
                                    !isCardDisabled && "hover:bg-muted/40 cursor-pointer",
                                    isCardDisabled && "opacity-70 cursor-not-allowed",
                                    selected ? "ring-2 ring-primary/40 border-primary/50" : ""
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                        <div className="text-xs font-black text-foreground truncate flex items-center gap-2">
                                            {po.poNumber}
                                            {cardType === "tagged" && (
                                                <Badge className="text-[8px] h-3 px-1 font-black bg-emerald-500/15 text-emerald-700 border border-emerald-500/20">
                                                    TAGGED
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground truncate">{po.supplierName}</div>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                                            <CalendarDays className="h-3 w-3" />
                                            {po.date}
                                        </div>
                                        <div className="flex items-center gap-2 pt-1">
                                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full", cardType === "tagged" ? "bg-emerald-500" : "bg-primary")}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className="text-[9px] text-muted-foreground font-medium">
                                                {displaySerials}/{po.totalOrderedQty}
                                            </span>
                                        </div>
                                    </div>

                                    {cardType === "pending" && (
                                        <Badge variant="secondary" className="text-[9px] font-black bg-amber-500/15 text-amber-700 shrink-0">
                                            FOR APPROVAL
                                        </Badge>
                                    )}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* ── Pagination ── */}
            {items.length > 0 && !loading && (
                <div className="px-4 py-3 border-t border-border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] font-black uppercase text-muted-foreground whitespace-nowrap">
                            Showing {Math.min(filteredItems.length, (page - 1) * pageSize + 1)}–{Math.min(page * pageSize, filteredItems.length)} of {filteredItems.length}
                        </div>

                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                            Page {page} of {totalPages}
                        </div>
                    </div>

                    {totalPages > 1 && (
                        <div className="pt-1 border-t border-border/40">
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious
                                            href="#"
                                            aria-disabled={isDisabled || page === 1}
                                            className={cn(isDisabled || page === 1 ? "pointer-events-none opacity-50" : "h-8 px-2")}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (page === 1 || isDisabled) return;
                                                setPage(p => p - 1);
                                            }}
                                        />
                                    </PaginationItem>

                                    {paginationModel.map((it, idx) => {
                                        if (it === "ellipsis") {
                                            return (
                                                <PaginationItem key={`el-${idx}`}>
                                                    <PaginationEllipsis />
                                                </PaginationItem>
                                            );
                                        }

                                        return (
                                            <PaginationItem key={it}>
                                                <PaginationLink
                                                    href="#"
                                                    isActive={it === page}
                                                    aria-disabled={isDisabled}
                                                    className={cn("h-8 w-8", isDisabled ? "pointer-events-none opacity-60" : "")}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (isDisabled) return;
                                                        setPage(it);
                                                    }}
                                                >
                                                    {it}
                                                </PaginationLink>
                                            </PaginationItem>
                                        );
                                    })}

                                    <PaginationItem>
                                        <PaginationNext
                                            href="#"
                                            aria-disabled={isDisabled || page >= totalPages}
                                            className={cn(isDisabled || page >= totalPages ? "pointer-events-none opacity-50" : "h-8 px-2")}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (page >= totalPages || isDisabled) return;
                                                setPage(p => p + 1);
                                            }}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
