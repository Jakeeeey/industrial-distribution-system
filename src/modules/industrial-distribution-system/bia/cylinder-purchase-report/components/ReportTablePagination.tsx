"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const REPORT_PAGE_SIZES = [10, 25, 50] as const;
export type ReportPageSize = (typeof REPORT_PAGE_SIZES)[number];

interface ReportTablePaginationProps {
  firstVisibleRow: number;
  isLoading: boolean;
  lastVisibleRow: number;
  onNextPage(): void;
  onPageSizeChange(pageSize: ReportPageSize): void;
  onPreviousPage(): void;
  pageSize: ReportPageSize;
  safePage: number;
  totalPages: number;
  totalRows: number;
}

export function ReportTablePagination({
  firstVisibleRow,
  isLoading,
  lastVisibleRow,
  onNextPage,
  onPageSizeChange,
  onPreviousPage,
  pageSize,
  safePage,
  totalPages,
  totalRows,
}: ReportTablePaginationProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3 border-t bg-muted/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing{" "}
        <span className="font-semibold text-foreground">
          {firstVisibleRow}–{lastVisibleRow}
        </span>{" "}
        of {totalRows.toLocaleString()} rows
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) =>
              onPageSizeChange(Number(value) as ReportPageSize)
            }
          >
            <SelectTrigger
              size="sm"
              className="w-18"
              aria-label="Rows per page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={safePage <= 1 || isLoading}
            onClick={onPreviousPage}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="min-w-16 text-center text-xs font-semibold tabular-nums">
            {safePage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={safePage >= totalPages || isLoading}
            onClick={onNextPage}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
