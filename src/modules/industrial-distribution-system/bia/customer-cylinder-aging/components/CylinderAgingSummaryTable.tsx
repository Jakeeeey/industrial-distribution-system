// components/CylinderAgingSummaryTable.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Aggregated data table for Customer Cylinder Aging summaries.
// Features:
//  - Drilling down on click (calls selectCustomer)
//  - Client-side debounced search (customer name, code, store)
//  - Client-side sorting on key columns
//  - Client-side pagination (10 / 25 / 50 rows)
//  - Skeleton rows while loading
//  - PDF export of aggregated customer list
//  - Color-coded aging status mix indicator
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  Search,
  FileDown,
  Loader2,
  Building,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";
import type { CustomerCylinderAgingSummary } from "../types/customer-cylinder-aging.types";
import {
  resolveActivityStatusVariant,
  formatDaysWithCustomer,
  formatRecommendedAction,
  formatActivityStatus,
  formatDate,
  resolveCustomerSegment,
} from "../services";
import type { CustomerSegment } from "../services/customer-cylinder-aging.helpers";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Sort state ────────────────────────────────────────────────────────────────
type SortKey =
  | "customerCode"
  | "customerName"
  | "branchName"
  | "totalCylinders"
  | "averageDaysWithCustomer"
  | "maxDaysWithCustomer"
  | "lastTransactionDate"
  | "daysSinceLastTransaction"
  | "customerActivityStatus"
  | "recommendedAction";

type SortDir = "asc" | "desc";

function sortSummaries(
  rows: CustomerCylinderAgingSummary[],
  key: SortKey,
  dir: SortDir
): CustomerCylinderAgingSummary[] {
  return [...rows].sort((a, b) => {
    const av = a[key] ?? "";
    const bv = b[key] ?? "";
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  // Spaced cell padding and 12 columns matching the customer summary table
  return (
    <TableRow className="border-b border-border/40">
      {Array.from({ length: 10 }).map((_, i) => (
        <TableCell key={i} className="py-4 px-4">
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}



// ── PDF Export ────────────────────────────────────────────────────────────────
async function exportToPdf(rows: CustomerCylinderAgingSummary[]): Promise<void> {
  if (rows.length === 0) {
    toast.error("No data to export.");
    return;
  }

  let companyName = "VOS GAS";
  let companyLogo = "";
  let companyTin = "";
  let companyContact = "";
  let companyEmail = "";
  let companyAddress = "";

  try {
    const res = await fetch("/api/pdf/company");
    if (res.ok) {
      const json = await res.json();
      const companyData = json.data?.[0] || json.data;
      if (companyData) {
        companyName = companyData.company_name || companyName;
        companyLogo = companyData.company_logo || "";
        companyTin = companyData.company_tin || "";
        companyContact = companyData.company_contact || "";
        companyEmail = companyData.company_email || "";
        companyAddress = [
          companyData.company_address,
          companyData.company_brgy,
          companyData.company_city,
          companyData.company_province,
          companyData.company_zipCode,
        ].filter(Boolean).join(", ");
      }
    }
  } catch (err) {
    console.error("Failed to fetch company details for PDF:", err);
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 14;

  if (companyLogo) {
    try {
      doc.addImage(companyLogo, "PNG", margin, y, 28, 16, undefined, "FAST");
    } catch (e) {
      console.error("Error adding logo to PDF:", e);
    }
  }

  const headerTextX = companyLogo ? margin + 32 : margin;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(companyName.toUpperCase(), headerTextX, y + 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `TIN: ${companyTin || "—"}  |  Contact: ${companyContact || "—"}  |  Email: ${companyEmail || "—"}`,
    headerTextX,
    y + 10
  );
  if (companyAddress) {
    doc.text(companyAddress, headerTextX, y + 14);
  }

  y += 20;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);

  y += 6;

  // Title
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Customer Cylinder Aging Summary Report", margin, y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `Generated: ${new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })} · Total Customers: ${rows.length}`,
    margin,
    y + 5
  );

  y += 10;

  autoTable(doc, {
    startY: y,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 30, 40], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    head: [
      [
        "Customer Code",
        "Customer Name",
        "Store Name",
        "Branch",
        "Products",
        "Total Cylinders",
        "Active",
        "Warning",
        "Critical",
        "Avg Days",
        "Max Days",
        "Last Transaction Date",
        "Days Idle",
        "Activity Status",
        "Action Plan",
      ],
    ],
    body: rows.map((r) => [
      r.customerCode,
      r.customerName ?? "—",
      r.storeName ?? "—",
      r.branchName ?? "—",
      (r.productsDeployed || []).join(", ") || "—",
      r.totalCylinders,
      r.activeCylinders,
      r.warningCylinders,
      r.criticalCylinders,
      formatDaysWithCustomer(r.averageDaysWithCustomer),
      formatDaysWithCustomer(r.maxDaysWithCustomer),
      formatDate(r.lastTransactionDate),
      r.daysSinceLastTransaction !== null ? String(r.daysSinceLastTransaction) : "—",
      formatActivityStatus(r.customerActivityStatus),
      formatRecommendedAction(r.recommendedAction),
    ]),
  });

  doc.save(
    `customer-cylinder-aging-summary-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CylinderAgingSummaryTable() {
  const {
    summaries,
    isLoading,
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    selectCustomer,
  } = useCustomerCylinderAging();

  // Debounced search term (300ms)
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Sort state (defaults to totalCylinders DESC)
  const [sortKey, setSortKey] = React.useState<SortKey>("totalCylinders");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  // Segment Filter state
  const [segmentFilter, setSegmentFilter] = React.useState<"ALL" | CustomerSegment>("ALL");



  // Filter → Sort → Paginate pipeline
  const filtered = React.useMemo(() => {
    let result = summaries;

    if (segmentFilter !== "ALL") {
      result = result.filter((r) => {
        const seg = resolveCustomerSegment(r.customerName, r.storeName);
        return seg.segment === segmentFilter;
      });
    }

    if (!debouncedSearch) return result;
    const tokens = debouncedSearch.split(/\s+/).filter(Boolean);
    return result.filter((r) => {
      const hay = [
        r.customerCode,
        r.customerName,
        r.storeName,
        r.customerAddress,
        r.branchName,
        r.branchCode,
      ]
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [summaries, debouncedSearch, segmentFilter]);

  const sorted = React.useMemo(
    () => sortSummaries(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const [exporting, setExporting] = React.useState(false);

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setExporting(true);
    try {
      await exportToPdf(sorted);
      toast.success("Summary PDF exported successfully.");
    } catch (err) {
      console.error(err);
      toast.error("PDF export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    // Revamped container: rounded-xl with subtle border/shadow for high-end aesthetic
    <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-3 border-b border-border/50 sm:flex-row sm:items-center sm:justify-between bg-muted/10">
        {/* Search & Segment Filter */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:max-w-xl">
          <div className="relative w-full sm:max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              id="cca-summary-search"
              placeholder="Search customer…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 h-8 text-xs rounded-lg w-full"
            />
          </div>

          <Select
            value={segmentFilter}
            onValueChange={(v: "ALL" | CustomerSegment) => {
              setSegmentFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-xs rounded-lg w-full sm:w-[140px] font-medium bg-background whitespace-nowrap overflow-hidden text-ellipsis flex items-center justify-between">
              <SelectValue placeholder="All Segments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs font-medium">All Segments</SelectItem>
              <SelectItem value="COMMERCIAL" className="text-xs font-medium">Commercial</SelectItem>
              <SelectItem value="RETAIL" className="text-xs font-medium">Retail</SelectItem>
              <SelectItem value="RESIDENTIAL" className="text-xs font-medium">Residential</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortKey}
            onValueChange={(v: SortKey) => {
              setSortKey(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-xs rounded-lg w-full sm:w-[145px] font-medium bg-background whitespace-nowrap overflow-hidden text-ellipsis flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 truncate">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Sort Column" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="totalCylinders" className="text-xs font-medium">Total Cyls</SelectItem>
              <SelectItem value="averageDaysWithCustomer" className="text-xs font-medium">Avg Days</SelectItem>
              <SelectItem value="maxDaysWithCustomer" className="text-xs font-medium">Max Days</SelectItem>
              <SelectItem value="lastTransactionDate" className="text-xs font-medium">Last Transaction</SelectItem>
              <SelectItem value="daysSinceLastTransaction" className="text-xs font-medium">Days Idle</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg hover:bg-muted bg-background border border-input flex items-center justify-center"
            onClick={() => {
              setSortDir((d) => (d === "asc" ? "desc" : "asc"));
              setPage(1);
            }}
            title={sortDir === "asc" ? "Sorted Ascending (Click to sort Descending)" : "Sorted Descending (Click to sort Ascending)"}
          >
            {sortDir === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground font-medium">
            {filtered.length.toLocaleString()} customer{filtered.length !== 1 ? "s" : ""}
          </span>

          <Button
            id="cca-summary-export-pdf"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || isLoading || sorted.length === 0}
            className="h-8 gap-1.5 transition-all hover:bg-muted font-semibold rounded-lg text-xs"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Export Summary PDF</span>
            <span className="sm:hidden">Export PDF</span>
          </Button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/10 border-b border-border/40">
            <TableRow className="hover:bg-transparent border-b border-border/40">
              {/* # - always visible */}
              <TableHead className="w-8 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 py-2 px-1">#</TableHead>
              {/* Customer Code - always visible */}
              <TableHead className="py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Cust. Code</TableHead>
              {/* Customer / Store - always visible */}
              <TableHead className="py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Customer / Store</TableHead>
              {/* Branch - hidden on small screens */}
              <TableHead className="hidden md:table-cell py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Branch</TableHead>
              {/* Total Cylinders - always visible */}
              <TableHead className="text-center py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Total Cyls</TableHead>
              {/* Avg Days - always visible */}
              <TableHead className="text-center py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Avg Days</TableHead>
              {/* Max Days - always visible */}
              <TableHead className="text-center py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Max Days</TableHead>
              {/* Last Transaction Date - hidden on small screens */}
              <TableHead className="hidden md:table-cell py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Last Transaction</TableHead>
              {/* Days Idle - hidden on small screens */}
              <TableHead className="hidden md:table-cell text-center py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Days Idle</TableHead>
              {/* Activity - always visible */}
              <TableHead className="py-2 px-1.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground/80">Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-20 text-center text-xs text-muted-foreground py-4 px-4">
                  {summaries.length === 0
                    ? "No customer summaries loaded. Click apply filters to load."
                    : "No customers match your search."}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, idx) => {
                const rowNum = (page - 1) * pageSize + idx + 1;
                return (
                  <TableRow
                    key={row.customerCode}
                    // Base text for laptop density
                    className="hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/40 group text-[11px]"
                    onClick={() => selectCustomer(row.customerCode)}
                  >
                    {/* # */}
                    <TableCell className="py-1.5 px-1 text-center text-muted-foreground font-mono">{rowNum}</TableCell>
                    {/* Customer Code */}
                    <TableCell className="py-1.5 px-1.5 font-mono font-semibold whitespace-nowrap text-primary group-hover:underline">
                      {row.customerCode}
                    </TableCell>
                    {/* Customer / Store */}
                    <TableCell className="py-1.5 px-1.5 max-w-[180px]">
                      {(() => {
                        const segmentInfo = resolveCustomerSegment(row.customerName, row.storeName);
                        return (
                          <>
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="font-semibold text-foreground truncate text-[12px] flex items-center gap-1 cursor-default">
                                    <Building className="h-3.5 w-3.5 text-muted-foreground/75 shrink-0" />
                                    <span className="truncate">{row.customerName || "—"}</span>
                                  </div>
                                </TooltipTrigger>
                                {row.customerName && (
                                  <TooltipContent side="top">{row.customerName}</TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                            <div className="flex items-center gap-2 mt-0.5 ml-5">
                              <Badge variant="outline" className={`text-[8px] uppercase font-bold py-0 px-1 shrink-0 ${segmentInfo.badgeColor}`}>
                                {segmentInfo.label}
                              </Badge>
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-muted-foreground text-[9px] truncate max-w-[100px] cursor-default">
                                      {row.storeName || "—"}
                                    </span>
                                  </TooltipTrigger>
                                  {row.storeName && (
                                    <TooltipContent side="bottom">{row.storeName}</TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </>
                        );
                      })()}
                    </TableCell>
                    {/* Branch - hidden on small screens */}
                    <TableCell className="hidden md:table-cell py-1.5 px-1.5 max-w-[140px]">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-xs font-semibold text-foreground truncate cursor-default">
                              {row.branchName || "—"}
                            </div>
                          </TooltipTrigger>
                          {row.branchName && (
                            <TooltipContent side="top">{row.branchName}</TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                      {row.branchCode && (
                        <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">{row.branchCode}</div>
                      )}
                    </TableCell>

                    {/* Total Cylinders */}
                    <TableCell className="py-1.5 px-1.5 text-center font-bold text-xs text-foreground">
                      {row.totalCylinders}
                    </TableCell>
                    {/* Avg Days */}
                    <TableCell className="py-1.5 px-1.5 text-center font-mono font-semibold text-xs text-foreground">
                      {formatDaysWithCustomer(row.averageDaysWithCustomer)}
                    </TableCell>
                    {/* Max Days */}
                    <TableCell className="py-1.5 px-1.5 text-center font-mono font-semibold text-xs text-foreground">
                      {formatDaysWithCustomer(row.maxDaysWithCustomer)}
                    </TableCell>
                    {/* Last Transaction Date - hidden on small screens */}
                    <TableCell className="hidden md:table-cell py-1.5 px-1.5 whitespace-nowrap font-medium text-xs text-muted-foreground">
                      {formatDate(row.lastTransactionDate)}
                    </TableCell>
                    {/* Days Idle - hidden on small screens */}
                    <TableCell className="hidden md:table-cell py-1.5 px-1.5 text-center font-mono font-bold text-xs text-foreground">
                      {row.daysSinceLastTransaction !== null ? row.daysSinceLastTransaction : "—"}
                    </TableCell>
                    {/* Activity */}
                    <TableCell className="py-1.5 px-1.5">
                      <Badge variant={resolveActivityStatusVariant(row.customerActivityStatus)} className="text-[9px] py-0 px-1.5 whitespace-nowrap font-semibold">
                        {formatActivityStatus(row.customerActivityStatus)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-5 py-3 border-t border-border/50 sm:flex-row sm:items-center sm:justify-between bg-muted/5">
        <div className="text-xs text-muted-foreground font-medium">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {sorted.length === 0 ? 0 : (page - 1) * pageSize + 1}
            {" – "}
            {Math.min(sorted.length, page * pageSize)}
          </span>{" "}
          of {sorted.length.toLocaleString()} customer records
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">Rows:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger id="cca-summary-page-size" className="w-16 h-8 text-xs font-semibold rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              id="cca-summary-prev-btn"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              disabled={page <= 1}
              onClick={(e) => {
                e.stopPropagation();
                setPage((p) => Math.max(1, p - 1));
              }}
            >
              ‹
            </Button>
            <span className="text-xs font-mono font-bold px-2 min-w-16 text-center">
              {page} / {totalPages}
            </span>
            <Button
              id="cca-summary-next-btn"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              disabled={page >= totalPages}
              onClick={(e) => {
                e.stopPropagation();
                setPage((p) => Math.min(totalPages, p + 1));
              }}
            >
              ›
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
