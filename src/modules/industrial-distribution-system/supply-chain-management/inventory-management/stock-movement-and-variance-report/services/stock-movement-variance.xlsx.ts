// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/services/stock-movement-variance.xlsx.ts
// ==============================================================================
// Excel Export Generator for Stock Movement and Variance Report.
// Multi-tab workbook: Executive Summary, Variance Lines and Supporting
// Documents. Values are written as numbers so supervisors can re-work
// the figures without re-parsing formatted strings.
// ==============================================================================

import * as XLSX from "xlsx";
import { formatPhDateTime } from "./stock-movement-variance.calc";
import type { StockMovementVarianceReportResponse } from "../types/stock-movement-variance.types";

/** Rounds to two decimals while keeping genuine numbers numeric. */
function qty(value: number | null | undefined): number | string {
  if (value === null || value === undefined) return "Not counted";
  return Math.round(value * 100) / 100;
}

/**
 * Generates and triggers download of the standardized report workbook.
 */
export function exportStockMovementVarianceToExcel(
  report: StockMovementVarianceReportResponse,
  filenamePrefix: string = "Stock_Movement_and_Variance_Report"
): void {
  const workbook = XLSX.utils.book_new();

  // ── Sheet 1: Executive Summary & KPIs ───────────────────────────────────────
  const summaryRows: (string | number)[][] = [
    ["INDUSTRIAL DISTRIBUTION SYSTEM - SUPPLY CHAIN MANAGEMENT"],
    ["STOCK MOVEMENT AND VARIANCE REPORT - EXECUTIVE SUMMARY"],
    ["Generated At", report.generatedAt],
    ["Branch", report.branchName ?? `All branches (${report.branchesReconciled} reconciled)`],
    ["Reporting Period", `${report.filters.startDate} to ${report.filters.endDate}`],
    ["Business Rule", "Expected = opening + in - out; Variance = counted - expected"],
    [],
    ["KEY INDICATORS", "VALUE"],
    ["Reconciled Product Lines", report.kpis.totalLines],
    ["Lines With a Non-Zero Variance", report.kpis.linesWithVariance],
    ["Lines Counted Inside This Period", report.kpis.linesCounted],
    ["Lines With No Count Inside This Period", report.kpis.linesUncounted],
    ["Net Variance (base units)", qty(report.kpis.netVarianceUnits)],
    ["Total Shortage (base units)", qty(report.kpis.shortUnits)],
    ["Total Overage (base units)", qty(report.kpis.overUnits)],
    [],
    ["SOURCE NOTES", ""],
    ...report.warnings.map((warning) => [warning, ""] as (string | number)[]),
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 48 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Overview & KPIs");

  // ── Sheet 2: Variance Lines ─────────────────────────────────────────────────
  const lineHeader = [
    "Product Code",
    "Product",
    "Category",
    "Branch",
    "Opening (base)",
    "In (base)",
    "Out (base)",
    "Expected (base)",
    "Counted (base)",
    "Variance (base)",
    "Variance %",
    "Count Document",
    "Count Cutoff",
    "Count Used",
    "Count System Qty",
    "Count Recorded Variance",
  ];

  const lineRows = report.rows.map((row) => [
    row.productCode ?? "",
    row.productName,
    row.categoryName ?? "",
    row.branchName,
    qty(row.openingBalance),
    qty(row.periodIn),
    qty(row.periodOut),
    qty(row.expectedClosing),
    qty(row.countedClosing),
    qty(row.variance),
    // A counted line with no positive expected base has no meaningful percentage,
    // which is a different fact from a line nobody counted.
    row.variance === null
      ? "Not counted"
      : row.variancePercent === null
        ? "Not applicable"
        : Math.round(row.variancePercent * 100) / 100,
    row.countDocNo ?? "",
    row.countCutoffDate ? formatPhDateTime(row.countCutoffDate) : "",
    // A sheet from an earlier period is still reported, but it measured a
    // different day, so the reader must be able to see it was not used.
    row.countDocNo ? (row.countInPeriod ? "In period" : "Earlier period") : "",
    qty(row.countSystemQty),
    qty(row.countSourceVariance),
  ]);

  const lineSheet = XLSX.utils.aoa_to_sheet([lineHeader, ...lineRows]);
  lineSheet["!cols"] = lineHeader.map((title) => ({ wch: Math.max(14, title.length) }));
  XLSX.utils.book_append_sheet(workbook, lineSheet, "Variance Lines");

  // ── Sheet 3: Supporting Documents (drill-down evidence) ─────────────────────
  const docHeader = [
    "Product",
    "Branch",
    "Document No",
    "Document Type",
    "Timestamp (Philippines)",
    "In (base)",
    "Out (base)",
    "Count Restatement (base)",
    "Note",
  ];

  const docRows = report.rows.flatMap((row) =>
    row.supportingDocuments.map((doc) => [
      row.productName,
      doc.branchName || row.branchName,
      doc.docNo,
      doc.docType,
      formatPhDateTime(doc.ts),
      qty(doc.inBase),
      qty(doc.outBase),
      qty(doc.countAdjustment),
      doc.descr,
    ])
  );

  const docSheet = XLSX.utils.aoa_to_sheet([docHeader, ...docRows]);
  docSheet["!cols"] = docHeader.map((title) => ({ wch: Math.max(14, title.length) }));
  XLSX.utils.book_append_sheet(workbook, docSheet, "Supporting Documents");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}_${stamp}.xlsx`);
}
