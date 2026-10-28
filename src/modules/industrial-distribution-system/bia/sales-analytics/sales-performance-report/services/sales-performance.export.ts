// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/services/sales-performance.export.ts
// ==============================================================================
// Sales Performance Report - Multi-tab Excel Export Utility
// Generates structured .xlsx file with Summary, Line Items, and Customer Rankings.
// ==============================================================================

import * as XLSX from "xlsx";
import type { SalesPerformanceReportResponse } from "../types/sales-performance.types";
import type { SalesPerformanceFilterInput } from "../types/sales-performance.schema";

export function exportSalesPerformanceToExcel(
  report: SalesPerformanceReportResponse,
  filters: SalesPerformanceFilterInput
): void {
  const wb = XLSX.utils.book_new();

  // Tab 1: Executive KPI Summary
  const summaryData = [
    ["INDUSTRIAL DISTRIBUTION SYSTEM - SALES PERFORMANCE REPORT"],
    [`Generated: ${new Date().toLocaleString()}`],
    [`Reporting Period: ${filters.startDate} to ${filters.endDate}`],
    [`Cutoff Time: ${report.metadata.cutoffTimestamp}`],
    [],
    ["EXECUTIVE METRICS", "VALUE"],
    ["Total Net Sales (PHP)", report.kpis.totalNetSales],
    ["Total Gross Sales (PHP)", report.kpis.totalGrossSales],
    ["Total Deducted Returns / Credits (PHP)", report.kpis.totalCredits],
    ["Total Industrial Gas Sold (Kg)", report.kpis.totalKgSold],
    ["Total Invoice Transactions", report.kpis.totalInvoices],
    ["Average Order Value (PHP)", report.kpis.averageOrderValue],
    ["VAT 12% Sales (PHP)", report.kpis.vatSalesTotal],
    ["Non-VAT / Exempt Sales (PHP)", report.kpis.nonVatSalesTotal],
    ["Overall Revenue per Kg (PHP/kg)", report.kpis.overallKgRate],
    [],
    ["BRANCH COMPARISON", "NET SALES (PHP)", "KG SOLD", "INVOICES", "AVG TICKET (PHP)"],
    ...report.charts.branchComparison.map((b) => [
      `${b.branchName} (${b.branchCode})`,
      b.netSales,
      b.kgSold,
      b.invoiceCount,
      b.averageTicket,
    ]),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

  // Tab 2: Detailed Line Items
  const detailHeaders = [
    "Invoice No",
    "Order ID",
    "Invoice Date",
    "Customer Code",
    "Customer Name",
    "Store Name",
    "Branch",
    "Salesman",
    "Product Code",
    "Product Description",
    "Serialized Cylinder?",
    "Unit Price (PHP)",
    "Qty Sold",
    "Kg Sold",
    "Gross Amount (PHP)",
    "Discount (PHP)",
    "Deducted Credit (PHP)",
    "Net Sales (PHP)",
    "Tax Treatment",
    "Status",
  ];

  const detailRows = report.records.map((r) => [
    r.invoiceNo,
    r.orderId,
    r.invoiceDate,
    r.customerCode,
    r.customerName,
    r.storeName,
    r.branchName,
    r.salesmanName,
    r.productCode,
    r.productName,
    r.isSerialized ? "Yes" : "No",
    r.unitPrice,
    r.quantitySold,
    r.kgSold,
    r.grossAmount,
    r.discountAmount,
    r.creditAmount,
    r.netSales,
    r.taxTreatment,
    r.transactionStatus,
  ]);

  const wsDetails = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  XLSX.utils.book_append_sheet(wb, wsDetails, "Sales Line Details");

  // Tab 3: Customer Rankings
  const custRankHeaders = [
    "Rank",
    "Customer Code",
    "Customer Name",
    "Store Name",
    "Branch",
    "Total Kg Sold",
    "Total Net Sales (PHP)",
  ];

  const custRankRows = report.rankings.topCustomers.map((c, idx) => [
    idx + 1,
    c.customerCode,
    c.customerName,
    c.storeName,
    c.branchName,
    c.totalKgSold,
    c.totalNetSales,
  ]);

  const wsCustRank = XLSX.utils.aoa_to_sheet([custRankHeaders, ...custRankRows]);
  XLSX.utils.book_append_sheet(wb, wsCustRank, "Top Customers");

  const fileName = `Sales_Performance_Report_${filters.startDate}_to_${filters.endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
