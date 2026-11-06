// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/services/lost-damaged-cylinder.xlsx.ts
// ==============================================================================
// Lost and Damaged Cylinder Report - Excel Exporter
// Produces printable and spreadsheet reports using xlsx library.
// ==============================================================================

import * as XLSX from "xlsx";
import type { LostDamagedReportResponse } from "../types/lost-damaged-cylinder.types";

export function exportLostDamagedReportToExcel(
  report: LostDamagedReportResponse,
  filename = "Lost_and_Damaged_Cylinder_Report.xlsx"
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive KPI Summary
  const kpiData = [
    ["LOST AND DAMAGED CYLINDER REPORT - EXECUTIVE SUMMARY"],
    ["Generated Cutoff:", report.reportingCutoff],
    [],
    ["Metric", "Value"],
    ["Total Incidents Recorded", report.kpis.totalIncidents],
    ["Lost Cylinders", report.kpis.lostCount],
    ["Damaged / For Repair Cylinders", report.kpis.damagedCount],
    ["Recovered Cylinders", report.kpis.recoveredCount],
    ["Written Off Cylinders", report.kpis.writtenOffCount],
    ["Recovery Rate (%)", `${report.kpis.recoveryRate}%`],
    ["Total Assessed Loss Value (PHP)", report.kpis.totalLossValue],
    ["Total Recovered Asset Value (PHP)", report.kpis.recoveredValue],
    ["Unsettled Custodian Charges (PHP)", report.kpis.unsettledChargesValue],
  ];
  const wsKpis = XLSX.utils.aoa_to_sheet(kpiData);
  XLSX.utils.book_append_sheet(wb, wsKpis, "KPI Summary");

  // Sheet 2: Incident Register Details
  const rowsData = report.rows.map((row) => ({
    "Incident No": row.incidentNo,
    "Serial Number": row.serialNumber,
    "Product Code": row.productCode,
    "Product Name": row.productName,
    "Tare Weight (kg)": row.tareWeight,
    Branch: row.branchName,
    "Custodian Type": row.custodianType,
    "Custodian Code": row.custodianCode,
    "Custodian Name": row.custodianName,
    Category: row.incidentCategory,
    Condition: row.condition,
    "Lifecycle Status": row.status,
    "Recovery Status": row.recoveryStatus,
    "Charge Status": row.chargeStatus,
    "Assessed Value (PHP)": row.assessedValue,
    "Incident Date": row.incidentDate,
    "Days Outstanding": row.daysOutstanding,
    "Write-Off Doc No": row.writeOffDocNo || "—",
    "Recovery Doc No": row.recoveryDocNo || "—",
    "Supporting Document": row.supportingDocNo,
    Remarks: row.remarks,
  }));

  const wsRows = XLSX.utils.json_to_sheet(rowsData);
  XLSX.utils.book_append_sheet(wb, wsRows, "Incident Register");

  XLSX.writeFile(wb, filename);
}
