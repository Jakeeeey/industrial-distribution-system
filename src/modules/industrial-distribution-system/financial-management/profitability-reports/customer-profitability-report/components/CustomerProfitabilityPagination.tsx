// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/components/CustomerProfitabilityPagination.tsx
// ==============================================================================
// Pagination Component for Customer Profitability Report
// Supports 10, 20, 50, 100 rows per page with first, last, next, prev controls.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

"use client";

import * as React from "react";
import { useCustomerProfitability } from "../providers/CustomerProfitabilityProvider";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export function CustomerProfitabilityPagination() {
  const { data, page, setPage, pageSize, setPageSize } = useCustomerProfitability();

  if (!data || data.totalRows === 0) return null;

  const { totalRows, totalPages } = data;
  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalRows);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 border-t border-border text-xs text-muted-foreground bg-card/40 rounded-b-xl">
      {/* Records Count Indicator */}
      <div>
        Showing <span className="font-semibold text-foreground">{startRecord}</span> to{" "}
        <span className="font-semibold text-foreground">{endRecord}</span> of{" "}
        <span className="font-semibold text-foreground">{totalRows}</span> accounts
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Page size dropdown */}
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-7 text-xs bg-background border border-input rounded px-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <span className="mr-1">
            Page <span className="font-semibold text-foreground">{page}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span>
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(1)}
            disabled={page <= 1}
            className="h-7 w-7 p-0"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="h-7 w-7 p-0"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
