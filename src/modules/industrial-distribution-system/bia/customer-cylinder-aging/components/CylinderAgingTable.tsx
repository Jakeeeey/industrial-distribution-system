// components/CylinderAgingTable.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Main data table for Customer Cylinder Aging.
// Features:
//  - Client-side debounced search (serial / customer / product)
//  - Client-side sorting on key columns
//  - Client-side pagination (10 / 25 / 50 rows)
//  - Skeleton rows while loading
//  - PDF export via jspdf
//  - Color-coded aging badges
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  FileDown,
  Loader2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import { useCustomerCylinderAging } from "../providers/CustomerCylinderAgingProvider";
import type { CustomerCylinderAgingRecord } from "../types/customer-cylinder-aging.types";
import {
  resolveAgingTextClass,
  resolveActivityStatusVariant,
  resolveActionVariant,
  formatDaysWithCustomer,
  formatRecommendedAction,
  formatActivityStatus,
  formatAgingBasisSource,
  formatDate,
} from "../services";

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

// ── Sort state ────────────────────────────────────────────────────────────────
type SortKey =
  | "serialNumber"
  | "productCode"
  | "customerName"
  | "branchName"
  | "daysWithCustomer"
  | "customerActivityStatus"
  | "recommendedAction"
  | "acquisitionDate";

type SortDir = "asc" | "desc";

function sortRecords(
  rows: CustomerCylinderAgingRecord[],
  key: SortKey,
  dir: SortDir
): CustomerCylinderAgingRecord[] {
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
  return (
    <TableRow>
      {Array.from({ length: 9 }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ── Sort header button ────────────────────────────────────────────────────────
function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  return (
    <button
      className="flex items-center gap-1 font-semibold text-xs uppercase tracking-wider text-foreground hover:text-primary transition-colors whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}

// ── PDF Export ────────────────────────────────────────────────────────────────
/**
 * Generates a PDF report of the currently filtered records using jsPDF + autoTable.
 */
async function exportToPdf(rows: CustomerCylinderAgingRecord[]): Promise<void> {
  if (rows.length === 0) {
    toast.error("No data to export.");
    return;
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Customer Cylinder Aging Report", 14, 16);

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
    })} · Total Records: ${rows.length}`,
    14,
    22
  );
  doc.setTextColor(0);

  // Table
  autoTable(doc, {
    startY: 27,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 40], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    head: [
      [
        "Serial No.",
        "Product Code",
        "Product Name",
        "Customer",
        "Store",
        "Branch",
        "Days w/ Cust.",
        "Aging Basis",
        "Last Transaction",
        "Activity Status",
        "Recommended Action",
        "Acquisition Date",
        "Expiration Date",
      ],
    ],
    body: rows.map((r) => [
      r.serialNumber,
      r.productCode,
      r.productName,
      r.customerName,
      r.storeName,
      r.branchName,
      formatDaysWithCustomer(r.daysWithCustomer),
      formatAgingBasisSource(r.agingBasisSource),
      formatDate(r.lastTransactionDate),
      formatActivityStatus(r.customerActivityStatus),
      formatRecommendedAction(r.recommendedAction),
      formatDate(r.acquisitionDate),
      formatDate(r.expirationDate),
    ]),
  });

  doc.save(
    `customer-cylinder-aging-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CylinderAgingTable() {
  const { records, isLoading, search, setSearch, page, setPage, pageSize, setPageSize } =
    useCustomerCylinderAging();

  // Debounced search term (300ms)
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Sort state
  const [sortKey, setSortKey] = React.useState<SortKey>("daysWithCustomer");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  // ── Filter → Sort → Paginate pipeline ────────────────────────────────────
  const filtered = React.useMemo(() => {
    if (!debouncedSearch) return records;
    const tokens = debouncedSearch.split(/\s+/).filter(Boolean);
    return records.filter((r) => {
      const hay = [
        r.serialNumber,
        r.productCode,
        r.productName,
        r.customerCode,
        r.customerName,
        r.storeName,
        r.branchName,
      ]
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [records, debouncedSearch]);

  const sorted = React.useMemo(
    () => sortRecords(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToPdf(sorted);
      toast.success("PDF exported successfully.");
    } catch (err) {
      console.error(err);
      toast.error("PDF export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            id="cca-table-search"
            placeholder="Search serial, product, customer…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Record count badge */}
          <span className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString()} record{filtered.length !== 1 ? "s" : ""}
          </span>

          {/* PDF Export */}
          <Button
            id="cca-export-pdf-btn"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || isLoading || sorted.length === 0}
            className="h-9 gap-1.5"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40 border-b border-border">
            <TableRow>
              <TableHead className="w-12 text-center text-xs font-semibold text-muted-foreground">#</TableHead>
              <TableHead>
                <SortHeader label="Serial No." sortKey="serialNumber" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortHeader label="Product" sortKey="productCode" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortHeader label="Customer" sortKey="customerName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortHeader label="Branch" sortKey="branchName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortHeader label="Days w/ Customer" sortKey="daysWithCustomer" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground whitespace-nowrap">Aging Basis</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground whitespace-nowrap">Last Transaction</TableHead>
              <TableHead>
                <SortHeader label="Activity" sortKey="customerActivityStatus" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortHeader label="Action" sortKey="recommendedAction" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortHeader label="Acquisition" sortKey="acquisitionDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-foreground whitespace-nowrap">Expiration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-32 text-center text-sm text-muted-foreground">
                  {records.length === 0
                    ? "No records loaded. Apply filters to fetch data."
                    : "No records match your search."}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, idx) => {
                const rowNum = (page - 1) * pageSize + idx + 1;
                return (
                  <TableRow
                    key={row.cylinderAssetId}
                    className="text-xs hover:bg-muted/30 border-border"
                  >
                    <TableCell className="text-center text-muted-foreground font-mono">{rowNum}</TableCell>
                    <TableCell className="font-mono font-semibold whitespace-nowrap">{row.serialNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium whitespace-nowrap">{row.productCode}</div>
                      <div className="text-muted-foreground text-[10px] max-w-40 truncate">{row.productName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium whitespace-nowrap">{row.customerName}</div>
                      <div className="text-muted-foreground text-[10px] max-w-40 truncate">{row.storeName}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div>{row.branchName}</div>
                      <div className="text-muted-foreground text-[10px]">{row.branchCode}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono font-semibold ${resolveAgingTextClass(row.daysWithCustomer)}`}>
                        {formatDaysWithCustomer(row.daysWithCustomer)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatAgingBasisSource(row.agingBasisSource)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(row.lastTransactionDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={resolveActivityStatusVariant(row.customerActivityStatus)} className="text-[10px] whitespace-nowrap">
                        {formatActivityStatus(row.customerActivityStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={resolveActionVariant(row.recommendedAction)} className="text-[10px] whitespace-nowrap">
                        {formatRecommendedAction(row.recommendedAction)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(row.acquisitionDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(row.expirationDate)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-4 py-3 border-t border-border sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">
            {sorted.length === 0 ? 0 : (page - 1) * pageSize + 1}
            {" – "}
            {Math.min(sorted.length, page * pageSize)}
          </span>{" "}
          of {sorted.length.toLocaleString()} records
        </div>

        <div className="flex items-center gap-4">
          {/* Rows per page */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Rows:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
            >
              <SelectTrigger id="cca-page-size-select" className="w-16 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page nav */}
          <div className="flex items-center gap-1">
            <Button
              id="cca-prev-page-btn"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </Button>
            <span className="text-xs font-mono px-2 min-w-16 text-center">
              {page} / {totalPages}
            </span>
            <Button
              id="cca-next-page-btn"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
