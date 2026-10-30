"use client";

// ============================================================
// CustomerOrderConsumptionTable.tsx
// Result grid at the customer x branch x channel x product grain, with a
// local text filter, column sorting and paging. Selecting a row opens its
// documents.
// ============================================================

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useCustomerOrderConsumptionReport } from "../hooks/useCustomerOrderConsumptionReport";
import {
  computeReturnRate,
  formatAmount,
  formatKgCompact,
  formatPercent,
  formatQty,
} from "../services/customer-order-consumption.helpers";
import type {
  ConsumptionChannel,
  CustomerOrderConsumptionRow,
} from "../types/customer-order-consumption.types";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const CHANNEL_FILTERS: { key: "ALL" | ConsumptionChannel; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "CYLINDER", label: "Cylinder" },
  { key: "LPG", label: "LPG" },
];

type ChannelFilter = (typeof CHANNEL_FILTERS)[number]["key"];

// Sorting is local only: the server hands back the whole window already, so
// re-reading it to change the order would be wasted work.
type SortKey =
  | "customer"
  | "branch"
  | "channel"
  | "product"
  | "sizeKg"
  | "events"
  | "grossQty"
  | "returnedQty"
  | "grossKg"
  | "returnedKg"
  | "netKg"
  | "returnRate"
  | "netAmount"
  | "avgKg";

interface ColumnDef {
  label: string;
  sortKey?: SortKey;
  numeric?: boolean;
  /** Rendered under the label so the unit is never guessed at. */
  unit?: string;
}

// "Gas type" is not a column: it is a provisional label derived from the
// product category, so it sits under the product name where it belongs.
const COLUMNS: ColumnDef[] = [
  { label: "Customer", sortKey: "customer" },
  { label: "Branch", sortKey: "branch" },
  { label: "Channel", sortKey: "channel" },
  { label: "Product", sortKey: "product" },
  { label: "Size", sortKey: "sizeKg", numeric: true, unit: "kg" },
  { label: "Events", sortKey: "events", numeric: true, unit: "orders" },
  { label: "Gross", sortKey: "grossQty", numeric: true, unit: "pieces" },
  { label: "Returned", sortKey: "returnedQty", numeric: true, unit: "pieces" },
  { label: "Gross", sortKey: "grossKg", numeric: true, unit: "kg" },
  { label: "Returned", sortKey: "returnedKg", numeric: true, unit: "kg" },
  { label: "Net", sortKey: "netKg", numeric: true, unit: "kg" },
  { label: "Return rate", sortKey: "returnRate", numeric: true, unit: "%" },
  { label: "Net amount", sortKey: "netAmount", numeric: true, unit: "PHP" },
  { label: "Avg net", sortKey: "avgKg", numeric: true, unit: "kg / event" },
];

// null means "not known" (a product with no weight, an unassigned gas type)
// and is always pushed to the end whichever way the column is sorted.
type SortValue = string | number | null;

const ACCESSORS: Record<SortKey, (row: CustomerOrderConsumptionRow) => SortValue> = {
  customer: (row) => row.customerName.toLowerCase(),
  branch: (row) => row.branchName.toLowerCase(),
  channel: (row) => row.channel.toLowerCase(),
  product: (row) => row.productName.toLowerCase(),
  sizeKg: (row) => row.sizeKg,
  events: (row) => row.orderCount,
  grossQty: (row) => row.grossQty,
  returnedQty: (row) => row.returnedQty,
  grossKg: (row) => row.grossKg,
  returnedKg: (row) => row.returnedKg,
  netKg: (row) => row.netKg,
  returnRate: (row) => computeReturnRate(row.returnedKg, row.grossKg),
  netAmount: (row) => row.netAmount,
  avgKg: (row) => row.avgOrderSizeKg,
};

/** Local, case-insensitive match across the identifying columns. */
function matches(row: CustomerOrderConsumptionRow, term: string): boolean {
  if (!term) return true;
  const haystack = [
    row.customerCode,
    row.customerName,
    row.storeName,
    row.branchName,
    row.productCode,
    row.productName,
    row.gasType ?? "",
    row.channel,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function compareValues(a: SortValue, b: SortValue): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function ChannelBadge({ row }: { row: CustomerOrderConsumptionRow }) {
  return (
    <div className="flex flex-col gap-1">
      <Badge variant={row.channel === "LPG" ? "secondary" : "outline"}>
        {row.channel === "LPG" ? "LPG" : "Cylinder"}
      </Badge>
      {/* States the basis of the kg on the same line it is read. */}
      <span className="text-[10px] text-muted-foreground">
        {row.kgIsProxy ? "kg proxy" : "kg measured"}
        {row.billingMode ? ` · ${row.billingMode}` : ""}
      </span>
    </div>
  );
}

export function CustomerOrderConsumptionTable(): React.ReactElement | null {
  const { report, openCustomerDetail } = useCustomerOrderConsumptionReport();
  const [term, setTerm] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(25);
  const [channelFilter, setChannelFilter] = React.useState<ChannelFilter>("ALL");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" } | null>(
    null
  );

  // Slicing by channel here re-uses the rows already on screen instead of
  // re-querying the server for what the row badge can answer.
  const channelCounts = React.useMemo(() => {
    const counts: Record<ChannelFilter, number> = { ALL: 0, CYLINDER: 0, LPG: 0 };
    for (const row of report?.rows ?? []) {
      counts.ALL += 1;
      counts[row.channel] += 1;
    }
    return counts;
  }, [report]);

  const rows = React.useMemo(() => {
    if (!report) return [];
    const filtered = report.rows.filter(
      (row) =>
        (channelFilter === "ALL" || row.channel === channelFilter) &&
        matches(row, term)
    );
    if (!sort) return filtered;
    const read = ACCESSORS[sort.key];
    const factor = sort.dir === "asc" ? 1 : -1;
    // Array#sort is stable, so unsorted ties keep the server's
    // customer -> branch -> channel -> kg order.
    return [...filtered].sort((a, b) => factor * compareValues(read(a), read(b)));
  }, [report, term, sort, channelFilter]);

  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  React.useEffect(() => {
    setPage(0);
  }, [term, report, sort, channelFilter, pageSize]);

  if (!report) return null;

  const toggleSort = (key: SortKey, numeric: boolean | undefined): void => {
    setSort((current) => {
      if (current?.key === key) {
        // Two states are enough: cycling through "unsorted" would leave the
        // reader guessing which of the three they were looking at.
        return { key, dir: current.dir === "desc" ? "asc" : "desc" };
      }
      return { key, dir: numeric ? "desc" : "asc" };
    });
  };

  return (
    <Card className="gap-3 border-border/80 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              Customer × branch × channel × product
            </h2>
            <span className="text-xs text-muted-foreground">
              {formatQty(rows.length)} row{rows.length === 1 ? "" : "s"}
              {term ? " matching" : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter rows by channel"
              className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
            >
              {CHANNEL_FILTERS.map(({ key, label }) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={channelFilter === key ? "secondary" : "ghost"}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  aria-pressed={channelFilter === key}
                  onClick={() => setChannelFilter(key)}
                >
                  {label}
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {formatQty(channelCounts[key])}
                  </span>
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Filter customers, products, branches"
                aria-label="Filter rows"
                className="w-full pl-8 sm:w-72"
              />
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border/70 [&>div]:max-h-[70vh] [&>div]:overflow-auto">
          <Table className="min-w-[1480px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((column, index) => {
                  const sortKey = column.sortKey;
                  const activeDir =
                    sort && sort.key === sortKey ? sort.dir : null;
                  const pinned = index === 0;
                  return (
                    <TableHead
                      key={`${column.label}-${column.unit ?? ""}`}
                      aria-sort={
                        activeDir
                          ? activeDir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={`sticky top-0 z-20 h-11 whitespace-nowrap bg-card px-0 ${
                        pinned ? "left-0 z-30 border-r border-border/60" : ""
                      } ${column.numeric ? "text-right" : ""}`}
                    >
                      {sortKey ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSort(sortKey, column.numeric)}
                          className={`h-full w-full justify-between gap-1.5 rounded-none px-2 text-xs font-semibold ${
                            activeDir ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          <span
                            className={`flex flex-col leading-tight ${
                              column.numeric ? "items-end" : "items-start"
                            }`}
                          >
                            {column.label}
                            {column.unit ? (
                              <span className="text-[10px] font-normal text-muted-foreground">
                                {column.unit}
                              </span>
                            ) : null}
                          </span>
                          {activeDir === "asc" ? (
                            <ArrowUp aria-hidden="true" className="size-3 shrink-0" />
                          ) : activeDir === "desc" ? (
                            <ArrowDown aria-hidden="true" className="size-3 shrink-0" />
                          ) : (
                            <ArrowUpDown aria-hidden="true" className="size-3 shrink-0 opacity-40" />
                          )}
                        </Button>
                      ) : (
                        <span className="px-2 text-xs font-semibold text-muted-foreground">
                          {column.label}
                        </span>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={COLUMNS.length}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {term ? (
                      <span className="inline-flex flex-wrap items-center justify-center gap-2">
                        Nothing matches &ldquo;{term}&rdquo;.
                        <Button type="button" variant="outline" size="sm" onClick={() => setTerm("")}>
                          Clear filter
                        </Button>
                      </span>
                    ) : (
                      "No customer demand in this window."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((row) => (
                  <TableRow
                    key={`${row.customerCode}|${row.branchId}|${row.channel}|${row.productId}`}
                    className="group cursor-pointer focus-visible:bg-muted/60"
                    tabIndex={0}
                    aria-label={`Open supporting documents for ${row.customerName}`}
                    // The row is the only way into the supporting documents,
                    // so it needs keyboard access as well as a click.
                    onClick={() =>
                      void openCustomerDetail({
                        customerCode: row.customerCode,
                        customerName: row.customerName,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      void openCustomerDetail({
                        customerCode: row.customerCode,
                        customerName: row.customerName,
                      });
                    }}
                  >
                    <TableCell className="sticky left-0 z-10 max-w-[240px] border-r border-border/60 bg-card group-focus-visible:bg-muted/60">
                      <p className="truncate font-medium">{row.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.customerCode}
                        {row.storeName ? ` · ${row.storeName}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{row.branchName}</TableCell>
                    <TableCell>
                      <ChannelBadge row={row} />
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate">{row.productName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.productCode}
                        {row.gasType ? ` · ${row.gasType}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.sizeKg == null ? "—" : formatKgCompact(row.sizeKg)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.orderCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatQty(row.grossQty)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.returnedQty === 0 ? "—" : formatQty(row.returnedQty)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatKgCompact(row.grossKg)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.returnedKg === 0 ? "—" : formatKgCompact(row.returnedKg)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        row.netKg < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatKgCompact(row.netKg)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(computeReturnRate(row.returnedKg, row.grossKg))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(row.netAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.orderCount === 0 ? "—" : formatKgCompact(row.avgOrderSizeKg)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Page {safePage + 1} of {pageCount} · the customer column and the
            headings stay pinned while you scroll sideways · click a row for its
            supporting documents
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(next) => setPageSize(Number(next))}
              >
                <SelectTrigger className="h-8 w-[72px]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
                disabled={safePage === 0}
                className="gap-1"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(current + 1, pageCount - 1))}
                disabled={safePage >= pageCount - 1}
                className="gap-1"
              >
                Next
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
