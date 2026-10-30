// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/services/cylinder-deposit-swap.pdf.ts
// ==============================================================================
// PDF Export Generator for Cylinder Deposit and Swap Report.
// Professional audit-grade document with company header, KPIs, and tabular layout.
// ==============================================================================

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CylinderDepositSwapReportResponse } from "../types/cylinder-deposit-swap.types";

/**
 * Generates and triggers download of a standardized audit-ready PDF report.
 */
export function exportCylinderDepositSwapToPdf(
  report: CylinderDepositSwapReportResponse,
  filenamePrefix: string = "Cylinder_Deposit_and_Swap_Report"
): void {
  // Create landscape document for wide financial/operational tabular data
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Header Branding ─────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("INDUSTRIAL DISTRIBUTION SYSTEM", 40, 40);

  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("Supply Chain Management | Cylinder Deposit and Swap Report", 40, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `Reporting Period: ${report.filters.startDate} to ${report.filters.endDate}   |   Generated: ${report.generatedAt}`,
    40,
    74
  );

  // ── KPI Summary Block ───────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(40, 85, pageWidth - 80, 45, 4, 4, "FD");

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const colWidth = (pageWidth - 80) / 4;
  const kpiItems = [
    { label: "Active Customer Base", val: report.kpis.totalActiveCustomerBase.toLocaleString() },
    { label: "New Deposits (Period)", val: `+${report.kpis.totalPeriodDeposits.toLocaleString()}` },
    { label: "Empty Swaps Collected", val: report.kpis.totalPeriodSwapsReturned.toLocaleString() },
    { label: "Stagnant Cylinders (>60d)", val: report.kpis.totalStagnantCylinders.toLocaleString() },
  ];

  kpiItems.forEach((item, idx) => {
    const x = 55 + idx * colWidth;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(item.val, x, 105);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x, 118);
  });

  // ── Tabular Data: Doc §11 Proposed Columns ─────────────────────────────────
  const tableHeaders = [
    [
      "Customer",
      "Date",
      "Reference",
      "Deposit Qty",
      "Swap Qty",
      "Ownership",
      "Running Base",
    ],
  ];

  const tableRows = report.rows.map((row) => [
    `${row.customerName}\n(${row.customerCode})`,
    row.date || row.lastTransactionDate || "—",
    row.reference || "—",
    row.depositQty > 0 ? `+${row.depositQty}` : "0",
    row.swapQty.toLocaleString(),
    row.ownership || "COMPANY",
    row.runningBase.toLocaleString(),
  ]);

  autoTable(doc, {
    startY: 140,
    head: tableHeaders,
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 160 },
      1: { cellWidth: 90 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
      8: { halign: "right", fontStyle: "bold" },
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageStr = `Page ${data.pageNumber} of {total_pages_count_string}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(pageStr, pageWidth - 100, pageHeight - 20);
    },
    margin: { top: 140, left: 40, right: 40, bottom: 40 },
  });

  // Calculate total pages for all pages (added by jspdf-autotable at runtime)
  const pagedDoc = doc as typeof doc & { putTotalPages?: (token: string) => void };
  if (typeof pagedDoc.putTotalPages === "function") {
    pagedDoc.putTotalPages("{total_pages_count_string}");
  }

  const dateStamp = new Date().toISOString().split("T")[0];
  doc.save(`${filenamePrefix}_${dateStamp}.pdf`);
}
