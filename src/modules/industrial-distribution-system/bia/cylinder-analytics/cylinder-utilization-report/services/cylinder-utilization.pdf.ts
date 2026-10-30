// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.pdf.ts
// ==============================================================================
// PDF Export for the Cylinder Utilization Report
//
// Landscape A4 assessment document, auto-paged:
//   - Branding header with the reporting cutoff and generation stamp
//   - KPI block covering the fleet-wide ratios
//   - Branch × cylinder-size utilization grid
//   - Applied rule and source-limitation footnotes, so a printed copy carries the
//     same qualifications as the screen (spec §2, §8)
//
// Complies with VoSync standards:
// - Export-only module: read-only reporting artefact
// - Full comments left behind for long-term maintainability
// ==============================================================================

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPercent } from "./cylinder-utilization.helpers";
import type { CylinderUtilizationReportResponse } from "../types/cylinder-utilization-report.types";

/** Generates and downloads the print-ready utilization assessment document. */
export function exportUtilizationToPdf(
  report: CylinderUtilizationReportResponse,
  filenamePrefix = "Cylinder_Utilization_Report"
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { kpis, rules } = report;

  // ── Header Branding ────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("VOSYNC INDUSTRIAL DISTRIBUTION SYSTEM", 40, 40);

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("Cylinder Utilization Report | Fleet Usage & Idle Asset Assessment", 40, 56);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `Reporting Cutoff: ${report.reportingCutoff}   |   Period Opening: ${report.filters.startDate}   |   Generated (UTC+8): ${report.generatedAt}`,
    40,
    70
  );

  // ── KPI Summary Block ──────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(40, 80, pageWidth - 80, 42, 4, 4, "FD");

  const colWidth = (pageWidth - 80) / 5;
  const kpiItems = [
    { label: "Eligible Fleet", val: kpis.eligibleFleet.toLocaleString() },
    { label: "Circulating", val: kpis.circulating.toLocaleString() },
    { label: "Utilization", val: formatPercent(kpis.utilization) },
    { label: `Idle (>${rules.idleThresholdDays}d)`, val: `${kpis.idle.toLocaleString()} / ${formatPercent(kpis.idleRate)}` },
    { label: "Maintenance", val: `${kpis.maintenance.toLocaleString()} / ${formatPercent(kpis.maintenanceRate)}` },
  ];

  kpiItems.forEach((kpi, idx) => {
    const x = 50 + idx * colWidth;
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label, x, 96);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(kpi.val, x, 112);
  });

  // ── Utilization Grid ───────────────────────────────────────────────────────
  const tableHeaders = [
    "Branch",
    "Product",
    "Total",
    "Active",
    "Circulating",
    "Available",
    "Idle",
    "For Repair",
    "Scrap",
    "Except.",
    "Utilization",
    "Avg Idle",
  ];

  const tableData = report.rows.map((row) => [
    row.branchName,
    row.sizeLabel,
    row.fleet.toLocaleString(),
    row.eligibleFleet.toLocaleString(),
    row.circulating.toLocaleString(),
    row.available.toLocaleString(),
    row.idle.toLocaleString(),
    row.maintenance.toLocaleString(),
    row.unavailable.toLocaleString(),
    row.unclassified > 0 ? `! ${row.unclassified}` : "0",
    formatPercent(row.utilization),
    row.averageIdleDays === null ? "—" : `${row.averageIdleDays}d`,
  ]);

  autoTable(doc, {
    startY: 135,
    margin: { left: 40, right: 40, bottom: 56 },
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
    // Only the two text columns are pinned: they ellipsize instead of pushing the
    // table off the page. The numeric columns are left to auto-size because a header
    // word such as "Circulating" is itself wider than a narrow fixed column, and
    // pinning those widths made autoTable report content it could not fit.
    columnStyles: {
      0: { cellWidth: 130, fontStyle: "bold", overflow: "ellipsize" },
      1: { cellWidth: 130, overflow: "ellipsize" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right", fontStyle: "bold" },
      11: { halign: "right" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${doc.internal.pages.length - 1}`, pageWidth - 80, pageHeight - 20);
      doc.text("VoSync Industrial Distribution System • Cylinder Utilization Report", 40, pageHeight - 20);
    },
  });

  // ── Rule & Limitation Footnotes ────────────────────────────────────────────
  // Placed from wherever autoTable finished, so a long grid never overlaps the notes.
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 140;
  const startY = lastY + 24;

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("Applied rules", 40, startY);
  doc.setFont("helvetica", "normal");
  doc.text(
    doc.splitTextToSize(
      `Utilization = circulating eligible cylinders / eligible fleet x 100. ` +
        `Idle threshold ${rules.idleThresholdDays} days. ` +
        `Circulating: ${rules.circulatingStatuses.join(", ")}. ` +
        `Stock: ${rules.yardStatuses.join(", ")}. ` +
        `Maintenance: status ${rules.maintenanceStatuses.join(", ")} or condition ${rules.maintenanceConditions.join(", ")}. ` +
        `Unavailable: status ${rules.unavailableStatuses.join(", ")} or condition ${rules.unavailableConditions.join(", ")}. ` +
        `Unclassified assets are excluded from the denominator and reported separately.`,
      pageWidth - 80
    ),
    40,
    startY + 10
  );

  doc.setFont("helvetica", "bold");
  doc.text("Source data limitations", 40, startY + 34);
  doc.setFont("helvetica", "normal");
  const limitationText = report.limitations.map((item) => `${item.code}: ${item.message}`).join("  ");
  doc.text(doc.splitTextToSize(limitationText, pageWidth - 80), 40, startY + 44);

  const cleanDate = report.reportingCutoff.replace(/[^0-9]/g, "");
  doc.save(`${filenamePrefix}_${cleanDate || "Report"}.pdf`);
}
