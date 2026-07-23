"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ReportTableMobileRowsProps<T> {
  emptyMessage: string;
  isLoading: boolean;
  onRowClick?: (row: T) => void;
  renderMobileCard(row: T): React.ReactNode;
  rowActionLabel?: (row: T) => string;
  rowKey(row: T): React.Key;
  rows: readonly T[];
}

export function ReportTableMobileRows<T>({
  emptyMessage,
  isLoading,
  onRowClick,
  renderMobileCard,
  rowActionLabel,
  rowKey,
  rows,
}: ReportTableMobileRowsProps<T>): React.ReactElement {
  return (
    <div className="space-y-3 p-3 md:hidden">
      {isLoading
        ? Array.from({ length: 8 }, (_, rowIndex) => (
            <div
              key={`mobile-skeleton-${rowIndex}`}
              className="space-y-3 rounded-lg border p-4"
            >
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))
        : null}
      {!isLoading && rows.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : null}
      {!isLoading
        ? rows.map((row) => (
            <div key={rowKey(row)} className="space-y-2">
              {renderMobileCard(row)}
              {onRowClick && rowActionLabel ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  aria-label={rowActionLabel(row)}
                  onClick={() => onRowClick(row)}
                >
                  View details
                </Button>
              ) : null}
            </div>
          ))
        : null}
    </div>
  );
}
