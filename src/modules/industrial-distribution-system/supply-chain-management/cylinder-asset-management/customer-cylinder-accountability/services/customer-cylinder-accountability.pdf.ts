// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/services/customer-cylinder-accountability.pdf.ts
// ==============================================================================
// PDF Export Generator for Customer Cylinder Accountability Report
// Professional landscape audit-grade report complying with VoSync Design System:
// - Header branding & Cutoff metadata
// - KPI metrics summary block
// - Tabular reconciliation grid with auto-paging
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CustomerAccountabilityReportResponse } from "../types/customer-cylinder-accountability.types";

/**
 * Generates and triggers download of an audit-ready PDF report document.
 */
export function exportAccountabilityToPdf(
  report: CustomerAccountabilityReportResponse,
  filenamePrefix: string = "Customer_Cylinder_Accountability_Report"
): void {
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
  doc.text("VOSYNC INDUSTRIAL DISTRIBUTION SYSTEM", 40, 40);

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("Customer Cylinder Accountability Report | Balance & Custody Ledger", 40, 56);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `Reporting Cutoff: ${report.reportingCutoff}   |   Generated (UTC+8): ${report.generatedAt}`,
    40,
    70
  );

  // ── KPI Summary Block ───────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(40, 80, pageWidth - 80, 42, 4, 4, "FD");

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const colWidth = (pageWidth - 80) / 6;
  const kpiItems = [
    { label: "Opening", val: report.kpis.totalOpeningBase.toLocaleString() },
    { label: "Issued (+)", val: `+${report.kpis.totalPeriodDeposits.toLocaleString()}` },
    { label: "Returned (-)", val: `-${report.kpis.totalPeriodPullOuts.toLocaleString()}` },
    { label: "Current Held (=)", val: report.kpis.totalClosingBase.toLocaleString() },
    { label: "Total Quota", val: report.kpis.totalAuthorizedLimit.toLocaleString() },
    { label: "Over-Limit Risk", val: `${report.kpis.overLimitCount} Accounts` },
  ];

  kpiItems.forEach((kpi, idx) => {
    const x = 45 + idx * colWidth;
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label, x, 96);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.val, x, 112);
  });

  // ── Tabular Balance Grid (SNET Spec v1.0 §11) ──────────────────────────────
  const tableHeaders = [
    "Cust. Code",
    "Customer Name",
    "Site",
    "Opening",
    "Issued (+)",
    "Returned (-)",
    "Held (=)",
    "Limit",
    "Variance",
 
    "Audit Status",
  ];

  const tableData = report.rows.map((row) => {
    const opening = row.opening ?? row.openingBase;
    const issued = row.issued ?? row.periodDeposits;
    const returned = row.returned ?? row.periodPullOuts;
    const held = row.held ?? row.closingBase;
    const limit = row.authorizedLimit;
    const variance = row.variance ?? (held - limit);
    const varText = variance > 0 ? `+${variance}` : `${variance}`;

    return [
      row.customerCode,
      row.customerName,
      row.siteName || row.branchName,
      opening.toLocaleString(),
      `+${issued.toLocaleString()}`,
      `-${returned.toLocaleString()}`,
      held.toLocaleString(),
      limit.toLocaleString(),
      varText,
      row.exceptionCount > 0 ? `⚠️ ${row.exceptionCount}` : "✓ Verified",
    ];
  });

  autoTable(doc, {
    startY: 135,
    margin: { left: 40, right: 40, bottom: 40 },
    head: [tableHeaders],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 70 },
      1: { cellWidth: 160 },
      2: { cellWidth: 80 },
      3: { halign: "right", cellWidth: 50 },
      4: { halign: "right", cellWidth: 50 },
      5: { halign: "right", cellWidth: 50 },
      6: { halign: "right", fontStyle: "bold", cellWidth: 50 },
      7: { halign: "right", cellWidth: 50 },
      8: { halign: "right", cellWidth: 50 },
      9: { halign: "center", cellWidth: 55 },
      10: { halign: "center", cellWidth: 55 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: () => {
      // Footer page numbering
      const str = `Page ${doc.internal.pages.length - 1}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth - 80, pageHeight - 20);
      doc.text("VoSync Industrial Distribution System • Audit Report", 40, pageHeight - 20);
    },
  });

  const cleanDate = report.reportingCutoff.replace(/[^0-9]/g, "");
  const filename = `${filenamePrefix}_${cleanDate || "Audit"}.pdf`;
  doc.save(filename);
}
