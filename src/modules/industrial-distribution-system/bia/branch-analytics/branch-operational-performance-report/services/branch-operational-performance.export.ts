// services/branch-operational-performance.export.ts
// ──────────────────────────────────────────────────────────────────────────────
// Multi-format export utility (Excel spreadsheet & PDF executive brief)
// ──────────────────────────────────────────────────────────────────────────────

import type { BranchOperationalReportResponse } from "../types/branch-operational-performance.types";

export async function exportToExcel(report: BranchOperationalReportResponse): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Operational Performance");

  worksheet.columns = [
    { header: "Incident No", key: "incidentNo", width: 16 },
    { header: "Serial Number", key: "serialNumber", width: 18 },
    { header: "Product", key: "productName", width: 25 },
    { header: "Custodian", key: "custodianName", width: 28 },
    { header: "Custodian Type", key: "custodianType", width: 16 },
    { header: "Incident Type", key: "incidentType", width: 20 },
    { header: "Assessed Value (PHP)", key: "assessedValue", width: 20 },
    { header: "Recovery Status", key: "recoveryStatus", width: 18 },
    { header: "Charge Status", key: "chargeStatus", width: 16 },
    { header: "Document Ref", key: "documentRef", width: 18 },
    { header: "Incident Date", key: "incidentDate", width: 15 },
    { header: "Days Outstanding", key: "daysOutstanding", width: 18 },
  ];

  // Header styling
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };

  report.incidents.forEach((inc) => {
    worksheet.addRow({
      incidentNo: inc.incidentNo,
      serialNumber: inc.serialNumber,
      productName: inc.productName,
      custodianName: inc.custodianName,
      custodianType: inc.custodianType,
      incidentType: inc.incidentType,
      assessedValue: inc.assessedValue,
      recoveryStatus: inc.recoveryStatus,
      chargeStatus: inc.chargeStatus,
      documentRef: inc.documentRef,
      incidentDate: inc.incidentDate,
      daysOutstanding: inc.daysOutstanding,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Branch_Operational_Performance_${report.filters.startDate}_to_${report.filters.endDate}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToPdf(report: BranchOperationalReportResponse): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text("Branch Operational Performance Report", 40, 45);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Branch: ${report.filters.branchLabel || "All Authorized Branches"}  |  Period: ${report.filters.startDate} to ${report.filters.endDate}`,
    40,
    65
  );
  doc.text(`Generated: ${report.dataFreshnessTimestamp}  |  Cutoff: ${report.cutoffDate}`, 40, 80);

  // KPI Summary box
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Sales: PHP ${report.kpis.totalSalesAmount.toLocaleString()}   |   Active Cylinders: ${report.kpis.activeHoldingCylinders}   |   Recovery Rate: ${report.kpis.cylinderRecoveryRate}%   |   Trip Expenses: PHP ${report.kpis.totalTripExpenses.toLocaleString()}`,
    40,
    105
  );

  const tableRows = report.incidents.map((inc) => [
    inc.incidentNo,
    inc.serialNumber,
    inc.productName,
    inc.custodianName,
    inc.incidentType,
    `PHP ${inc.assessedValue.toLocaleString()}`,
    inc.recoveryStatus,
    inc.chargeStatus,
    inc.incidentDate,
  ]);

  autoTable(doc, {
    startY: 120,
    head: [
      [
        "Incident No",
        "Serial No",
        "Product",
        "Custodian",
        "Type",
        "Assessed Value",
        "Recovery",
        "Charge",
        "Date",
      ],
    ],
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 8, cellPadding: 4 },
  });

  doc.save(
    `Branch_Operational_Performance_${report.filters.startDate}_to_${report.filters.endDate}.pdf`
  );
}
