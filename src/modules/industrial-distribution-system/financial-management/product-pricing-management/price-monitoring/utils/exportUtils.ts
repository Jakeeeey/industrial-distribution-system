// =============================================================================
// Price Monitoring — Export Utilities
// Layer  : utils (pure — no React, no side-effects beyond browser download)
// =============================================================================

import * as XLSX from "xlsx";
import type { ViewPriceMonitoringRow } from "../types";
import { mapPriceTypeName } from "../../product-pricing/utils/constants";

// ---------------------------------------------------------------------------
// CSV column definition
// ---------------------------------------------------------------------------

interface CsvColumn {
  header: string;
  getValue: (row: ViewPriceMonitoringRow) => string | number | null | undefined;
}

/** Ordered column list matching spec */
const CSV_COLUMNS: CsvColumn[] = [
  { header: "Request ID",         getValue: (r) => r.requestId },
  { header: "Header ID",          getValue: (r) => r.headerId },
  { header: "Reference No",       getValue: (r) => r.referenceNo },
  { header: "Header Remarks",     getValue: (r) => r.headerRemarks },
  { header: "Header Status",      getValue: (r) => r.headerStatus },
  { header: "Supplier ID",        getValue: (r) => r.supplierId },
  { header: "Supplier Name",      getValue: (r) => r.supplierName },
  { header: "Supplier Shortcut",  getValue: (r) => r.supplierShortcut },
  { header: "Supplier Type",      getValue: (r) => r.supplierType },
  { header: "Product ID",         getValue: (r) => r.productId },
  { header: "Product Code",       getValue: (r) => r.productCode },
  { header: "Product Name",       getValue: (r) => r.productName },
  { header: "Price Type ID",      getValue: (r) => r.priceTypeId },
  { header: "Price Type Name",    getValue: (r) => mapPriceTypeName(r.priceTypeName) },
  { header: "Price Type Sort",    getValue: (r) => r.priceTypeSort },
  { header: "Request Status",     getValue: (r) => r.requestStatus },
  { header: "Old Price",          getValue: (r) => r.oldPrice },
  { header: "New Price",          getValue: (r) => r.newPrice },
  { header: "Price Difference",   getValue: (r) => r.priceDifference },
  { header: "Price Movement",     getValue: (r) => r.priceMovement },
  { header: "Price Change %",     getValue: (r) => r.priceChangePercentage },
  { header: "Current Live Price", getValue: (r) => r.currentLivePrice },
  { header: "Current Price Status", getValue: (r) => r.currentPriceStatus },
  { header: "Requested At",       getValue: (r) => r.requestedAt },
  { header: "Approved At",        getValue: (r) => r.approvedAt },
  { header: "Price Change Datetime", getValue: (r) => r.priceChangeDatetime },
  { header: "Rejected At",        getValue: (r) => r.rejectedAt },
  { header: "Reject Reason",      getValue: (r) => r.rejectReason },
  { header: "Supplier-Product Mapping ID", getValue: (r) => r.productSupplierMappingId },
  { header: "Supplier Product Validation", getValue: (r) => r.supplierProductValidation },
  { header: "Requested By ID",    getValue: (r) => r.requestedBy },
  { header: "Requested By",       getValue: (r) => r.requestedByName },
  { header: "Approved By ID",     getValue: (r) => r.approvedBy },
  { header: "Approved By",        getValue: (r) => r.approvedByName },
  { header: "Rejected By ID",     getValue: (r) => r.rejectedBy },
  { header: "Rejected By",        getValue: (r) => r.rejectedByName },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---------------------------------------------------------------------------
// Export functions
// ---------------------------------------------------------------------------

/** Converts the given rows to a CSV string and triggers a browser download. */
export function exportToCSV(
  rows: ViewPriceMonitoringRow[],
  filename = "price-monitoring-export",
): void {
  if (rows.length === 0) return;

  const header = CSV_COLUMNS.map((col) => escapeCsv(col.header)).join(",");
  const dataRows = rows.map((row) =>
    CSV_COLUMNS.map((col) => escapeCsv(col.getValue(row))).join(","),
  );

  const csvContent = [header, ...dataRows].join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Exports price monitoring history directly to a styled Excel worksheet (.xlsx). */
export function exportToExcel(
  rows: ViewPriceMonitoringRow[],
  filename = "price-monitoring-export",
  query?: { productLabel?: string | null; supplierLabel?: string | null },
): void {
  if (rows.length === 0) return;

  const generatedBy = "System";
  const generatedDate = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rowsAoA: Array<Array<unknown>> = [];
  rowsAoA.push(["Generated By:", generatedBy]);
  rowsAoA.push(["Generated Date:", generatedDate]);

  if (query) {
    rowsAoA.push(["Filters:"]);
    if (query.productLabel) rowsAoA.push([`Product = ${query.productLabel}`]);
    if (query.supplierLabel) rowsAoA.push([`Supplier = ${query.supplierLabel}`]);
    rowsAoA.push([]); // blank spacer
  }

  // Header row
  const headers = [
    "Date",
    "Supplier Shortcut",
    "Supplier Name",
    "Price Type",
    "Old Price",
    "New Price",
    "Difference",
    "Movement",
    "% Change",
    "Requested By",
    "Approved By",
    "Validation"
  ];
  rowsAoA.push(headers);

  // Data rows
  for (const r of rows) {
    const dt = r.priceChangeDatetime ?? r.approvedAt;
    const formattedDate = dt
      ? new Date(dt).toLocaleString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    rowsAoA.push([
      formattedDate,
      r.supplierShortcut ?? (r.supplierId !== null && r.supplierId !== undefined && String(r.supplierId) !== "null" && String(r.supplierId) !== "" ? `Supplier #${r.supplierId}` : "Unspecified Supplier"),
      r.supplierName ?? "Unmapped Supplier",
      mapPriceTypeName(r.priceTypeName) || "—",
      r.oldPrice !== null ? r.oldPrice : "—",
      r.newPrice !== null ? r.newPrice : "—",
      r.priceDifference !== null ? r.priceDifference : "—",
      r.priceMovement ?? "—",
      r.priceChangePercentage !== null
        ? `${r.priceChangePercentage > 0 ? "+" : ""}${r.priceChangePercentage.toFixed(2)}%`
        : "—",
      r.requestedByName ?? "—",
      r.approvedByName ?? "—",
      r.supplierProductValidation === "SUPPLIER NOT MAPPED TO PRODUCT"
        ? "Supplier Not Mapped"
        : "Valid",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rowsAoA);
  const sheet = ws as unknown as Record<string, unknown>;

  // Set column widths
  sheet["!cols"] = [
    { wch: 22 }, // Date
    { wch: 18 }, // Supplier Shortcut
    { wch: 30 }, // Supplier Name
    { wch: 14 }, // Price Type
    { wch: 12 }, // Old Price
    { wch: 12 }, // New Price
    { wch: 12 }, // Difference
    { wch: 14 }, // Movement
    { wch: 12 }, // % Change
    { wch: 20 }, // Requested By
    { wch: 20 }, // Approved By
    { wch: 20 }, // Validation
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Price History");

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Generates a timestamped filename for the export. */
export function buildExportFilename(
  productCode: string | null | undefined,
  year?: number | null,
): string {
  const parts = ["price-monitoring"];
  if (productCode) parts.push(productCode.replace(/[^a-zA-Z0-9-]/g, ""));
  if (year) parts.push(String(year));
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  parts.push(today);
  return parts.join("-");
}
