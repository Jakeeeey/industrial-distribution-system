// components/CustomerCylinderAgingTable.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Results table for Customer Cylinder Aging Report.
// 1. Initial sort is LATEST FIRST (issueDate descending).
// 2. Comprehensive pagination bar with page jumpers (<<, <, current, >, >>),
//    page size selector, range counts, and automatic page-1 reset.
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  ArrowUpDown,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { AgingBucketBadge, CustomerAgingActionBadge } from "./AgingBucketBadge";
import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";
import type { CustomerCylinderAgingItem } from "../types/customer-cylinder-aging.types";

export function CustomerCylinderAgingTable() {
  const { reportData, isLoading, setSelectedItem, filters, updateFilter } =
    useCustomerCylinderAging();

  // Initial sort state: LATEST FIRST (issueDate desc)
  const [sortKey, setSortKey] =
    React.useState<keyof CustomerCylinderAgingItem>("issueDate");
  const [sortAsc, setSortAsc] = React.useState<boolean>(false);
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(25);
  const items = React.useMemo(() => {
    return reportData?.items || [];
  }, [reportData?.items]);

  // Reset to page 1 when data, filter, or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters.customerCode, filters.branchId, filters.productId, filters.agingBucket, filters.searchQuery]);

  const handleSort = (key: keyof CustomerCylinderAgingItem) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false); // default to descending on column change
    }
  };

  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (sortKey === "issueDate") {
        const timeA = new Date(String(aVal)).getTime() || 0;
        const timeB = new Date(String(bVal)).getTime() || 0;
        return sortAsc ? timeA - timeB : timeB - timeA;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [items, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  
  // Safe bounded page index
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = sortedItems.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  return (
    <Card className="border shadow-2xs">
      {/* ── Table Action & Quick Search Bar ── */}
      <div className="p-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search serial, customer, doc no..."
            value={filters.searchQuery || ""}
            onChange={(e) => {
              updateFilter("searchQuery", e.target.value);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-3 justify-between sm:justify-end text-xs text-muted-foreground">
          <span>
            Showing{" "}
            <span className="font-semibold text-foreground">
              {items.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
              -
              {Math.min(safeCurrentPage * pageSize, sortedItems.length)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">
              {sortedItems.length.toLocaleString()}
            </span>{" "}
            cylinders
          </span>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="h-8.5 rounded-md border bg-card px-2.5 text-xs text-foreground focus:outline-hidden"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[180px] text-xs font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("customerName")}
                    className="-ml-3 h-8 text-xs font-semibold gap-1"
                  >
                    <span>Customer</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("serialNumber")}
                    className="-ml-3 h-8 text-xs font-semibold gap-1"
                  >
                    <span>Serial No.</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold">Product</TableHead>
                <TableHead className="text-xs font-semibold">Branch</TableHead>
                <TableHead className="text-xs font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("issueDate")}
                    className="-ml-3 h-8 text-xs font-semibold gap-1 text-primary"
                  >
                    <span>Issue Date (Latest)</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("ageDays")}
                    className="-ml-3 h-8 text-xs font-semibold gap-1"
                  >
                    <span>Age</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-xs font-semibold">Aging Bucket</TableHead>
                <TableHead className="text-xs font-semibold">Threshold</TableHead>
                <TableHead className="text-xs font-semibold">Recommended Action</TableHead>
                <TableHead className="text-right text-xs font-semibold pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-32 text-center text-xs text-muted-foreground animate-pulse"
                  >
                    Loading customer cylinder aging records...
                  </TableCell>
                </TableRow>
              ) : paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-32 text-center text-xs text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      <AlertCircle className="h-5 w-5 text-muted-foreground/60" />
                      <span>
                        No outstanding cylinders found matching the current criteria.
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item) => (
                  <TableRow
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {/* Customer */}
                    <TableCell className="text-xs font-medium py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground line-clamp-1">
                          {item.customerName}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {item.customerCode}
                        </span>
                      </div>
                    </TableCell>

                    {/* Serial Number & Estimation Tag */}
                    <TableCell className="text-xs py-3 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">
                          {item.serialNumber}
                        </span>
                        {item.isEstimated && (
                          <span
                            title="FIFO dwell estimate: individual serial match not recorded on legacy movement"
                            className="inline-flex items-center"
                          >
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-sans"
                            >
                              Est. FIFO
                            </Badge>
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Product */}
                    <TableCell className="text-xs py-3">
                      <span className="line-clamp-1 text-foreground">
                        {item.productName}
                      </span>
                    </TableCell>

                    {/* Branch */}
                    <TableCell className="text-xs py-3 text-muted-foreground">
                      {item.branchName}
                    </TableCell>

                    {/* Issue Date & Doc */}
                    <TableCell className="text-xs py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {item.issueDate}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[120px]">
                          {item.issueDocNo}
                        </span>
                      </div>
                    </TableCell>

                    {/* Age (Days) */}
                    <TableCell className="text-xs py-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold ${
                            item.isOverdue
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-foreground"
                          }`}
                        >
                          {item.ageDays} d
                        </span>
                        {item.isOverdue && (
                          <span className="text-[10px] text-rose-500 font-semibold">
                            (+{item.overdueDays}d)
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Aging Bucket */}
                    <TableCell className="text-xs py-3">
                      <AgingBucketBadge bucket={item.agingBucket} />
                    </TableCell>

                    {/* Threshold */}
                    <TableCell className="text-xs py-3 text-muted-foreground">
                      {item.agingThreshold} Days
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-xs py-3">
                      <CustomerAgingActionBadge action={item.recommendedAction} />
                    </TableCell>

                    {/* Details Trigger */}
                    <TableCell className="text-right py-3 pr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                        }}
                        className="h-7 px-2 text-xs text-primary gap-1"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Audit</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Comprehensive Pagination Controls ── */}
        <div className="p-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-muted/10">
          <div className="text-muted-foreground font-medium">
            Page {safeCurrentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1 || isLoading}
              className="h-8 w-8 p-0"
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1 || isLoading}
              className="h-8 px-2 gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Button>

            <span className="px-2 font-mono text-xs font-semibold bg-background border rounded-md h-8 flex items-center justify-center">
              {safeCurrentPage}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages || isLoading}
              className="h-8 px-2 gap-1 text-xs"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages || isLoading}
              className="h-8 w-8 p-0"
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
