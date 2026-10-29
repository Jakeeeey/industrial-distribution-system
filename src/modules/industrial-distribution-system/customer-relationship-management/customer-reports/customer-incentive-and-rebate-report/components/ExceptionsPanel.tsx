// ============================================================
// ExceptionsPanel.tsx
// Data-quality findings the report refuses to silently repair. A claim can
// be paid against these numbers, so anything the source does not answer is
// listed here instead of being guessed into a total.
//
// Refined & Modernized Enterprise UI:
// - Comprehensive audit dashboard header with KPI summary metrics
// - Interactive search and severity filters for rapid reviewer triage
// - Clear human-friendly titles and business context for each exception code
// - High-contrast severity accenting (Critical, Warning, Info)
// - Dual View Modes: Grouped Cards View (with per-group pagination) & Flat Table View
// - Full pagination controls: Rows per page (10, 25, 50, 100), Page X of Y, Previous / Next
// ============================================================

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  LayoutGrid,
  List,
  Search,
  SearchX,
  ShieldAlert,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  formatQty,
} from "../services/customer-incentive.helpers";
import type {
  ExceptionCode,
  ReportException,
} from "../types/customer-incentive.types";

interface CodeMetadata {
  title: string;
  category: "Memo & Claim" | "Document Validity" | "Master Data" | "Pricing & Rates";
  description: string;
}

/**
 * Human-readable definitions and explanations for each exception code.
 * Ensures audit teams and reviewers understand the exact business rationale.
 */
const CODE_METADATA: Record<ExceptionCode, CodeMetadata> = {
  MEMO_WITHOUT_EVIDENCE: {
    title: "Memo Without Supporting Refill Evidence",
    category: "Memo & Claim",
    description:
      "An approved memo exists with no eligible invoiced volume behind it in the window. The claim cannot be substantiated from refill records.",
  },
  DUPLICATE_MEMO_SUSPECTED: {
    title: "Suspected Duplicate Memos",
    category: "Memo & Claim",
    description:
      "Two memos for the same customer carry identical amounts. Duplicate claims are prevented; equal amounts require auditor review before payout.",
  },
  OVER_RELEASED: {
    title: "Over-Released Claim Payout",
    category: "Memo & Claim",
    description:
      "Settled money exceeds the approved amount, so the claim is either overpaid or its approval was amended without restating the memo.",
  },
  MEMO_OUTSIDE_WINDOW: {
    title: "Memo Invoices Outside Date Window",
    category: "Memo & Claim",
    description:
      "The memo is linked to invoices that fall outside the applied window, so the claim and supporting volume are measured over different periods.",
  },
  MEMO_WITHOUT_CUSTOMER: {
    title: "Memo Lacks Customer Association",
    category: "Memo & Claim",
    description:
      "The memo points at a customer ID that resolves to no customer code in the customer master, so it cannot be linked to sales evidence.",
  },
  MEMO_STATUS_UNRECOGNISED: {
    title: "Unrecognised Memo Status",
    category: "Memo & Claim",
    description:
      "customers_memo.status holds a value outside the documented status enum. The memo was assigned no claim status and earns nothing here.",
  },
  VOIDED_INVOICE_EXCLUDED: {
    title: "Voided or Reprint Invoices Excluded",
    category: "Document Validity",
    description:
      "The document is cancelled, voided, or a reprint of a document already issued. Voided records are excluded to prevent duplicate delivery counts.",
  },
  UNPOSTED_RETURN_EXCLUDED: {
    title: "Unposted Sales Returns Excluded",
    category: "Document Validity",
    description:
      "The sales return carries an unposted flag; the goods are not yet taken back on the ledger, so units were not deducted from earned totals.",
  },
  RETURNED_UNITS_EXCEEDED: {
    title: "Returns Exceed Invoiced Volume",
    category: "Document Validity",
    description:
      "Accepted returns outnumber invoiced units in the window. Eligible units were floored at zero instead of producing a negative claim.",
  },
  NO_RATE_SNAPSHOT: {
    title: "Missing Unit Price Rate Snapshot",
    category: "Pricing & Rates",
    description:
      "An eligible line has no unit price, so no ₱/kg could be read from it. No guessed rate was substituted from other lines or current price lists.",
  },
  MISSING_PRODUCT_WEIGHT: {
    title: "Product Missing Cylinder Weight",
    category: "Master Data",
    description:
      "Neither the product category name nor recorded weight states a cylinder size. Invoiced pieces cannot be validated against eligible size criteria.",
  },
  PRODUCT_NOT_CATEGORISED: {
    title: "Product Lacks Category Mapping",
    category: "Master Data",
    description:
      "A cylinder-size filter was applied, but this product has no category on the master. It was excluded rather than guessed at.",
  },
  BRANCH_UNRESOLVED: {
    title: "Unresolved Document Branch",
    category: "Master Data",
    description:
      "The document carries no branch, so it cannot be scoped by the branch filter and cross-branch access is unverifiable.",
  },
};

const SEVERITY_ORDER: Record<ReportException["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Badge pill for document reference type */
function ReferenceTypeBadge({
  type,
}: {
  type: ReportException["referenceType"];
}): React.ReactElement {
  switch (type) {
    case "MEMO":
      return (
        <Badge
          variant="outline"
          className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300 text-[10px] font-medium"
        >
          Memo
        </Badge>
      );
    case "INVOICE":
      return (
        <Badge
          variant="outline"
          className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-medium"
        >
          Invoice
        </Badge>
      );
    case "RETURN":
      return (
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-medium"
        >
          Return
        </Badge>
      );
    case "PRODUCT":
      return (
        <Badge
          variant="outline"
          className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 text-[10px] font-medium"
        >
          Product
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          {type}
        </Badge>
      );
  }
}

/** Severity badge pill */
function SeverityBadge({
  severity,
}: {
  severity: ReportException["severity"];
}): React.ReactElement {
  switch (severity) {
    case "critical":
      return (
        <Badge variant="destructive" className="gap-1 text-[10px] font-medium">
          <AlertCircle className="size-3" />
          Critical
        </Badge>
      );
    case "warning":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] font-medium"
        >
          <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />
          Warning
        </Badge>
      );
    case "info":
      return (
        <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
          <Info className="size-3" />
          Info
        </Badge>
      );
  }
}

/**
 * Individual Exception Group Card with its own dedicated pagination controls.
 * Prevents DOM flooding when an exception code has dozens or hundreds of occurrences.
 */
function ExceptionGroupCard({
  code,
  items,
  meta,
  openCustomerDetail,
}: {
  code: ExceptionCode;
  items: ReportException[];
  meta?: CodeMetadata;
  openCustomerDetail: (target: { customerCode: string; customerName: string }) => void;
}): React.ReactElement {
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(10);

  // AG-WORKFLOW: Automatically reset page index to 0 whenever the filtered item count changes
  React.useEffect(() => {
    setPage(0);
  }, [items.length]);

  const pageCount = Math.max(Math.ceil(items.length / pageSize), 1);
  const safePage = Math.min(page, pageCount - 1);
  const pagedItems = items.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  const groupInvolvedAmount = items.reduce(
    (sum, item) => sum + Math.abs(item.amount ?? 0),
    0
  );
  const severity = items[0].severity;

  // Visual card accent styling based on severity level
  const borderClass =
    severity === "critical"
      ? "border-l-4 border-l-rose-500 border-border"
      : severity === "warning"
        ? "border-l-4 border-l-amber-500 border-border"
        : "border-l-4 border-l-sky-500 border-border";

  const startRecord = items.length === 0 ? 0 : safePage * pageSize + 1;
  const endRecord = Math.min((safePage + 1) * pageSize, items.length);

  return (
    <Card className={`overflow-hidden bg-card shadow-sm transition-all ${borderClass}`}>
      <CardHeader className="gap-2.5 border-b border-border/50 bg-muted/15 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={severity} />
            <h3 className="text-sm font-semibold text-foreground">
              {meta?.title ?? code}
            </h3>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {code}
            </code>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-foreground">
              {formatQty(items.length)} occurrence{items.length === 1 ? "" : "s"}
            </span>
            <span className="text-muted-foreground">·</span>
            {groupInvolvedAmount > 0 ? (
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {formatAmount(groupInvolvedAmount)} involved
              </span>
            ) : (
              <span className="text-muted-foreground">No financial amount</span>
            )}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {meta?.description ?? "Audited exception finding."}
        </p>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 text-[11px]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[280px] text-[11px] font-semibold uppercase tracking-wider">
                  Customer
                </TableHead>
                <TableHead className="w-[140px] text-[11px] font-semibold uppercase tracking-wider">
                  Reference #
                </TableHead>
                <TableHead className="w-[100px] text-[11px] font-semibold uppercase tracking-wider">
                  Type
                </TableHead>
                <TableHead className="w-[130px] text-right text-[11px] font-semibold uppercase tracking-wider">
                  Involved ₱
                </TableHead>
                <TableHead className="min-w-[280px] text-[11px] font-semibold uppercase tracking-wider">
                  Audit Finding / Observation
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedItems.map((item, idx) => (
                <TableRow
                  key={`${item.referenceNo}-${safePage * pageSize + idx}`}
                  className="hover:bg-muted/30"
                >
                  {/* Customer Column with interactive drilldown trigger */}
                  <TableCell className="align-top">
                    {item.customerCode ? (
                      <button
                        type="button"
                        onClick={() =>
                          void openCustomerDetail({
                            customerCode: item.customerCode!,
                            customerName: item.customerName,
                          })
                        }
                        className="group flex flex-col text-left font-medium text-foreground hover:text-primary"
                        title="Click to view customer incentive history and supporting documents"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="group-hover:underline">
                            {item.customerName}
                          </span>
                          <ExternalLink className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {item.customerCode}
                        </span>
                      </button>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {item.customerName || "Unmatched Customer"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          No customer code
                        </span>
                      </div>
                    )}
                  </TableCell>

                  {/* Reference Number */}
                  <TableCell className="align-top font-mono text-xs">
                    <span className="inline-block rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">
                      {item.referenceNo}
                    </span>
                  </TableCell>

                  {/* Document Type Badge */}
                  <TableCell className="align-top">
                    <ReferenceTypeBadge type={item.referenceType} />
                  </TableCell>

                  {/* Involved Financial Amount */}
                  <TableCell className="align-top text-right tabular-nums">
                    {item.amount != null && item.amount !== 0 ? (
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {formatAmount(item.amount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Detail Observation */}
                  <TableCell className="align-top text-xs leading-relaxed text-muted-foreground">
                    {item.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* AG-WORKFLOW: Occurrence Pagination Toolbar per exception category card */}
        {items.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-muted/10 px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Showing {startRecord}–{endRecord} of {items.length} occurrences
              {pageCount > 1 ? ` · Page ${safePage + 1} of ${pageCount}` : ""}
            </span>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(next) => {
                    setPageSize(Number(next));
                    setPage(0);
                  }}
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

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  disabled={safePage === 0}
                  className="gap-1 h-8 px-2.5 text-xs"
                >
                  <ChevronLeft aria-hidden="true" className="size-3.5" />
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
                  className="gap-1 h-8 px-2.5 text-xs"
                >
                  Next
                  <ChevronRight aria-hidden="true" className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ExceptionsPanel(): React.ReactElement | null {
  const { report, openCustomerDetail } = useCustomerIncentiveReport();

  // Search filter and severity filter state
  const [searchTerm, setSearchTerm] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState<
    ReportException["severity"] | "all"
  >("all");

  // View mode switcher: Grouped cards or Unified flat table
  const [viewMode, setViewMode] = React.useState<"grouped" | "flat">("grouped");

  // Flat table view pagination state
  const [flatPage, setFlatPage] = React.useState(0);
  const [flatPageSize, setFlatPageSize] = React.useState<number>(25);

  if (!report || report.exceptions.length === 0) return null;

  // Global KPI calculations across all exceptions
  const totalFindings = report.exceptions.length;
  const totalInvolvedAmount = report.exceptions.reduce(
    (sum, item) => sum + Math.abs(item.amount ?? 0),
    0
  );
  const criticalCount = report.exceptions.filter(
    (e) => e.severity === "critical"
  ).length;
  const warningCount = report.exceptions.filter(
    (e) => e.severity === "warning"
  ).length;
  const infoCount = report.exceptions.filter((e) => e.severity === "info").length;

  // Filter exceptions based on search keyword and severity selection
  const filteredExceptions = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return report.exceptions.filter((item) => {
      if (severityFilter !== "all" && item.severity !== severityFilter) {
        return false;
      }
      if (!term) return true;

      const codeMeta = CODE_METADATA[item.code];
      const matchCustomer = item.customerName.toLowerCase().includes(term);
      const matchCode = (item.customerCode ?? "").toLowerCase().includes(term);
      const matchRef = item.referenceNo.toLowerCase().includes(term);
      const matchDetail = item.detail.toLowerCase().includes(term);
      const matchCodeName = item.code.toLowerCase().includes(term);
      const matchTitle = codeMeta ? codeMeta.title.toLowerCase().includes(term) : false;

      return (
        matchCustomer ||
        matchCode ||
        matchRef ||
        matchDetail ||
        matchCodeName ||
        matchTitle
      );
    });
  }, [report.exceptions, searchTerm, severityFilter]);

  // AG-WORKFLOW: Reset flat pagination when search filter or severity changes
  React.useEffect(() => {
    setFlatPage(0);
  }, [searchTerm, severityFilter, flatPageSize]);

  // Group filtered exceptions by code
  const groups = React.useMemo(() => {
    const grouped = new Map<ExceptionCode, ReportException[]>();
    for (const item of filteredExceptions) {
      const bucket = grouped.get(item.code);
      if (bucket) bucket.push(item);
      else grouped.set(item.code, [item]);
    }

    // Sort by largest occurrence count first, then severity priority
    return [...grouped.entries()].sort(
      (a, b) =>
        b[1].length - a[1].length ||
        SEVERITY_ORDER[a[1][0].severity] - SEVERITY_ORDER[b[1][0].severity]
    );
  }, [filteredExceptions]);

  // Flat table pagination slices
  const flatPageCount = Math.max(Math.ceil(filteredExceptions.length / flatPageSize), 1);
  const safeFlatPage = Math.min(flatPage, flatPageCount - 1);
  const pagedFlatExceptions = filteredExceptions.slice(
    safeFlatPage * flatPageSize,
    safeFlatPage * flatPageSize + flatPageSize
  );
  const flatStartRecord =
    filteredExceptions.length === 0 ? 0 : safeFlatPage * flatPageSize + 1;
  const flatEndRecord = Math.min(
    (safeFlatPage + 1) * flatPageSize,
    filteredExceptions.length
  );

  return (
    <div className="space-y-4">
      {/* 1. Header Overview & Audit Metrics */}
      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          {/* Title & Description Banner */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Data Quality &amp; Audit Exceptions
                </h2>
                <p className="text-xs text-muted-foreground">
                  The calculation engine isolates records with data discrepancies,
                  missing rates, or unverified claims for audit review rather than
                  guessing values into totals.
                </p>
              </div>
            </div>

            <Badge
              variant="outline"
              className="w-fit self-start border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 sm:self-center"
            >
              Strict Audit Enforced
            </Badge>
          </div>

          {/* Quick Metrics KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border/70 bg-muted/20 p-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Total Exceptions
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {formatQty(totalFindings)}
                </span>
                <span className="text-[11px] text-muted-foreground">findings</span>
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/20 p-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Affected Codes
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {formatQty(groups.length)}
                </span>
                <span className="text-[11px] text-muted-foreground">categories</span>
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/20 p-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Involved Amount
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {totalInvolvedAmount > 0
                    ? formatAmount(totalInvolvedAmount)
                    : "₱0.00"}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/20 p-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Severity Breakdown
              </span>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                {criticalCount > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                    <span className="size-1.5 rounded-full bg-rose-600" />
                    {criticalCount} Critical
                  </span>
                ) : null}
                {warningCount > 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    {warningCount} Warning
                  </span>
                ) : null}
                {infoCount > 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-muted-foreground" />
                    {infoCount} Info
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Search Bar, Severity Filters & View Switcher */}
          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by customer, reference, code, or details..."
                className="h-8 pl-8 pr-8 text-xs"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                  <span className="sr-only">Clear search</span>
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-medium text-muted-foreground">
                  Severity:
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={severityFilter === "all" ? "default" : "outline"}
                  onClick={() => setSeverityFilter("all")}
                  className="h-7 px-2.5 text-xs"
                >
                  All ({totalFindings})
                </Button>
                {criticalCount > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={severityFilter === "critical" ? "destructive" : "outline"}
                    onClick={() => setSeverityFilter("critical")}
                    className="h-7 px-2.5 text-xs"
                  >
                    Critical ({criticalCount})
                  </Button>
                ) : null}
                {warningCount > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={severityFilter === "warning" ? "default" : "outline"}
                    onClick={() => setSeverityFilter("warning")}
                    className="h-7 px-2.5 text-xs"
                  >
                    Warning ({warningCount})
                  </Button>
                ) : null}
                {infoCount > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={severityFilter === "info" ? "default" : "outline"}
                    onClick={() => setSeverityFilter("info")}
                    className="h-7 px-2.5 text-xs"
                  >
                    Info ({infoCount})
                  </Button>
                ) : null}
              </div>

              {/* View Mode Switcher: Grouped Cards vs Flat Table */}
              <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grouped")}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "grouped"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grouped by exception type"
                >
                  <LayoutGrid className="size-3.5" />
                  Grouped
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("flat")}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "flat"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Unified paginated table view"
                >
                  <List className="size-3.5" />
                  Table
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Zero Search Results Fallback */}
      {filteredExceptions.length === 0 ? (
        <Card className="border border-dashed border-border p-8 text-center">
          <SearchX className="mx-auto size-8 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold text-foreground">
            No matching exceptions found
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            No findings match your search query &ldquo;{searchTerm}&rdquo; or the
            selected severity filter.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setSeverityFilter("all");
              }}
            >
              Reset Filters
            </Button>
          </div>
        </Card>
      ) : null}

      {/* 3A. View Mode: Grouped Findings Cards with Per-Group Pagination */}
      {viewMode === "grouped" && filteredExceptions.length > 0 ? (
        <div className="space-y-4">
          {groups.map(([code, items]) => (
            <ExceptionGroupCard
              key={code}
              code={code}
              items={items}
              meta={CODE_METADATA[code]}
              openCustomerDetail={openCustomerDetail}
            />
          ))}
        </div>
      ) : null}

      {/* 3B. View Mode: Unified Flat Table with Global Pagination */}
      {viewMode === "flat" && filteredExceptions.length > 0 ? (
        <Card className="overflow-hidden border border-border bg-card shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40 text-[11px]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[100px] text-[11px] font-semibold uppercase tracking-wider">
                      Severity
                    </TableHead>
                    <TableHead className="w-[200px] text-[11px] font-semibold uppercase tracking-wider">
                      Finding Code
                    </TableHead>
                    <TableHead className="w-[240px] text-[11px] font-semibold uppercase tracking-wider">
                      Customer
                    </TableHead>
                    <TableHead className="w-[140px] text-[11px] font-semibold uppercase tracking-wider">
                      Reference #
                    </TableHead>
                    <TableHead className="w-[90px] text-[11px] font-semibold uppercase tracking-wider">
                      Type
                    </TableHead>
                    <TableHead className="w-[120px] text-right text-[11px] font-semibold uppercase tracking-wider">
                      Involved ₱
                    </TableHead>
                    <TableHead className="min-w-[280px] text-[11px] font-semibold uppercase tracking-wider">
                      Audit Finding / Observation
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedFlatExceptions.map((item, idx) => {
                    const meta = CODE_METADATA[item.code];
                    return (
                      <TableRow
                        key={`${item.referenceNo}-${safeFlatPage * flatPageSize + idx}`}
                        className="hover:bg-muted/30"
                      >
                        {/* Severity */}
                        <TableCell className="align-top">
                          <SeverityBadge severity={item.severity} />
                        </TableCell>

                        {/* Finding Code */}
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-xs text-foreground">
                              {meta?.title ?? item.code}
                            </span>
                            <code className="font-mono text-[10px] text-muted-foreground">
                              {item.code}
                            </code>
                          </div>
                        </TableCell>

                        {/* Customer Column */}
                        <TableCell className="align-top">
                          {item.customerCode ? (
                            <button
                              type="button"
                              onClick={() =>
                                void openCustomerDetail({
                                  customerCode: item.customerCode!,
                                  customerName: item.customerName,
                                })
                              }
                              className="group flex flex-col text-left font-medium text-foreground hover:text-primary"
                              title="Click to view customer incentive history and supporting documents"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="group-hover:underline">
                                  {item.customerName}
                                </span>
                                <ExternalLink className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                              </div>
                              <span className="text-[11px] font-normal text-muted-foreground">
                                {item.customerCode}
                              </span>
                            </button>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {item.customerName || "Unmatched Customer"}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                No customer code
                              </span>
                            </div>
                          )}
                        </TableCell>

                        {/* Reference Number */}
                        <TableCell className="align-top font-mono text-xs">
                          <span className="inline-block rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">
                            {item.referenceNo}
                          </span>
                        </TableCell>

                        {/* Document Type Badge */}
                        <TableCell className="align-top">
                          <ReferenceTypeBadge type={item.referenceType} />
                        </TableCell>

                        {/* Involved Financial Amount */}
                        <TableCell className="align-top text-right tabular-nums">
                          {item.amount != null && item.amount !== 0 ? (
                            <span className="font-semibold text-rose-600 dark:text-rose-400">
                              {formatAmount(item.amount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Detail Observation */}
                        <TableCell className="align-top text-xs leading-relaxed text-muted-foreground">
                          {item.detail}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* AG-WORKFLOW: Flat Table Global Pagination Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-muted/10 px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Showing {flatStartRecord}–{flatEndRecord} of{" "}
                {filteredExceptions.length} findings
                {flatPageCount > 1
                  ? ` · Page ${safeFlatPage + 1} of ${flatPageCount}`
                  : ""}
              </span>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rows per page</span>
                  <Select
                    value={String(flatPageSize)}
                    onValueChange={(next) => {
                      setFlatPageSize(Number(next));
                      setFlatPage(0);
                    }}
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

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFlatPage((current) => Math.max(current - 1, 0))
                    }
                    disabled={safeFlatPage === 0}
                    className="gap-1 h-8 px-2.5 text-xs"
                  >
                    <ChevronLeft aria-hidden="true" className="size-3.5" />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFlatPage((current) =>
                        Math.min(current + 1, flatPageCount - 1)
                      )
                    }
                    disabled={safeFlatPage >= flatPageCount - 1}
                    className="gap-1 h-8 px-2.5 text-xs"
                  >
                    Next
                    <ChevronRight aria-hidden="true" className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
