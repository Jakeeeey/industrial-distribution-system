// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/services/cylinder-utilization.xlsx.ts
// ==============================================================================
// Excel (.xlsx) Export for the Cylinder Utilization Report (spec §5 "export results")
//
// Three tabs, in the order a reviewer reads them:
//   1. Executive Summary  — KPI strip, the rules the figures were built from and
//                           the structural limitations of the source data
//   2. Fleet Utilization  — the branch × cylinder-size grid exactly as displayed
//   3. Data Exceptions    — groupings carrying missing / out-of-domain statuses,
//                           reported separately per spec §8
//
// Complies with VoSync standards:
// - Export-only module: never mutates a source record
// - Full comments left behind for long-term maintainability
// ==============================================================================

import * as XLSX from "xlsx";
import { formatPercent } from "./cylinder-utilization.helpers";
import type { CylinderUtilizationReportResponse } from "../types/cylinder-utilization-report.types";

/**
 * Generates and downloads the multi-tab utilization workbook.
 * Percentages are written as display strings so the workbook reads identically to
 * the on-screen report at one decimal place.
 */
export function exportUtilizationToExcel(
  report: CylinderUtilizationReportResponse,
  filenamePrefix = "Cylinder_Utilization_Report"
): void {
  const workbook = XLSX.utils.book_new();
  const { kpis, rows, rules, limitations } = report;

  // ── Sheet 1: Executive Summary, Rules & Limitations ────────────────────────
  const summaryRows: Array<Array<string | number>> = [
    ["VOSYNC INDUSTRIAL DISTRIBUTION SYSTEM - BUSINESS INTELLIGENCE & ANALYTICS"],
    ["CYLINDER UTILIZATION REPORT - FLEET USAGE & IDLE ASSET ASSESSMENT"],
    ["Reporting Cutoff", report.reportingCutoff],
    ["Period Opening", report.filters.startDate],
    ["Report Generated At (UTC+8)", report.generatedAt],
    [],
    ["METRIC", "VALUE"],
    ["Total Fleet (non-deleted assets)", kpis.totalFleet],
    ["Eligible Fleet (denominator)", kpis.eligibleFleet],
    ["Circulating", kpis.circulating],
    ["Available", kpis.available],
    ["Idle", kpis.idle],
    ["Maintenance", kpis.maintenance],
    ["Unavailable (lost / retired / scrapped)", kpis.unavailable],
    ["Unclassified data exceptions", kpis.unclassified],
    ["Utilization %", formatPercent(kpis.utilization)],
    ["Idle Rate %", formatPercent(kpis.idleRate)],
    ["Maintenance Rate %", formatPercent(kpis.maintenanceRate)],
    ["Branches Reported", kpis.branchesReported],
    ["Cylinder Sizes Reported", kpis.sizesReported],
    ["Verified Movements Considered", kpis.movementsConsidered],
    ["Linked Reversals Excluded", kpis.reversalsExcluded],
    [],
    ["APPLIED BUSINESS RULES"],
    ["Utilization formula", "circulating eligible cylinders / eligible fleet x 100"],
    ["Idle threshold (days)", rules.idleThresholdDays],
    ["Circulating statuses", rules.circulatingStatuses.join(", ")],
    ["Yard statuses", rules.yardStatuses.join(", ")],
    ["Maintenance statuses", rules.maintenanceStatuses.join(", ")],
    ["Maintenance conditions", rules.maintenanceConditions.join(", ")],
    ["Unavailable statuses", rules.unavailableStatuses.join(", ")],
    ["Unavailable conditions", rules.unavailableConditions.join(", ")],
    ["Last-activity basis", rules.activityBasis.join(" | ")],
    [],
    ["SOURCE DATA LIMITATIONS"],
    ...limitations.map((item) => [item.code, item.message]),
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 46 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Executive Summary");

  // ── Sheet 2: Branch × Size Utilization Grid ────────────────────────────────
  const gridHeaders = [
    "Branch",
    "Cylinder Size",
    "Fleet",
    "Eligible Fleet",
    "Circulating",
    "Available",
    "Idle",
    "Maintenance",
    "Unavailable",
    "Exceptions",
    "Utilization %",
    "Idle Rate %",
    "Avg Idle Days",
  ];

  const gridData = rows.map((row) => [
    row.branchName,
    row.sizeLabel,
    row.fleet,
    row.eligibleFleet,
    row.circulating,
    row.available,
    row.idle,
    row.maintenance,
    row.unavailable,
    row.unclassified,
    formatPercent(row.utilization),
    formatPercent(row.idleRate),
    row.averageIdleDays ?? "—",
  ]);

  const gridSheet = XLSX.utils.aoa_to_sheet([gridHeaders, ...gridData]);
  gridSheet["!cols"] = [
    { wch: 26 }, // Branch
    { wch: 24 }, // Cylinder Size
    { wch: 9 }, // Fleet
    { wch: 15 }, // Eligible Fleet
    { wch: 13 }, // Circulating
    { wch: 12 }, // Available
    { wch: 9 }, // Idle
    { wch: 13 }, // Maintenance
    { wch: 13 }, // Unavailable
    { wch: 12 }, // Exceptions
    { wch: 14 }, // Utilization %
    { wch: 13 }, // Idle Rate %
    { wch: 14 }, // Avg Idle Days
  ];
  XLSX.utils.book_append_sheet(workbook, gridSheet, "Fleet Utilization");

  // ── Sheet 3: Missing / Out-of-Domain Status Exceptions ─────────────────────
  const exceptionRows = rows.filter((row) => row.unclassified > 0);
  const exceptionHeaders = ["Branch", "Cylinder Size", "Unclassified Assets", "Fleet", "Utilization %"];

  const exceptionSheet = XLSX.utils.aoa_to_sheet([
    exceptionHeaders,
    ...(exceptionRows.length
      ? exceptionRows.map((row) => [row.branchName, row.sizeLabel, row.unclassified, row.fleet, formatPercent(row.utilization)])
      : [["No data exceptions", "All asset statuses resolved within the source ENUM domain", 0, 0, "—"]]),
  ]);
  exceptionSheet["!cols"] = [{ wch: 28 }, { wch: 48 }, { wch: 20 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, exceptionSheet, "Data Exceptions");

  // ── Browser Download ───────────────────────────────────────────────────────
  const cleanDate = report.reportingCutoff.replace(/[^0-9]/g, "");
  XLSX.writeFile(workbook, `${filenamePrefix}_${cleanDate || "Report"}.xlsx`);
}
