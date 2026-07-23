import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type {
  CustomerPurchaseSummary,
  CylinderPurchaseDashboardResponse,
  CylinderPurchaseDashboardView,
  CylinderPurchaseReportFilters,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

import {
  buildConsolidatedExportSections,
  buildDashboardExportSections,
  buildReportFilterContext,
  type ReportExportCell,
  type ReportExportSection,
} from "./cylinder-purchase-report.export-model.ts";

const quantityFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
});
const timestampFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : timestampFormatter.format(date);
}

function formatCell(column: string, value: ReportExportCell): string {
  if (typeof value !== "number") return value;
  return column === "Return Rate"
    ? percentFormatter.format(value)
    : quantityFormatter.format(value);
}

function filterContext(report: CylinderPurchaseDashboardResponse): string {
  return buildReportFilterContext(report.filters)
    .map(({ label, value }) => `${label}: ${value}`)
    .join("  |  ");
}

function overviewContext(report: CylinderPurchaseDashboardResponse): string {
  return [
    `Gross ${quantityFormatter.format(report.overview.grossPurchasedQty)}`,
    `Returned ${quantityFormatter.format(report.overview.returnedQty)}`,
    `Net ${quantityFormatter.format(report.overview.netPurchasedQty)}`,
    `Customers ${quantityFormatter.format(report.overview.uniqueCustomers)}`,
    `Products ${quantityFormatter.format(report.overview.serializedProducts)}`,
  ].join("  |  ");
}

function drawReportHeader(
  doc: jsPDF,
  report: CylinderPurchaseDashboardResponse,
  title: string,
): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 10, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(filterContext(report), 10, 17, { maxWidth: 277 });
  doc.text(`Generated: ${formatTimestamp(report.generatedAt)}`, 10, 22);
  doc.text(overviewContext(report), 10, 27, { maxWidth: 277 });
}

function drawPageFooters(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${pageNumber} of ${totalPages}`, 287, 203, {
      align: "right",
    });
  }
}

function drawSection(
  doc: jsPDF,
  report: CylinderPurchaseDashboardResponse,
  section: ReportExportSection,
): void {
  const firstSectionPage = doc.getNumberOfPages();
  const body = section.rows.map((row) =>
    row.map((value, columnIndex) =>
      formatCell(section.columns[columnIndex] ?? "", value),
    ),
  );

  autoTable(doc, {
    startY: 33,
    head: [section.columns],
    body,
    showHead: "everyPage",
    margin: { top: 33, right: 10, bottom: 13, left: 10 },
    pageBreak: "auto",
    rowPageBreak: "avoid",
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    willDrawPage: () => {
      const isContinuation = doc.getNumberOfPages() > firstSectionPage;
      drawReportHeader(
        doc,
        report,
        isContinuation ? `${section.title} (continued)` : section.title,
      );
    },
  });
}

function buildPdf(
  report: CylinderPurchaseDashboardResponse,
  sections: ReportExportSection[],
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  sections.forEach((section, index) => {
    if (index > 0) doc.addPage();
    drawSection(doc, report, section);
  });
  drawPageFooters(doc);

  return doc;
}

export function buildReportFilename(
  scope: string,
  filters: CylinderPurchaseReportFilters,
  extension: "pdf" | "xlsx" = "pdf",
): string {
  const safeScope = scope.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `cylinder-purchase-report-${safeScope}-${filters.startDate}-to-${filters.endDate}.${extension}`;
}

export function buildDashboardPdf(
  report: CylinderPurchaseDashboardResponse,
  view: CylinderPurchaseDashboardView,
  selectedCustomer: CustomerPurchaseSummary | null = null,
): jsPDF {
  return buildPdf(
    report,
    buildDashboardExportSections(report, view, selectedCustomer),
  );
}

export function buildConsolidatedPdf(
  report: CylinderPurchaseDashboardResponse,
): jsPDF {
  return buildPdf(report, buildConsolidatedExportSections(report));
}

export function exportDashboardPdf(
  report: CylinderPurchaseDashboardResponse,
  view: CylinderPurchaseDashboardView,
  selectedCustomer: CustomerPurchaseSummary | null = null,
): void {
  buildDashboardPdf(report, view, selectedCustomer).save(
    buildReportFilename(
      selectedCustomer ? "customer-detail" : view,
      report.filters,
    ),
  );
}

export function printDashboardPdf(
  report: CylinderPurchaseDashboardResponse,
  view: CylinderPurchaseDashboardView,
  selectedCustomer: CustomerPurchaseSummary | null = null,
): void {
  const doc = buildDashboardPdf(report, view, selectedCustomer);
  window.open(doc.output("bloburl"), "_blank", "noopener,noreferrer");
}

export function exportConsolidatedPdf(
  report: CylinderPurchaseDashboardResponse,
): void {
  buildConsolidatedPdf(report).save(
    buildReportFilename("consolidated", report.filters),
  );
}
