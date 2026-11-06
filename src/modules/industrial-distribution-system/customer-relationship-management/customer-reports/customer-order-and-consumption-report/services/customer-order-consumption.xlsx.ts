// ============================================================
// customer-order-consumption.xlsx.ts
// Excel writer. One worksheet per export section plus a Filters sheet, so a
// recipient always knows which window produced the numbers.
// ============================================================

import * as XLSX from "xlsx";

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
  safeSheetName,
} from "./customer-order-consumption.helpers";

type ExportWorksheet = XLSX.WorkSheet & {
  "!freeze"?: { xSplit: number; ySplit: number };
};

const KG_COLUMN_PATTERN = /(kg|amount|qty|quantity|rate)/i;

function filtersSheet(
  report: CustomerOrderConsumptionReportResponse
): ExportWorksheet {
  const rows: ReportExportCell[][] = [
    ["Filter", "Applied Value"],
    ...buildReportFilterContext(report.filters).map(
      ({ label, value }): ReportExportCell[] => [label, value]
    ),
    ["Reporting Cutoff", report.reportingCutoff],
    ["Generated At", formatGeneratedAt(report.generatedAt)],
    ["Source Rows Read", report.sourceRowCount],
    ["Result Rows", report.rows.length],
    ["Data Exceptions", report.exceptions.length],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows) as ExportWorksheet;
  sheet["!cols"] = [{ wch: 26 }, { wch: 64 }];
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  return sheet;
}

function columnWidth(value: ReportExportCell): number {
  return String(value ?? "").length;
}

/**
 * Numeric kg/amount cells keep their decimals as numbers (not text) so the
 * recipient can sum and pivot them; only the format is set here.
 */
function applyNumberFormats(sheet: ExportWorksheet, section: ReportExportSection): void {
  section.rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (typeof value !== "number") return;
      const column = section.columns[columnIndex] ?? "";
      if (!KG_COLUMN_PATTERN.test(column)) return;
      const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex });
      const cell = sheet[address];
      if (cell) cell.z = column.includes("Rate") ? "0.0" : "0.###";
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
      (width, row) => Math.max(width, columnWidth(row[columnIndex] ?? "")),
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
export function buildCustomerOrderConsumptionWorkbook(
  report: CustomerOrderConsumptionReportResponse
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
 * Downloads the workbook. The filename carries the cutoff because the same
 * report is re-run every month and the files land in one Downloads folder.
 */
export function exportCustomerOrderConsumptionWorkbook(
  report: CustomerOrderConsumptionReportResponse
): void {
  XLSX.writeFile(
    buildCustomerOrderConsumptionWorkbook(report),
    buildReportFilename("customer-order-consumption", report.filters, "xlsx")
  );
}
