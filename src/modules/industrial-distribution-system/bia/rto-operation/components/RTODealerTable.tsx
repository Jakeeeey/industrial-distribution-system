// components/RTODealerTable.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Main data table for the BIA RTO Operation module.
//
// Features:
//   - Sortable columns (dealer name, missing tanks, balance, status)
//   - Color-coded risk badges (normal / warning / critical)
//   - Row click → opens detail modal
//   - Skeleton rows while loading
//   - Client-side pagination (10 / 25 / 50 rows)
//   - Agent list inline per dealer row
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRTOOperation } from "../hooks/useRTOOperation";
import type { RTODealerRecord, MissingStatus } from "../types";
import {
  formatCurrency,
  resolveMissingStatusBadgeClass,
  formatMissingStatus,
} from "../utils/rto-operation.utils";
import { RTOFilterBar } from "./RTOFilterBar";

// ── Sort ──────────────────────────────────────────────────────────────────────

type SortKey =
  | "customerCode"
  | "customerName"
  | "branchName"
  | "missingTanks"
  | "fullsDelivered"
  | "emptiesReturned" // Added for Returned Tanks sorting capability
  | "financialExposure"
  | "unpaidBalance"
  | "lastDeliveryDate";

type SortDir = "asc" | "desc";

function sortRecords(
  rows: RTODealerRecord[],
  key: SortKey,
  dir: SortDir
): RTODealerRecord[] {
  return [...rows].sort((a, b) => {
    const av = a[key] ?? "";
    const bv = b[key] ?? "";
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <TableRow className="border-b border-border/40">
      {Array.from({ length: 9 }).map((_, i) => (
        <TableCell key={i} className="py-3 px-3">
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ── Sort header ───────────────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (k: SortKey) => void;
}

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: SortHeaderProps) {
  const isActive = currentKey === sortKey;
  return (
    <button
      className="flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80 hover:text-foreground transition-colors whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ChevronUp className="h-3 w-3 text-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-foreground" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
      )}
    </button>
  );
}

// ── Missing status icon ───────────────────────────────────────────────────────

function MissingStatusIcon({ status }: { status: MissingStatus }) {
  switch (status) {
    case "critical":
      return <ShieldAlert className="h-3.5 w-3.5 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    case "normal":
    default:
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function RTODealerTable() {
  const {
    filteredRecords,
    isLoading,
    page,
    setPage,
    pageSize,
    setPageSize,
    selectDealer,
  } = useRTOOperation();

  // Sort state — default: missingTanks DESC
  const [sortKey, setSortKey] = React.useState<SortKey>("missingTanks");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  // Sort → Paginate pipeline
  const sorted = React.useMemo(
    () => sortRecords(filteredRecords, sortKey, sortDir),
    [filteredRecords, sortKey, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* ── Toolbar (Filter Bar) ─────────────────────────────────────────── */}
      <RTOFilterBar />

      {/* ── Desktop Table View ────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/10 border-b border-border/40">
            <TableRow className="hover:bg-transparent border-b border-border/40">
              <TableHead className="w-8 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 py-2 px-1">
                #
              </TableHead>
              <TableHead className="py-2 px-1.5">
                <SortHeader label="Dealer" sortKey="customerName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead className="hidden md:table-cell py-2 px-1.5">
                <SortHeader label="Branch" sortKey="branchName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              {/* Given Tanks (formerly Cyls. w/ Dealer, sorting maps to fullsDelivered) */}
              <TableHead className="text-center py-2 px-1.5">
                <SortHeader label="Given Tanks" sortKey="fullsDelivered" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              {/* Returned Tanks (sorting maps to emptiesReturned) */}
              <TableHead className="text-center py-2 px-1.5">
                <SortHeader label="Returned Tanks" sortKey="emptiesReturned" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead className="text-center py-2 px-1.5">
                <SortHeader label="Missing Tanks" sortKey="missingTanks" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead className="py-2 px-1.5">
                <span className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80 whitespace-nowrap">Risk</span>
              </TableHead>
              {/* Balance (moved to match the requested layout order) */}
              <TableHead className="hidden lg:table-cell py-2 px-1.5">
                <SortHeader label="Balance" sortKey="unpaidBalance" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              {/* Financial Exposure (renamed from Fin. Exposure, moved to the end) */}
              <TableHead className="hidden md:table-cell py-2 px-1.5">
                <SortHeader label="Financial Exposure" sortKey="financialExposure" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-20 text-center text-xs text-muted-foreground py-6"
                >
                  {filteredRecords.length === 0
                    ? "No dealer records loaded."
                    : "No dealers match your current filters."}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, idx) => {
                const rowNum = (page - 1) * pageSize + idx + 1;
                return (
                  <TableRow
                    key={row.customerCode}
                    className={`hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/40 group text-[11px] ${
                      row.riskFlag ? "bg-red-50/30 dark:bg-red-950/10" : ""
                    }`}
                    onClick={() => selectDealer(row.customerCode)}
                  >
                    {/* # */}
                    <TableCell className="py-2 px-1 text-center text-muted-foreground font-mono text-[10px]">
                      {rowNum}
                    </TableCell>

                    {/* Dealer */}
                    <TableCell className="py-2 px-1.5 max-w-[200px]">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="font-semibold text-foreground text-xs truncate group-hover:underline cursor-pointer">
                              {row.customerName || "—"}
                            </div>
                          </TooltipTrigger>
                          {row.customerName && (
                            <TooltipContent side="top">{row.customerName}</TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                      <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                        {row.customerCode}
                      </div>
                      {row.storeName && (
                        <div className="text-[9px] text-muted-foreground truncate mt-0.5">
                          {row.storeName}
                        </div>
                      )}
                    </TableCell>

                    {/* Branch */}
                    <TableCell className="hidden md:table-cell py-2 px-1.5 max-w-[130px]">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {row.branchName || "—"}
                      </div>
                      {row.branchCode && (
                        <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                          {row.branchCode}
                        </div>
                      )}
                    </TableCell>

                    {/* Given Tanks (formerly Cylinders with dealer, using fullsDelivered) */}
                    <TableCell className="py-2 px-1.5 text-center font-bold text-xs text-foreground">
                      {row.fullsDelivered}
                    </TableCell>

                    {/* Returned Tanks (using emptiesReturned) */}
                    <TableCell className="py-2 px-1.5 text-center font-bold text-xs text-foreground">
                      {row.emptiesReturned}
                    </TableCell>

                    {/* Missing tanks */}
                    <TableCell className="py-2 px-1.5 text-center">
                      <span
                        className={`font-black text-sm ${
                          row.missingStatus === "critical"
                            ? "text-red-600"
                            : row.missingStatus === "warning"
                            ? "text-amber-600"
                            : "text-foreground"
                        }`}
                      >
                        {row.missingTanks}
                      </span>
                    </TableCell>

                    {/* Risk badge */}
                    <TableCell className="py-2 px-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[9px] py-0 px-1.5 font-semibold gap-1 whitespace-nowrap ${resolveMissingStatusBadgeClass(row.missingStatus)}`}
                      >
                        <MissingStatusIcon status={row.missingStatus} />
                        {formatMissingStatus(row.missingStatus)}
                      </Badge>
                    </TableCell>

                    {/* Balance (moved to match the requested layout order) */}
                    <TableCell className="hidden lg:table-cell py-2 px-1.5 font-mono text-xs text-foreground whitespace-nowrap">
                      {formatCurrency(row.unpaidBalance)}
                    </TableCell>

                    {/* Financial exposure (renamed to match header, moved to the end) */}
                    <TableCell className="hidden md:table-cell py-2 px-1.5 font-mono text-xs text-foreground whitespace-nowrap">
                      {formatCurrency(row.financialExposure)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Mobile Responsive Cards View ─────────────────────────────────── */}
      <div className="block md:hidden p-3 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-border/50 bg-card rounded-xl p-4 space-y-2.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ))
        ) : paginated.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground bg-muted/5 rounded-xl border border-dashed border-border/55">
            {filteredRecords.length === 0
              ? "No dealer records loaded."
              : "No dealers match your current filters."}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.03 }
              }
            }}
            className="space-y-3"
          >
            {paginated.map((row) => (
              <motion.div
                key={row.customerCode}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 }
                }}
                whileTap={{ scale: 0.985 }}
                onClick={() => selectDealer(row.customerCode)}
                className={`bg-card border border-border/60 hover:border-primary/40 rounded-xl p-4 space-y-3 shadow-sm active:bg-muted/10 transition-all duration-300 cursor-pointer ${
                  row.riskFlag ? "border-red-200/60 bg-red-50/5 dark:bg-red-950/5" : ""
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground text-xs truncate">
                      {row.customerName || "—"}
                    </div>
                    <div className="text-[9px] text-muted-foreground font-mono mt-0.5">
                      {row.customerCode}
                    </div>
                    {row.storeName && (
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {row.storeName}
                      </div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[8px] py-0 px-1.5 font-bold gap-1 whitespace-nowrap shrink-0 ${resolveMissingStatusBadgeClass(
                      row.missingStatus
                    )}`}
                  >
                    <MissingStatusIcon status={row.missingStatus} />
                    {formatMissingStatus(row.missingStatus)}
                  </Badge>
                </div>

                <div className="grid grid-cols-4 gap-1 pt-2.5 text-center border-t border-border/40 text-[10px]">
                  {/* Given Tanks (formerly Cyls. w/ Dealer, using fullsDelivered) */}
                  <div>
                    <div className="text-muted-foreground uppercase font-bold tracking-wider text-[7px]">
                      Given
                    </div>
                    <div className="font-extrabold text-xs mt-0.5 text-foreground">
                      {row.fullsDelivered}
                    </div>
                  </div>
                  {/* Returned Tanks (using emptiesReturned) */}
                  <div>
                    <div className="text-muted-foreground uppercase font-bold tracking-wider text-[7px]">
                      Returned
                    </div>
                    <div className="font-extrabold text-xs mt-0.5 text-foreground">
                      {row.emptiesReturned}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase font-bold tracking-wider text-[7px]">
                      Missing
                    </div>
                    <div className="font-extrabold text-xs mt-0.5 text-red-600">
                      {row.missingTanks}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase font-bold tracking-wider text-[7px]">
                      Balance
                    </div>
                    <div className="font-bold text-xs mt-0.5 text-foreground font-mono">
                      {formatCurrency(row.unpaidBalance)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-5 py-3 border-t border-border/50 sm:flex-row sm:items-center sm:justify-between bg-muted/5">
        <div className="text-xs text-muted-foreground font-medium">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {sorted.length === 0 ? 0 : (page - 1) * pageSize + 1}
            {" – "}
            {Math.min(sorted.length, page * pageSize)}
          </span>{" "}
          of {sorted.length.toLocaleString()} dealer records
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">Rows:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger id="rto-page-size" className="w-16 h-8 text-xs font-semibold rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              id="rto-prev-btn"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              disabled={page <= 1}
              onClick={(e) => {
                e.stopPropagation();
                setPage((p) => Math.max(1, p - 1));
              }}
            >
              ‹
            </Button>
            <span className="text-xs font-mono font-bold px-2 min-w-16 text-center">
              {page} / {totalPages}
            </span>
            <Button
              id="rto-next-btn"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              disabled={page >= totalPages}
              onClick={(e) => {
                e.stopPropagation();
                setPage((p) => Math.min(totalPages, p + 1));
              }}
            >
              ›
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
