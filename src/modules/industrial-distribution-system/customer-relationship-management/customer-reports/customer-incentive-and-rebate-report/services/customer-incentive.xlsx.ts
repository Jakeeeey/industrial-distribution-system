// ============================================================
// customer-incentive.xlsx.ts
// Excel writer. One worksheet per export section plus a Filters sheet, so a
// recipient always knows which window produced the numbers.
// ============================================================

import * as XLSX from "xlsx";

import type { CustomerIncentiveReportResponse } from "../types/customer-incentive.types";
import {
  buildReportExportSections,
  buildReportFilterContext,
  type ReportExportCell,
  type ReportExportSection,
} from "./customer-incentive.export-model";
import {
  buildReportFilename,
  formatGeneratedAt,
  safeSheetName,
} from "./customer-incentive.helpers";

type ExportWorksheet = XLSX.WorkSheet & {
  "!freeze"?: { xSplit: number; ySplit: number };
};

// Anything money- or weight-shaped must stay a number so the recipient can
// sum and pivot it instead of re-typing the column.
const NUMERIC_COLUMN_PATTERN = /(kg|₱|units|amount|rate|variance)/i;

function filtersSheet(report: CustomerIncentiveReportResponse): ExportWorksheet {
  const rows: ReportExportCell[][] = [
    ["Filter", "Applied Value"],
    ...buildReportFilterContext(report.filters).map(
      ({ label, value }): ReportExportCell[] => [label, value]
    ),
    ["Reporting Cutoff", report.reportingCutoff],
    ["Generated At", formatGeneratedAt(report.generatedAt)],
    ["Source Rows Read", report.sourceRowCount],
    ["Result Rows", report.rows.length],
    ["Claims", report.claims.length],
    ["Data Exceptions", report.exceptions.length],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows) as ExportWorksheet;
  sheet["!cols"] = [{ wch: 26 }, { wch: 64 }];
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  return sheet;
}

/**
 * Decimal cells keep their precision as numbers; only the display format is
 * set. ₱ columns get two decimals, per-kg rates keep two, everything else
 * shows up to three.
 */
function applyNumberFormats(sheet: ExportWorksheet, section: ReportExportSection): void {
  section.rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (typeof value !== "number") return;
      const column = section.columns[columnIndex] ?? "";
      if (!NUMERIC_COLUMN_PATTERN.test(column)) return;
      const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex });
      const cell = sheet[address];
      if (cell) cell.z = column.includes("units") ? "0.###" : "0.00";
    });
  });
}

function sectionSheet(section: ReportExportSection): ExportWorksheet {
  const sheet = XLSX.utils.aoa_to_sheet([
    section.columns,
    ...section.rows,
  ]) as ExportWorksheet;

  sheet["!cols"] = section.columns.map((column, columnIndex) => {
    const widest = section.rows.reduce(
      (width, row) => Math.max(width, String(row[columnIndex] ?? "").length),
      column.length
    );
    return { wch: Math.min(Math.max(widest + 2, 12), 42) };
  });
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  sheet["!autofilter"] = {
    ref: `A1:${XLSX.utils.encode_col(Math.max(section.columns.length - 1, 0))}${Math.max(
      section.rows.length + 1,
      1
    )}`,
  };
  applyNumberFormats(sheet, section);
  return sheet;
}

/**
 * Builds the workbook without writing it, so the sheet layout is unit-testable.
 */
export function buildCustomerIncentiveWorkbook(
  report: CustomerIncentiveReportResponse
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>(["Filters"]);
  XLSX.utils.book_append_sheet(workbook, filtersSheet(report), "Filters");

  for (const section of buildReportExportSections(report)) {
    XLSX.utils.book_append_sheet(
      workbook,
      sectionSheet(section),
      safeSheetName(section.title, usedNames)
    );
  }
  return workbook;
}

/**
 * Downloads the workbook. The filename carries the cutoff and the eligible
 * size because the same scheme is re-run every period.
 */
export function exportCustomerIncentiveWorkbook(
  report: CustomerIncentiveReportResponse
): void {
  XLSX.writeFile(
    buildCustomerIncentiveWorkbook(report),
    buildReportFilename("customer-incentive-rebate", report.filters, "xlsx")
  );
}
