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
    ["Total Opening Holdings", report.kpis.totalOpeningBase],
    ["Period Cylinder Issues (+)", report.kpis.totalPeriodDeposits],
    ["Period Cylinder Swaps Circulated", report.kpis.totalPeriodSwaps],
    ["Period Cylinder Returns (-)", report.kpis.totalPeriodPullOuts],
    ["Total Current Held (=)", report.kpis.totalClosingBase],
    ["Total Authorized Fleet Quota", report.kpis.totalAuthorizedLimit],
    ["Net Fleet Holding Variance", report.kpis.totalVariance],
    ["Accounts Exceeding Authorized Quota", report.kpis.overLimitCount],
    ["Active Customer Accounts", report.kpis.activeCustomerAccounts],
    ["Verified Source Records", report.kpis.totalVerifiedRecords],
    ["Audit Exceptions / Unreconciled Flags", report.kpis.totalExceptions],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Executive Summary");

  // ── Sheet 2: Customer Ledger Master Grid (SNET Spec v1.0 §11) ──────────────
  const customerHeaders = [
    "Customer Code",
    "Customer Name",
    "Site",
    "Ownership",
    "Opening",
    "Issued (+)",
    "Swaps Circulated",
    "Returned (-)",
    "Held (=)",
    "Authorized Limit",
    "Variance",
    "Last Transaction Date",
    "Last Reference No",
    "Verified Records",
    "Exception Count",
  ];

  const customerData = report.rows.map((row) => [
    row.customerCode,
    row.customerName,
    row.siteName || row.branchName,
    row.ownership,
    row.opening ?? row.openingBase,
    row.issued ?? row.periodDeposits,
    row.periodSwaps,
    row.returned ?? row.periodPullOuts,
    row.held ?? row.closingBase,
    row.authorizedLimit,
    row.variance,
    row.lastTransactionDate || "—",
    row.lastReferenceNo || "—",
    row.verifiedTransactionsCount,
    row.exceptionCount,
  ]);

  const customerSheet = XLSX.utils.aoa_to_sheet([customerHeaders, ...customerData]);
  customerSheet["!cols"] = [
    { wch: 16 }, // Code
    { wch: 30 }, // Name
    { wch: 20 }, // Site
    { wch: 14 }, // Ownership
    { wch: 14 }, // Opening
    { wch: 15 }, // Issued
    { wch: 16 }, // Swaps
    { wch: 15 }, // Returned
    { wch: 16 }, // Held
    { wch: 16 }, // Limit
    { wch: 14 }, // Variance
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
