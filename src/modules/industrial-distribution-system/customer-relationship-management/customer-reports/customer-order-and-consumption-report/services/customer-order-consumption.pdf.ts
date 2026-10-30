// ============================================================
// customer-order-consumption.pdf.ts
// Landscape A4 PDF built from the same export sections as the workbook, so
// the printed page and the spreadsheet can never disagree.
// ============================================================

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { CustomerOrderConsumptionReportResponse } from "../types/customer-order-consumption.types";
import {
  buildReportExportSections,
  buildReportFilterContext,
  type ReportExportCell,
  type ReportExportSection,
} from "./customer-order-consumption.export-model";
import {
  buildReportFilename,
  formatGeneratedAt,
} from "./customer-order-consumption.helpers";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

function formatCell(value: ReportExportCell): string {
  return typeof value === "number" ? numberFormatter.format(value) : value;
}

function headerLines(
  report: CustomerOrderConsumptionReportResponse
): string[] {
  const filters = buildReportFilterContext(report.filters)
    .map(({ label, value }) => `${label}: ${value}`)
    .join("  |  ");

  const totals = [
    `Cylinder net ${numberFormatter.format(report.overview.cylinder.netKg)} kg (proxy)`,
    `LPG net ${numberFormatter.format(report.overview.lpg.netKg)} kg (measured)`,
    `Customers ${report.overview.totalCustomers}`,
    `Events ${report.overview.totalOrders}`,
    `Exceptions ${report.overview.exceptionCount}`,
  ].join("  |  ");

  return [filters, `Generated: ${formatGeneratedAt(report.generatedAt)}  |  Cutoff: ${report.reportingCutoff}`, totals];
}

function drawReportHeader(doc: jsPDF, title: string, report: CustomerOrderConsumptionReportResponse): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 10, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  // Three wrapped lines reserve their own band; startY/margin below must clear it.
  headerLines(report).forEach((line, index) => {
    doc.text(line, 10, 16 + index * 4, { maxWidth: 277 });
  });
}

function drawPageFooters(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${pageNumber} of ${totalPages}`, 287, 203, { align: "right" });
  }
}

function drawSection(
  doc: jsPDF,
  report: CustomerOrderConsumptionReportResponse,
  section: ReportExportSection
): void {
  const firstPage = doc.getNumberOfPages();

  autoTable(doc, {
    startY: 30,
    head: [section.columns],
    body: section.rows.map((row) => row.map(formatCell)),
    showHead: "everyPage",
    margin: { top: 30, right: 10, bottom: 13, left: 10 },
    pageBreak: "auto",
    rowPageBreak: "avoid",
    styles: { fontSize: 6.5, cellPadding: 1.4, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    willDrawPage: () => {
      const isContinuation = doc.getNumberOfPages() > firstPage;
      drawReportHeader(
        doc,
        isContinuation ? `${section.title} (continued)` : section.title,
        report
      );
    },
  });
}

/**
 * Builds the document without saving it so the page layout stays testable.
 * Empty sections still get a page: a missing sheet reads as a lost report.
 */
export function buildCustomerOrderConsumptionPdf(
  report: CustomerOrderConsumptionReportResponse
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  buildReportExportSections(report).forEach((section, index) => {
    if (index > 0) doc.addPage();
    drawSection(doc, report, section);
  });
  drawPageFooters(doc);

  return doc;
}

export function exportCustomerOrderConsumptionPdf(
  report: CustomerOrderConsumptionReportResponse
): void {
  buildCustomerOrderConsumptionPdf(report).save(
    buildReportFilename("customer-order-consumption", report.filters, "pdf")
  );
}

/**
 * Opens the print dialog instead of downloading, which is what the branch
 * users asked for when they want the period on paper.
 */
export function printCustomerOrderConsumptionPdf(
  report: CustomerOrderConsumptionReportResponse
): void {
  const doc = buildCustomerOrderConsumptionPdf(report);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const frame = window.open(url, "_blank");
  // Revoking immediately would cancel the load in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  frame?.focus();
}
