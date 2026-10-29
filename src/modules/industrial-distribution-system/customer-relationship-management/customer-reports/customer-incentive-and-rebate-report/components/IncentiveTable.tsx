"use client";

// ============================================================
// IncentiveTable.tsx
// Result grid at the customer grain — the level a claim is approved and
// settled at. Money is never spread across product rows here, which is why
// one customer occupies exactly one line however many branches supplied it.
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

import { useCustomerIncentiveReport } from "../hooks/useCustomerIncentiveReport";
import {
  formatAmount,
  formatKg,
  formatQty,
  formatRate,
} from "../services/customer-incentive.helpers";
import type { CustomerIncentiveRow } from "../types/customer-incentive.types";
import { StatusBadge } from "./StatusBadge";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Sorting is local only: the server hands back the whole window already, so
// re-reading it to change the order would be wasted work.
type SortKey =
  | "customer"
  | "branch"
  | "eligibleUnits"
  | "eligibleKg"
  | "ratePerKg"
  | "earnedAmount"
  | "adjustmentAmount"
  | "approvedAmount"
  | "releasedAmount"
  | "outstandingAmount"
  | "varianceAmount";

interface ColumnDef {
  label: string;
  sortKey?: SortKey;
  numeric?: boolean;
  /** Shown in the header only on wide screens; the value stays visible. */
  hint?: string;
  /** Explanatory title and calculation formula for tooltip and accessibility. */
  title?: string;
  /** Explicit business calculation basis displayed on the column header. */
  basis?: string;
}

// Columns annotated with descriptive title tooltips and explicit calculation bases
// for long-term auditability and clear business interpretation.
const COLUMNS: ColumnDef[] = [
  {
    label: "Customer",
    sortKey: "customer",
    title: "Customer trade name, account code, and store identification",
    basis: "Account Master",
  },
  {
    label: "Branch",
    sortKey: "branch",
    title: "Fulfilling branch locations supplying the customer",
    basis: "Invoice Branch",
  },
  {
    label: "Eligible units",
    sortKey: "eligibleUnits",
    numeric: true,
    title: "Net eligible refill units delivered during the period",
    basis: "Gross − Returns",
  },
  {
    label: "Eligible kg",
    sortKey: "eligibleKg",
    numeric: true,
    title: "Total eligible weight in kilograms based on cylinder category size",
    basis: "Units × Cylinder kg",
  },
  {
    label: "Recorded ₱/kg",
    sortKey: "ratePerKg",
    numeric: true,
    title: "Quantity-weighted billed rate per kilogram from sales invoices",
    basis: "Unit Price / kg",
  },
  {
    label: "Earned ₱",
    sortKey: "earnedAmount",
    numeric: true,
    title: "Gross recorded value of eligible refill volume billed to customer",
    basis: "Eligible kg × ₱/kg",
  },
  {
    label: "Adjustments ₱",
    sortKey: "adjustmentAmount",
    numeric: true,
    title: "Return credit adjustments deducted from earned volume",
    basis: "Returned Units × Price",
  },
  {
    label: "Approved ₱",
    sortKey: "approvedAmount",
    numeric: true,
    title: "Credit memo amount reviewed and signed by finance",
    basis: "customers_memo.amount",
  },
  {
    label: "Released ₱",
    sortKey: "releasedAmount",
    numeric: true,
    title: "Settled payment amount applied to invoices or paid via transmittal",
    basis: "Transmittals / Applied",
  },
  {
    label: "Outstanding ₱",
    sortKey: "outstandingAmount",
    numeric: true,
    title: "Approved incentive balance remaining to be released or settled",
    basis: "Approved − Released",
  },
  {
    label: "Variance ₱",
    sortKey: "varianceAmount",
    numeric: true,
    hint: "approved − earned",
    title: "Reconciliation gap between finance-approved memo and recorded gas value",
    basis: "Approved − Earned",
  },
  {
    label: "Claim status",
    title: "Current lifecycle state of customer credit memo claims",
    basis: "Memo Lifecycle",
  },
];

// null means "not known" (no unit price on any eligible line) and is always
// pushed to the end whichever way the column is sorted.
type SortValue = string | number | null;

const ACCESSORS: Record<SortKey, (row: CustomerIncentiveRow) => SortValue> = {
  customer: (row) => row.customerName.toLowerCase(),
  branch: (row) => row.branchNames[0]?.toLowerCase() ?? null,
  eligibleUnits: (row) => row.eligibleUnits,
  eligibleKg: (row) => row.eligibleKg,
  ratePerKg: (row) => (row.rateIsKnown ? row.ratePerKg : null),
  earnedAmount: (row) => row.earnedAmount,
  adjustmentAmount: (row) => row.adjustmentAmount,
  approvedAmount: (row) => row.approvedAmount,
  releasedAmount: (row) => row.releasedAmount,
  outstandingAmount: (row) => row.outstandingAmount,
  varianceAmount: (row) => row.varianceAmount,
};

/** Local, case-insensitive match across the identifying columns. */
function matches(row: CustomerIncentiveRow, term: string): boolean {
  if (!term) return true;
  const haystack = [
    row.customerCode,
    row.customerName,
    row.storeName,
    row.classificationName,
    ...row.branchNames,
    ...row.salesmanNames,
    ...row.memoNumbers,
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

/** A negative variance means the claim is below the recorded value of the gas. */
function VarianceCell({ value }: { value: number }): React.ReactElement {
  if (value === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={
        value > 0
          ? "font-medium tabular-nums text-amber-700"
          : "font-medium tabular-nums text-sky-700"
      }
      title={value > 0 ? "Approved above the recorded value" : "Approved below it"}
    >
      {formatAmount(value)}
    </span>
  );
}

export function IncentiveTable(): React.ReactElement | null {
  const { report, openCustomerDetail } = useCustomerIncentiveReport();
  const [term, setTerm] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(25);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" } | null>(
    null
  );

  const rows = React.useMemo(() => {
    if (!report) return [];
    const filtered = report.rows.filter((row) => matches(row, term));
    if (!sort) return filtered;
    const read = ACCESSORS[sort.key];
    const factor = sort.dir === "asc" ? 1 : -1;
    // Array#sort is stable, so unsorted ties keep the server's
    // customer-name -> approved-amount order.
    return [...filtered].sort((a, b) => factor * compareValues(read(a), read(b)));
  }, [report, term, sort]);

  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  React.useEffect(() => {
    setPage(0);
  }, [term, report, sort, pageSize]);

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
              Incentive by customer
            </h2>
            <span className="text-xs text-muted-foreground">
              {formatQty(rows.length)} row{rows.length === 1 ? "" : "s"}
              {term ? " matching" : ""}
            </span>
          </div>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Filter customers, branches, memos"
              aria-label="Filter rows"
              className="w-full pl-8 sm:w-72"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((column) => {
                  const sortKey = column.sortKey;
                  const activeDir = sort && sort.key === sortKey ? sort.dir : null;
                  // Basis and descriptive titles are displayed exclusively on hover/title tooltip
                  const headerTitle = column.title
                    ? `${column.title}${column.basis ? ` · Basis: ${column.basis}` : ""}`
                    : column.basis
                      ? `Basis: ${column.basis}`
                      : undefined;
                  return (
                    <TableHead
                      key={column.label}
                      aria-sort={
                        activeDir
                          ? activeDir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      title={headerTitle}
                      className={`h-9 whitespace-nowrap px-0 ${
                        column.numeric ? "text-right" : ""
                      }`}
                    >
                      {sortKey ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSort(sortKey, column.numeric)}
                          title={headerTitle}
                          className={`h-full w-full justify-between rounded-none px-2 text-xs font-semibold ${
                            activeDir ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {column.label}
                          {activeDir === "asc" ? (
                            <ArrowUp aria-hidden="true" className="size-3" />
                          ) : activeDir === "desc" ? (
                            <ArrowDown aria-hidden="true" className="size-3" />
                          ) : (
                            <ArrowUpDown aria-hidden="true" className="size-3 opacity-40" />
                          )}
                        </Button>
                      ) : (
                        <span
                          className="px-2 text-xs font-semibold text-muted-foreground"
                          title={headerTitle}
                        >
                          {column.label}
                          {column.hint ? (
                            <span className="ml-1 font-normal opacity-70">
                              ({column.hint})
                            </span>
                          ) : null}
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setTerm("")}
                        >
                          Clear filter
                        </Button>
                      </span>
                    ) : (
                      "No eligible volume or claim in this window."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((row) => (
                  <TableRow
                    key={row.customerCode}
                    className="cursor-pointer focus-visible:bg-muted/60"
                    tabIndex={0}
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
                    <TableCell className="max-w-[240px]">
                      <p className="truncate font-medium">{row.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.customerCode}
                        {row.storeName ? ` · ${row.storeName}` : ""}
                      </p>
                      {row.classificationName &&
                      row.classificationName !== "Unclassified" ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {row.classificationName}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <p className="truncate">{row.branchNames.join(", ") || "—"}</p>
                      {row.salesmanNames.length > 0 ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {row.salesmanNames.join(", ")}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQty(row.eligibleUnits)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatKg(row.eligibleKg)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.rateIsKnown ? formatRate(row.ratePerKg) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(row.earnedAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.adjustmentAmount === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatAmount(-row.adjustmentAmount)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.claimCount === 0 ? (
                        <span className="text-muted-foreground">no claim</span>
                      ) : (
                        formatAmount(row.approvedAmount)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(row.releasedAmount)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatAmount(row.outstandingAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <VarianceCell value={row.varianceAmount} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={row.claimStatus} label={row.statusLabel} />
                        {/* Naming the memo on the line it is read is what makes
                            a claim traceable without opening the drawer. */}
                        {row.memoNumbers.length > 0 ? (
                          <span className="max-w-[160px] truncate text-[10px] text-muted-foreground">
                            {row.memoNumbers.join(", ")}
                          </span>
                        ) : null}
                        {row.claimStatuses.length > 1 ? (
                          <span className="text-[10px] text-muted-foreground">
                            mixed statuses — see drawer
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Page {safePage + 1} of {pageCount} · click a row for its claims and
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
                onClick={() =>
                  setPage((current) => Math.min(current + 1, pageCount - 1))
                }
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
