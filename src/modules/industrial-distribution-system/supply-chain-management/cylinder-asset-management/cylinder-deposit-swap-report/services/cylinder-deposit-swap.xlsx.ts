// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/services/cylinder-deposit-swap.xlsx.ts
// ==============================================================================
// Excel Export Generator for Cylinder Deposit and Swap Report.
// Multi-tab workbook: Executive Summary, Customer Summaries, and Product Lines.
// ==============================================================================

import * as XLSX from "xlsx";
import type { CylinderDepositSwapReportResponse } from "../types/cylinder-deposit-swap.types";

/**
 * Generates and triggers download of a standardized Excel workbook (.xlsx).
 */
export function exportCylinderDepositSwapToExcel(
  report: CylinderDepositSwapReportResponse,
  filenamePrefix: string = "Cylinder_Deposit_and_Swap_Report"
): void {
  const workbook = XLSX.utils.book_new();

  // ── Sheet 1: Executive Summary & KPIs ───────────────────────────────────────
  const summaryRows = [
    ["INDUSTRIAL DISTRIBUTION SYSTEM - SUPPLY CHAIN MANAGEMENT"],
    ["CYLINDER DEPOSIT AND SWAP REPORT - EXECUTIVE SUMMARY"],
    ["Generated At", report.generatedAt],
    ["Reporting Period", `${report.filters.startDate} to ${report.filters.endDate}`],
    [],
    ["KEY PERFORMANCE INDICATORS", "VALUE"],
    ["Total Active Customer Cylinder Base", report.kpis.totalActiveCustomerBase],
    ["Period New Deposits Delivered (+)", report.kpis.totalPeriodDeposits],
    ["Period Empty Swaps Collected (In)", report.kpis.totalPeriodSwapsReturned],
    ["Period Full Swaps Delivered (Out)", report.kpis.totalPeriodSwapsDelivered],
    ["Period Pull-Outs / De-taggings (-)", report.kpis.totalPeriodPullOuts],
    ["Stagnant / Over-aged Cylinders (>60 Days)", report.kpis.totalStagnantCylinders],
    ["Total Customers Audited", report.kpis.totalCustomersAudited],
    [],
    ["LIFECYCLE STATUS DISTRIBUTION", "COUNT"],
    ["Circulating (Active <= 30 Days)", report.kpis.lifecycle.circulating],
    ["Idle Warning (31 - 60 Days)", report.kpis.lifecycle.idleWarning],
    ["Idle Critical (> 60 Days)", report.kpis.lifecycle.idleCritical],
    ["Under Maintenance / Damaged", report.kpis.lifecycle.underMaintenance],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Overview & KPIs");

  // ── Sheet 2: Customer Aggregation Master (Doc §11 Proposed Columns) ─────────
  const customerHeaders = [
    "Customer Code",
    "Customer Name",
    "Site / Store",
    "Branch",
    "Date",
    "Deposit Qty",
    "Swap Qty",
    "Ownership",
    "Running Base",
    "Reference",
    "Opening Base",
    "Pull-Outs (-)",
    "Net Delta",
  ];

  const customerData = report.rows.map((row) => [
    row.customerCode,
    row.customerName,
    row.siteName || row.storeName || "",
    row.branchName || "",
    row.date || row.lastTransactionDate || "N/A",
    row.depositQty,
    row.swapQty,
    row.ownership || "COMPANY",
    row.runningBase,
    row.reference || "",
    row.totalOpeningBase,
    row.totalDepositsPulledOut,
    row.totalNetVariance,
  ]);

  const customerSheet = XLSX.utils.aoa_to_sheet([customerHeaders, ...customerData]);
  customerSheet["!cols"] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 24 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];
  customerSheet["!autofilter"] = { ref: `A1:M${customerData.length + 1}` };
  XLSX.utils.book_append_sheet(workbook, customerSheet, "Customer Base Summary");

  // ── Sheet 3: Product Breakdown by Customer ──────────────────────────────────
  const productHeaders = [
    "Customer Code",
    "Customer Name",
    "Branch",
    "Product Code",
    "Product Name",
    "Opening Base",
    "Deposits (+)",
    "Swaps In",
    "Swaps Out",
    "Pull-Outs (-)",
    "Net Variance",
    "Closing Base",
    "Active (<30d)",
    "Idle (>30d)",
  ];

  const productData: (string | number)[][] = [];
  report.rows.forEach((row) => {
    row.products.forEach((prod) => {
      productData.push([
        row.customerCode,
        row.customerName,
        row.branchName || "",
        prod.productCode,
        prod.productName,
        prod.openingBase,
        prod.depositsDelivered,
        prod.swapsInbound,
        prod.swapsOutbound,
        prod.depositsPulledOut,
        prod.netSwapVariance,
        prod.closingBase,
        prod.circulatingQty,
        prod.idleQty,
      ]);
    });
  });

  const productSheet = XLSX.utils.aoa_to_sheet([productHeaders, ...productData]);
  productSheet["!cols"] = [
    { wch: 16 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];
  productSheet["!autofilter"] = { ref: `A1:N${productData.length + 1}` };
  XLSX.utils.book_append_sheet(workbook, productSheet, "Product Breakdown");

  // Write and trigger download
  const dateStamp = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `${filenamePrefix}_${dateStamp}.xlsx`);
}
