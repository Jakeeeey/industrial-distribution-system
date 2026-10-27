// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/components/CylinderStockPagination.tsx
// ==============================================================================
// Cylinder Stock Pagination
// Controls page navigation and limit sizes for large asset catalogues.
// ==============================================================================

"use client";

import React from "react";
import { useCylinderStockReport } from "../providers/CylinderStockReportProvider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function CylinderStockPagination() {
  const { totalCount, filters, updateFilter, isLoading } = useCylinderStockReport();

  const page = filters.page || 1;
  const limit = filters.limit || 25;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const startRecord = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <Select
          value={String(limit)}
          onValueChange={(val) => updateFilter("limit", Number(val))}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 w-16 text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
        <span>
          Showing {startRecord}–{endRecord} of {totalCount.toLocaleString()} cylinders
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="mr-2">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => updateFilter("page", page - 1)}
          disabled={page <= 1 || isLoading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => updateFilter("page", page + 1)}
          disabled={page >= totalPages || isLoading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
