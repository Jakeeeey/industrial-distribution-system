// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/utils/exportCustomerProfitabilityCsv.ts
// ==============================================================================
// Customer Profitability Report - CSV Export Utility
// Generates and downloads clean spreadsheet CSV with all audited metrics.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

import type { CustomerProfitabilityRow } from "../types/customer-profitability.types";

export function exportCustomerProfitabilityCsv(
  rows: CustomerProfitabilityRow[],
  filename = "Customer_Profitability_Report.csv"
): void {
  if (!rows || rows.length === 0) return;

  const headers = [
    "Customer Code",
    "Customer Name",
    "Store Name",
    "Branch",
    "City",
    "Province",
    "Invoices Count",
    "Total Billed Volume (kg)",
    "Gross Invoiced Sales (PHP)",
    "Sales Returns (PHP)",
    "Net Sales (PHP)",
    "Gas COGS (PHP)",
    "Gross Margin (PHP)",
    "Gross Margin %",
    "Allocated Delivery Cost (PHP)",
    "Incentives Amount (PHP)",
    "Cylinder Incident Cost (PHP)",
    "Contribution Margin (PHP)",
    "Contribution Margin %",
    "Profitability Tier",
    "Data Warnings",
  ];

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = [headers.join(",")];

  rows.forEach((r) => {
    csvRows.push(
      [
        escapeCsv(r.customerCode),
        escapeCsv(r.customerName),
        escapeCsv(r.storeName),
        escapeCsv(r.branchName),
        escapeCsv(r.city),
        escapeCsv(r.province),
        r.totalInvoicesCount,
        r.totalWeightKg,
        r.grossInvoicedSales,
        r.salesReturns,
        r.netSales,
        r.gasCogs,
        r.grossMargin,
        `${r.grossMarginPercent}%`,
        r.allocatedDeliveryCost,
        r.incentivesAmount,
        r.cylinderIncidentCost,
        r.contributionMargin,
        `${r.contributionMarginPercent}%`,
        escapeCsv(r.tier),
        escapeCsv(r.warningReasons.join("; ") || "None"),
      ].join(",")
    );
  });

  const blob = new Blob([csvRows.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
