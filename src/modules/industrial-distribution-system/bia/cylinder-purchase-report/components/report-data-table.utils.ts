export type ReportSortDirection = "asc" | "desc";

export interface ReportSort {
  key: string;
  direction: ReportSortDirection;
}

export interface ReportValueColumn<T> {
  key: string;
  value(row: T): string | number;
}

export interface ReportPage<T> {
  pageRows: T[];
  safePage: number;
  totalPages: number;
  firstVisibleRow: number;
  lastVisibleRow: number;
}

export function getReportColumnSpan(
  columnCount: number,
  hasRowAction: boolean,
): number {
  return columnCount + (hasRowAction ? 1 : 0);
}

function compareValues(left: string | number, right: string | number): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function prepareReportRows<T>(
  rows: readonly T[],
  columns: readonly ReportValueColumn<T>[],
  searchText: string,
  sort: ReportSort | null,
): T[] {
  const normalizedSearch = searchText.trim().toLocaleLowerCase();
  const filteredRows = normalizedSearch
    ? rows.filter((row) =>
        columns.some((column) =>
          String(column.value(row)).toLocaleLowerCase().includes(normalizedSearch),
        ),
      )
    : [...rows];

  if (!sort) {
    return filteredRows;
  }

  const sortColumn = columns.find((column) => column.key === sort.key);
  if (!sortColumn) {
    return filteredRows;
  }

  const direction = sort.direction === "asc" ? 1 : -1;
  return filteredRows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .sort((left, right) => {
      const comparison = compareValues(
        sortColumn.value(left.row),
        sortColumn.value(right.row),
      );
      return comparison === 0
        ? left.originalIndex - right.originalIndex
        : comparison * direction;
    })
    .map(({ row }) => row);
}

export function paginateReportRows<T>(
  rows: readonly T[],
  requestedPage: number,
  pageSize: number,
): ReportPage<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, requestedPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = rows.slice(startIndex, startIndex + pageSize);

  return {
    pageRows,
    safePage,
    totalPages,
    firstVisibleRow: rows.length === 0 ? 0 : startIndex + 1,
    lastVisibleRow: Math.min(startIndex + pageSize, rows.length),
  };
}
