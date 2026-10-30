// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/services/stock-movement-variance.pdf.ts
// ==============================================================================
// PDF Export Generator for Stock Movement and Variance Report.
// Audit-oriented landscape document: title block, scope and rule statement,
// KPI band, reconciled lines, and a data-exception appendix.
// ==============================================================================

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

  // ── Header Branding ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("VERTEX TECHNOLOGICS CORPORATION - INDUSTRIAL DISTRIBUTION SYSTEM", 32, 36);

  doc.setFontSize(13);
  doc.text("Stock Movement and Variance Report", 32, 55);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Branch: ${report.branchName ?? String(report.filters.branchId ?? "Not specified")}`, 32, 70);
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
      ["Lines supported by a committed count", String(report.kpis.linesCounted)],
      ["Lines with no committed count", String(report.kpis.linesUncounted)],
      ["Net variance (base units)", signed(report.kpis.netVarianceUnits)],
      ["Total shortage (base units)", signed(report.kpis.shortUnits)],
      ["Total overage (base units)", signed(report.kpis.overUnits)],
      ["Lines carrying a data exception", String(report.kpis.exceptionLines)],
      ["Unmatched counted serials", String(report.kpis.unmatchedSerials)],
      ["Documents excluded as void reversals", String(report.kpis.voidReversalDocuments)],
    ],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 108] },
    columnStyles: { 0: { cellWidth: 200 }, 1: { cellWidth: 110, halign: "right" } },
  });

  // ── Reconciled Lines ────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14,
    head: [
      [
        "Product",
        "Opening",
        "In",
        "Out",
        "Expected",
        "Counted",
        "Variance",
        "Var %",
        "Count Doc",
        "Cutoff",
        "Exceptions",
      ],
    ],
    body: report.rows.map((row) => [
      row.productCode ? `${row.productCode} ${row.productName}` : row.productName,
      qty(row.openingBalance),
      qty(row.periodIn),
      qty(row.periodOut),
      qty(row.expectedClosing),
      qty(row.countedClosing),
      signed(row.variance),
      row.variancePercent === null ? "—" : `${Math.round(row.variancePercent * 10) / 10}%`,
      row.countDocNo ?? "—",
      row.countCutoffDate ?? "—",
      row.exceptionCodes.join(", ") || "None",
    ]),
    theme: "striped",
    styles: { fontSize: 7, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 108] },
    columnStyles: {
      0: { cellWidth: 170 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      9: { cellWidth: 60 },
      10: { cellWidth: 100 },
    },
  });

  // ── Exception Appendix ──────────────────────────────────────────────────────
  const serialRows = report.rows.flatMap((row) =>
    row.serialExceptions.map((serial) => [
      "Unmatched serial",
      row.productName,
      `${serial.phNo} / ${serial.serialNumber}`,
      serial.reason,
    ])
  );

  const reversalRows = report.excludedDocuments.map((item) => [
    "Void reversal",
    item.docType,
    item.docNo,
    `Excluded: in ${qty(item.inBase)} / out ${qty(item.outBase)}`,
  ]);

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14,
    head: [["Exception", "Subject", "Reference", "Detail"]],
    body:
      serialRows.length + reversalRows.length > 0
        ? [...serialRows, ...reversalRows]
        : [["None", "-", "-", "No serial or reversal exceptions were raised"]],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2.5 },
    headStyles: { fillColor: [126, 44, 44] },
    columnStyles: { 0: { cellWidth: 90 }, 2: { cellWidth: 150 } },
  });

  // ── Source notes footer ─────────────────────────────────────────────────────
  const footerY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  const boundedFooterY = Math.min(footerY, doc.internal.pageSize.getHeight() - 24);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.text(
    report.warnings.length > 0
      ? report.warnings.join("   |   ").slice(0, Math.floor(pageWidth))
      : "All required source data resolved for this period.",
    32,
    boundedFooterY
  );

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${filenamePrefix}_${stamp}.pdf`);
}
