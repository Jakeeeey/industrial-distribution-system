// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/components/SalesPerformancePagination.tsx
// ==============================================================================
// Sales Performance Report - Table Pagination Component
// Provides page controls, rows-per-page selector, and item range indicators.
// ==============================================================================

"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSalesPerformance } from "../providers/SalesPerformanceProvider";

export function SalesPerformancePagination() {
  const { report, filters, setFilter, isLoading } = useSalesPerformance();

  const total = report?.totalRecords ?? 0;
  const page = filters.page;
  const pageSize = filters.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 border-t text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <Select
          value={String(pageSize)}
          onValueChange={(val) => setFilter("pageSize", Number(val))}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 w-16 text-xs">
            <SelectValue placeholder={String(pageSize)} />
          </SelectTrigger>
          <SelectContent side="top">
            {[10, 20, 50, 100].map((size) => (
              <SelectItem key={size} value={String(size)} className="text-xs">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-2 hidden sm:inline">
          Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of{" "}
          <strong>{total}</strong> records
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-2">
          Page <strong>{page}</strong> of <strong>{totalPages}</strong>
        </span>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setFilter("page", 1)}
          disabled={page <= 1 || isLoading}
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setFilter("page", page - 1)}
          disabled={page <= 1 || isLoading}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setFilter("page", page + 1)}
          disabled={page >= totalPages || isLoading}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setFilter("page", totalPages)}
          disabled={page >= totalPages || isLoading}
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
