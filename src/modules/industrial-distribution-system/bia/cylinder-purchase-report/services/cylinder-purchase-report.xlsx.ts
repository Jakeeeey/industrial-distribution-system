import * as XLSX from "xlsx";

import type {
  CustomerPurchaseSummary,
  CylinderPurchaseDashboardResponse,
  CylinderPurchaseDashboardView,
} from "@/modules/industrial-distribution-system/bia/cylinder-purchase-report/types/cylinder-purchase-report.types";

import {
  buildConsolidatedExportSections,
  buildDashboardExportSections,
  buildReportFilterContext,
  type ReportExportCell,
  type ReportExportSection,
} from "./cylinder-purchase-report.export-model.ts";
import { buildReportFilename } from "./cylinder-purchase-report.pdf.ts";

type ExportWorksheet = XLSX.WorkSheet & {
  "!freeze"?: { xSplit: number; ySplit: number };
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(date);
}

function buildFiltersSheet(
  report: CylinderPurchaseDashboardResponse,
): ExportWorksheet {
  const { filters } = report;
  const rows: ReportExportCell[][] = [
    ["Filter", "Applied Value"],
    ...buildReportFilterContext(filters).map(
      ({ label, value }): ReportExportCell[] => [label, value],
    ),
    ["Generated At", formatTimestamp(report.generatedAt)],
    ["Overview - Gross Purchased", report.overview.grossPurchasedQty],
    ["Overview - Returned Cylinders", report.overview.returnedQty],
    ["Overview - Net Purchased", report.overview.netPurchasedQty],
    ["Overview - Unique Customers", report.overview.uniqueCustomers],
    ["Overview - Serialized Products", report.overview.serializedProducts],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows) as ExportWorksheet;
  rows.forEach((row, rowIndex) => {
    if (typeof row[1] !== "number") return;
    const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: 1 })];
    if (cell) cell.z = "0.###";
  });
  sheet["!cols"] = [{ wch: 34 }, { wch: 32 }];
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  sheet["!autofilter"] = { ref: `A1:B${rows.length}` };
  return sheet;
}

function displayWidth(value: ReportExportCell): number {
  return typeof value === "number" ? String(value).length : value.length;
}

function applyNumberFormats(
  sheet: ExportWorksheet,
  section: ReportExportSection,
): void {
  section.rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (typeof value !== "number") return;
      const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex });
      const cell = sheet[address];
      if (!cell) return;
      const column = section.columns[columnIndex];
      cell.z = column === "Return Rate" ? "0.00%" : "0.###";
    });
  });
}

function buildSectionSheet(section: ReportExportSection): ExportWorksheet {
  const sheet = XLSX.utils.aoa_to_sheet([
    section.columns,
    ...section.rows,
  ]) as ExportWorksheet;
  sheet["!cols"] = section.columns.map((column, columnIndex) => {
    const widestCell = section.rows.reduce(
      (width, row) => Math.max(width, displayWidth(row[columnIndex] ?? "")),
      column.length,
    );
    return { wch: Math.min(Math.max(widestCell + 2, 12), 40) };
  });
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  sheet["!autofilter"] = {
    ref: `A1:${XLSX.utils.encode_col(Math.max(section.columns.length - 1, 0))}${Math.max(section.rows.length + 1, 1)}`,
  };
  applyNumberFormats(sheet, section);
  return sheet;
}

function safeSheetName(title: string, usedNames: Set<string>): string {
  const base = title
    .replace(/[\\/?*:[\]]/g, " ")
    .replace(/^'+|'+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "Report";
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    const marker = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function buildWorkbook(
  report: CylinderPurchaseDashboardResponse,
  sections: ReportExportSection[],
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  XLSX.utils.book_append_sheet(workbook, buildFiltersSheet(report), "Filters");
  usedNames.add("Filters");

  for (const section of sections) {
    XLSX.utils.book_append_sheet(
      workbook,
      buildSectionSheet(section),
      safeSheetName(section.title, usedNames),
    );
  }
  return workbook;
}

export function buildDashboardWorkbook(
  report: CylinderPurchaseDashboardResponse,
  view: CylinderPurchaseDashboardView,
  selectedCustomer: CustomerPurchaseSummary | null = null,
): XLSX.WorkBook {
  return buildWorkbook(
    report,
    buildDashboardExportSections(report, view, selectedCustomer),
  );
}

export function buildConsolidatedWorkbook(
  report: CylinderPurchaseDashboardResponse,
): XLSX.WorkBook {
  return buildWorkbook(report, buildConsolidatedExportSections(report));
}

export function exportDashboardWorkbook(
  report: CylinderPurchaseDashboardResponse,
  view: CylinderPurchaseDashboardView,
  selectedCustomer: CustomerPurchaseSummary | null = null,
): void {
  XLSX.writeFile(
    buildDashboardWorkbook(report, view, selectedCustomer),
    buildReportFilename(
      selectedCustomer ? "customer-detail" : view,
      report.filters,
      "xlsx",
    ),
  );
}

export function exportConsolidatedWorkbook(
  report: CylinderPurchaseDashboardResponse,
): void {
  XLSX.writeFile(
    buildConsolidatedWorkbook(report),
    buildReportFilename("consolidated", report.filters, "xlsx"),
  );
}
