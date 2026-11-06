// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/services/customer-cylinder-accountability.xlsx.ts
// ==============================================================================
// Excel (.xlsx) Export Generator for Customer Cylinder Accountability Report
// Generates a multi-tab workbook adhering to VoSync Design System standards:
// - Tab 1: Executive KPI Summary & Audit Metadata
// - Tab 2: Customer Balance Reconciliation Grid (Opening, Deposits, Swaps, Closing)
//
// Complies with VoSync standards:
// - Full comments left behind for long-term maintainability
// ==============================================================================

import * as XLSX from "xlsx";
import type { CustomerAccountabilityReportResponse } from "../types/customer-cylinder-accountability.types";

/**
 * Generates and downloads a standardized Excel (.xlsx) audit workbook.
 */
export function exportAccountabilityToExcel(
  report: CustomerAccountabilityReportResponse,
  filenamePrefix: string = "Customer_Cylinder_Accountability_Report"
): void {
  const workbook = XLSX.utils.book_new();

  // ── Sheet 1: Executive Summary & Audit Cutoff ──────────────────────────────
  const summaryRows = [
    ["VOSYNC INDUSTRIAL DISTRIBUTION SYSTEM - BIA"],
    ["CUSTOMER CYLINDER ACCOUNTABILITY REPORT - EXECUTIVE RECONCILIATION SUMMARY"],
    ["Reporting Cutoff Date", report.reportingCutoff],
    ["Report Generated At (UTC+8)", report.generatedAt],
    [],
    ["METRIC", "QUANTITY"],
    ["Total Opening Cylinder Base", report.kpis.totalOpeningBase],
    ["Period Cylinder Deposits Issued (+)", report.kpis.totalPeriodDeposits],
    ["Period Cylinder Swaps Circulated", report.kpis.totalPeriodSwaps],
    ["Period Cylinder Pull-Outs / Returns (-)", report.kpis.totalPeriodPullOuts],
    ["Total Closing / Running Cylinder Base", report.kpis.totalClosingBase],
    ["Active Customer Accounts", report.kpis.activeCustomerAccounts],
    ["Verified Source Records", report.kpis.totalVerifiedRecords],
    ["Audit Exceptions / Unreconciled Flags", report.kpis.totalExceptions],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Executive Summary");

  // ── Sheet 2: Customer Ledger Master Grid ───────────────────────────────────
  const customerHeaders = [
    "Customer Code",
    "Customer Name",
    "Store Name",
    "Branch",
    "Ownership",
    "Opening Base",
    "Deposit Qty (+)",
    "Swap Qty",
    "Net Swap Change",
    "Pull-Out Qty (-)",
    "Running / Closing Base",
    "Last Transaction Date",
    "Last Reference No",
    "Verified Records",
    "Exception Count",
  ];

  const customerData = report.rows.map((row) => [
    row.customerCode,
    row.customerName,
    row.storeName || "—",
    row.branchName,
    row.ownership,
    row.openingBase,
    row.periodDeposits,
    row.periodSwaps,
    row.periodNetSwapChange,
    row.periodPullOuts,
    row.closingBase,
    row.lastTransactionDate || "—",
    row.lastReferenceNo || "—",
    row.verifiedTransactionsCount,
    row.exceptionCount,
  ]);

  const customerSheet = XLSX.utils.aoa_to_sheet([customerHeaders, ...customerData]);
  customerSheet["!cols"] = [
    { wch: 16 }, // Code
    { wch: 30 }, // Name
    { wch: 25 }, // Store
    { wch: 20 }, // Branch
    { wch: 14 }, // Ownership
    { wch: 14 }, // Opening Base
    { wch: 15 }, // Deposits
    { wch: 14 }, // Swaps
    { wch: 16 }, // Net Swap
    { wch: 15 }, // Pull-outs
    { wch: 20 }, // Closing Base
    { wch: 22 }, // Last Date
    { wch: 22 }, // Reference No
    { wch: 16 }, // Verified Records
    { wch: 16 }, // Exceptions
  ];

  XLSX.utils.book_append_sheet(workbook, customerSheet, "Customer Accountability");

  // ── Trigger Browser Download ───────────────────────────────────────────────
  const cleanDate = report.reportingCutoff.replace(/[^0-9]/g, "");
  const filename = `${filenamePrefix}_${cleanDate || "Audit"}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
