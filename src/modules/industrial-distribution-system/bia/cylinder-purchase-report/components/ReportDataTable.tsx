"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCylinderPurchaseReport } from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/hooks/useCylinderPurchaseReport";

import {
  getReportColumnSpan,
  paginateReportRows,
  prepareReportRows,
  type ReportSort,
  type ReportSortDirection,
} from "./report-data-table.utils";

export interface ReportColumn<T> {
  key: string;
  label: string;
  value(row: T): string | number;
  render?(row: T): React.ReactNode;
  align?: "left" | "center" | "right";
}

interface ReportDataTableBaseProps<T> {
  columns: readonly ReportColumn<T>[];
  rows: readonly T[];
  rowKey(row: T): React.Key;
  defaultSort: ReportSort;
  searchText?: string;
  renderMobileCard(row: T): React.ReactNode;
  emptyMessage?: string;
}

interface ReportDataTableRowActionProps<T> {
  onRowClick(row: T): void;
  rowActionLabel(row: T): string;
}

interface ReportDataTableStaticProps {
  onRowClick?: undefined;
  rowActionLabel?: undefined;
}

export type ReportDataTableProps<T> = ReportDataTableBaseProps<T> &
  (ReportDataTableRowActionProps<T> | ReportDataTableStaticProps);

const PAGE_SIZES = [10, 25, 50] as const;

export function ReportDataTable<T>({
  columns,
  rows,
  rowKey,
  defaultSort,
  searchText = "",
  onRowClick,
  rowActionLabel,
  renderMobileCard,
  emptyMessage,
}: ReportDataTableProps<T>): React.ReactElement {
  const { tableResetKey, isInitialLoading } = useCylinderPurchaseReport();
  const [sortKey, setSortKey] = React.useState(defaultSort.key);
  const [sortDirection, setSortDirection] =
    React.useState<ReportSortDirection>(defaultSort.direction);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<(typeof PAGE_SIZES)[number]>(
    PAGE_SIZES[0],
  );

  React.useEffect(() => {
    setPage(1);
  }, [rows, searchText, sortKey, sortDirection, tableResetKey]);

  const preparedRows = React.useMemo(
    () =>
      prepareReportRows(rows, columns, searchText, {
        key: sortKey,
        direction: sortDirection,
      }),
    [columns, rows, searchText, sortDirection, sortKey],
  );
  const {
    pageRows,
    safePage,
    totalPages,
    firstVisibleRow,
    lastVisibleRow,
  } = React.useMemo(
    () => paginateReportRows(preparedRows, page, pageSize),
    [page, pageSize, preparedRows],
  );
  const resolvedEmptyMessage =
    emptyMessage ??
    (searchText.trim()
      ? "No report rows match the current search."
      : "No report data is available for the selected filters.");
  const hasRowAction = Boolean(onRowClick && rowActionLabel);
  const columnSpan = getReportColumnSpan(columns.length, hasRowAction);

  const changeSort = (columnKey: string): void => {
    if (sortKey === columnKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(columnKey);
      setSortDirection("asc");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const isSorted = sortKey === column.key;
                const alignment =
                  column.align === "right"
                    ? "text-right"
                    : column.align === "center"
                      ? "text-center"
                      : "text-left";

                return (
                  <TableHead
                    key={column.key}
                    className={alignment}
                    aria-sort={
                      isSorted
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={
                        column.align === "right"
                          ? "ml-auto -mr-2"
                          : column.align === "center"
                            ? "mx-auto"
                            : "-ml-2"
                      }
                      onClick={() => changeSort(column.key)}
                    >
                      {column.label}
                      {isSorted ? (
                        sortDirection === "asc" ? (
                          <ArrowUp aria-hidden="true" />
                        ) : (
                          <ArrowDown aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown aria-hidden="true" className="opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                );
              })}
              {hasRowAction ? (
                <TableHead className="text-right">Action</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoading
              ? Array.from({ length: 8 }, (_, rowIndex) => (
                  <TableRow key={`skeleton-row-${rowIndex}`}>
                    {columns.map((column) => (
                      <TableCell key={column.key}>
                        <Skeleton className="h-4 w-full max-w-28" />
                      </TableCell>
                    ))}
                    {hasRowAction ? (
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-24" />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              : null}
            {!isInitialLoading && pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnSpan}
                  className="h-28 whitespace-normal text-center text-sm text-muted-foreground"
                >
                  {resolvedEmptyMessage}
                </TableCell>
              </TableRow>
            ) : null}
            {!isInitialLoading
              ? pageRows.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={
                          column.align === "right"
                            ? "text-right tabular-nums"
                            : column.align === "center"
                              ? "text-center"
                              : undefined
                        }
                      >
                        {column.render
                          ? column.render(row)
                          : column.value(row)}
                      </TableCell>
                    ))}
                    {onRowClick && rowActionLabel ? (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={rowActionLabel(row)}
                          onClick={() => onRowClick(row)}
                        >
                          View details
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {isInitialLoading
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
        {!isInitialLoading && pageRows.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            {resolvedEmptyMessage}
          </div>
        ) : null}
        {!isInitialLoading
          ? pageRows.map((row) => (
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

      <div className="flex flex-col gap-3 border-t bg-muted/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {firstVisibleRow}–{lastVisibleRow}
          </span>{" "}
          of {preparedRows.length.toLocaleString()} rows
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value) as (typeof PAGE_SIZES)[number]);
                setPage(1);
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-18"
                aria-label="Rows per page"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
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
              disabled={safePage <= 1 || isInitialLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
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
              disabled={safePage >= totalPages || isInitialLoading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { ReportSort, ReportSortDirection } from "./report-data-table.utils";
