// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/components/DeliverPerformancePagination.tsx
// ==============================================================================
// Delivery Performance Report - Pagination Bar
// Manages current page, total count display, and page size selection.
// ==============================================================================

"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeliverPerformance } from "../providers/DeliverPerformanceProvider";

export function DeliverPerformancePagination() {
  const { report, updateFilter, loading } = useDeliverPerformance();
  const pagination = report?.pagination;

  if (!pagination || pagination.totalRecords === 0) return null;

  const { page, totalPages, totalRecords, pageSize } = pagination;
  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalRecords);

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between px-2 py-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span>Showing</span>
        <span className="font-semibold text-foreground">{startRecord}</span>
        <span>to</span>
        <span className="font-semibold text-foreground">{endRecord}</span>
        <span>of</span>
        <span className="font-semibold text-foreground">{totalRecords}</span>
        <span>deliveries</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Page size dropdown */}
        <div className="flex items-center gap-1.5">
          <span>Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => updateFilter("pageSize", Number(val))}
            disabled={loading}
          >
            <SelectTrigger className="h-7 w-16 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Page navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateFilter("page", 1)}
            disabled={page <= 1 || loading}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateFilter("page", page - 1)}
            disabled={page <= 1 || loading}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <span className="px-2 font-medium text-foreground">
            {page} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateFilter("page", page + 1)}
            disabled={page >= totalPages || loading}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateFilter("page", totalPages)}
            disabled={page >= totalPages || loading}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

