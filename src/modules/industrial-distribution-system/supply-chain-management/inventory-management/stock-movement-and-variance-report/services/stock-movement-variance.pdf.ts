// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/services/stock-movement-variance.pdf.ts
// ==============================================================================
// PDF Export Generator for Stock Movement and Variance Report.
// Audit-oriented landscape document: title block, scope and rule statement,
// KPI band and reconciled lines.
// ==============================================================================

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPhDateTime, formatVariancePercent } from "./stock-movement-variance.calc";
import type { StockMovementVarianceReportResponse } from "../types/stock-movement-variance.types";

/** Renders a base-unit figure, keeping uncounted lines explicit. */
function qty(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString();
}

/** Signed rendering for variance so shortages read as shortages. */
function signed(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : "-"}${Math.abs(rounded).toLocaleString()}`;
}

/**
 * Generates and triggers download of a standardized audit-ready PDF report.
 */
export function exportStockMovementVarianceToPdf(
  report: StockMovementVarianceReportResponse,
  filenamePrefix: string = "Stock_Movement_and_Variance_Report"
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Header Branding ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("VERTEX TECHNOLOGICS CORPORATION - INDUSTRIAL DISTRIBUTION SYSTEM", 32, 36);

  doc.setFontSize(13);
  doc.text("Stock Movement and Variance Report", 32, 55);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Branch scope: ${
      report.branchName ?? `All branches (${report.branchesReconciled} reconciled)`
    }`,
    32,
    70
  );
  doc.text(
    `Period: ${report.filters.startDate} to ${report.filters.endDate} (reporting cutoff)`,
    32,
    82
  );
  doc.text(`Generated: ${report.generatedAt}`, 32, 94);

  doc.text(
    "Rule: Expected = opening + in - out   |   Variance = counted - expected   |   All figures in base units",
    32,
    108
  );
  doc.text(
    "Read-only assessment: this report posts no inventory, raises no charge and releases no payment.",
    32,
    120
  );

  // ── KPI Band ────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 132,
    head: [["Key indicator", "Value"]],
    body: [
      ["Reconciled product lines", String(report.kpis.totalLines)],
      ["Lines with a non-zero variance", String(report.kpis.linesWithVariance)],
      ["Lines counted inside this period", String(report.kpis.linesCounted)],
      ["Lines with no count inside this period", String(report.kpis.linesUncounted)],
      ["Net variance (base units)", signed(report.kpis.netVarianceUnits)],
      ["Total shortage (base units)", signed(report.kpis.shortUnits)],
      ["Total overage (base units)", signed(report.kpis.overUnits)],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 108] },
    // "Key indicator" stays flexible: with both columns pinned, autoTable has
    // nothing to stretch and reports the leftover page width it could not place.
    columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 110, halign: "right" } },
  });

  // ── Reconciled Lines ────────────────────────────────────────────────────────
  // The quantity and reference columns are pinned so no long product name can push
  // the figures apart, while Product takes "auto" and absorbs whatever page width
  // is left. Pin every column and autoTable reports the leftover as width it could
  // not place, even though nothing was ever clipped.
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14,
    margin: { left: 24, right: 24 },
    head: [
      [
        "Product",
        "Branch",
        "Opening",
        "In",
        "Out",
        "Expected",
        "Counted",
        "Variance",
        "Var %",
        "Count Doc",
        "Cutoff",
      ],
    ],
    body: report.rows.map((row) => [
      row.productCode ? `${row.productCode} ${row.productName}` : row.productName,
      row.branchName || `#${row.branchId}`,
      qty(row.openingBalance),
      qty(row.periodIn),
      qty(row.periodOut),
      qty(row.expectedClosing),
      qty(row.countedClosing),
      signed(row.variance),
      formatVariancePercent(row),
      // An asterisk, not a second column: a count sheet from before the period is
      // printed for reference, and the reader must not take it as the measurement.
      row.countDocNo ? (row.countInPeriod ? row.countDocNo : `${row.countDocNo} *`) : "—",
      row.countCutoffDate ? formatPhDateTime(row.countCutoffDate) : "—",
    ]),
    theme: "striped",
    styles: { fontSize: 7, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 108] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 110 },
      2: { cellWidth: 46, halign: "right" },
      3: { cellWidth: 40, halign: "right" },
      4: { cellWidth: 40, halign: "right" },
      5: { cellWidth: 50, halign: "right" },
      6: { cellWidth: 46, halign: "right" },
      7: { cellWidth: 50, halign: "right" },
      8: { cellWidth: 48, halign: "right" },
      9: { cellWidth: 76 },
      10: { cellWidth: 72 },
    },
  });

  // ── Source notes footer ─────────────────────────────────────────────────────
  // The note used to be cut at a character count read off the page width, which let a
  // long warning run past the right edge. Wrapping it on the printed width and then
  // reserving room for every line keeps the whole note inside the page.
  const staleCountLines = report.rows.filter(
    (row) => row.countDocNo !== null && !row.countInPeriod
  ).length;
  const note = [
    report.warnings.length > 0
      ? report.warnings.join("   |   ")
      : "All required source data resolved for this period.",
    staleCountLines > 0
      ? `* ${staleCountLines} count(s) taken before this period: shown for reference, not used, so variance is blank.`
      : "",
  ]
    .filter(Boolean)
    .join("   |   ");

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  const noteLines = doc.splitTextToSize(note, pageWidth - 48) as string[];
  const noteLineHeight = 9;

  const footerY = Math.min(
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18,
    pageHeight - 24 - (noteLines.length - 1) * noteLineHeight
  );
  doc.text(noteLines, 24, footerY);

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${filenamePrefix}_${stamp}.pdf`);
}
