"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  REPORT_PAGE_SIZES,
  ReportTablePagination,
  type ReportPageSize,
} from "./ReportTablePagination";
import { ReportTableMobileRows } from "./ReportTableMobileRows";
import { ReportTableSearch } from "./ReportTableSearch";

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
  searchLabel: string;
  searchPlaceholder?: string;
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

export function ReportDataTable<T>({
  columns,
  rows,
  rowKey,
  defaultSort,
  searchLabel,
  searchPlaceholder,
  onRowClick,
  rowActionLabel,
  renderMobileCard,
  emptyMessage,
}: ReportDataTableProps<T>): React.ReactElement {
  const { tableResetKey, isInitialLoading } = useCylinderPurchaseReport();
  const [searchText, setSearchText] = React.useState("");
  const [sortKey, setSortKey] = React.useState(defaultSort.key);
  const [sortDirection, setSortDirection] =
    React.useState<ReportSortDirection>(defaultSort.direction);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<ReportPageSize>(
    REPORT_PAGE_SIZES[0],
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
      <ReportTableSearch
        disabled={isInitialLoading}
        label={searchLabel}
        placeholder={searchPlaceholder ?? searchLabel}
        value={searchText}
        onValueChange={setSearchText}
      />

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

      <ReportTableMobileRows
        emptyMessage={resolvedEmptyMessage}
        isLoading={isInitialLoading}
        rows={pageRows}
        rowKey={rowKey}
        renderMobileCard={renderMobileCard}
        onRowClick={onRowClick}
        rowActionLabel={rowActionLabel}
      />

      <ReportTablePagination
        firstVisibleRow={firstVisibleRow}
        isLoading={isInitialLoading}
        lastVisibleRow={lastVisibleRow}
        pageSize={pageSize}
        safePage={safePage}
        totalPages={totalPages}
        totalRows={preparedRows.length}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
        onPreviousPage={() =>
          setPage((current) => Math.max(1, current - 1))
        }
        onNextPage={() =>
          setPage((current) => Math.min(totalPages, current + 1))
        }
      />
    </div>
  );
}

export type { ReportSort, ReportSortDirection } from "./report-data-table.utils";
