// src/modules/industrial-distribution-system/bia/sales-analytics/sales-performance-report/utils/generateSalesPerformancePrintHtml.ts
// ==============================================================================
// Sales Performance Report - Printable HTML Generator
// Formats high-quality printable layout with executive summary, rankings, and signature blocks.
// ==============================================================================

import type { SalesPerformanceReportResponse } from "../types/sales-performance.types";
import type { SalesPerformanceFilterInput } from "../types/sales-performance.schema";

export function generateSalesPerformancePrintHtml(
  report: SalesPerformanceReportResponse,
  filters: SalesPerformanceFilterInput,
  branchLabel = "All Branches"
): string {
  const formatCurrency = (val: number) =>
    `₱${val.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const topRowsHtml = report.records
    .slice(0, 35)
    .map(
      (r, i) => `
    <tr>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${i + 1}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${r.invoiceNo}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;">${r.invoiceDate}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;">${r.customerName}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;">${r.branchName}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;">${r.productName}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${r.quantitySold}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${r.kgSold.toLocaleString()} kg</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${formatCurrency(r.grossAmount)}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; color: #dc2626;">-${formatCurrency(r.creditAmount)}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; color: #047857;">${formatCurrency(r.netSales)}</td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${r.taxTreatment}</td>
    </tr>
  `
    )
    .join("");

  const branchSummaryHtml = report.charts.branchComparison
    .map(
      (b) => `
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${b.branchName} (${b.branchCode})</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${b.invoiceCount}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${b.kgSold.toLocaleString()} kg</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; color: #047857;">${formatCurrency(b.netSales)}</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Sales Performance Report</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.35;
      font-size: 11px;
      margin: 0;
      padding: 0;
    }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
    .kpi-container { display: flex; gap: 12px; margin-bottom: 16px; }
    .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; }
    .kpi-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .kpi-val { font-size: 16px; font-weight: bold; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
    th { background: #f1f5f9; border: 1px solid #94a3b8; padding: 6px; font-weight: 700; text-align: left; }
    .sign-table { width: 100%; margin-top: 28px; page-break-inside: avoid; }
    .sign-box { width: 23%; text-align: center; }
    .sign-line { border-top: 1px solid #475569; margin-top: 40px; padding-top: 4px; font-weight: bold; font-size: 10px; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="vertical-align: top;">
        <h2 style="margin: 0 0 4px 0; font-size: 18px; color: #0f172a;">INDUSTRIAL DISTRIBUTION SYSTEM (IDS)</h2>
        <div style="font-size: 13px; font-weight: bold; color: #1e40af;">BIA Sales Analytics — Sales Performance Report</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Branch Scope: <strong>${branchLabel}</strong></div>
      </td>
      <td style="text-align: right; vertical-align: top;">
        <div>Period: <strong>${filters.startDate} to ${filters.endDate}</strong></div>
        <div>Cutoff: <strong>${report.metadata.cutoffTimestamp}</strong></div>
        <div>Printed On: <strong>${new Date().toLocaleString()}</strong></div>
      </td>
    </tr>
  </table>

  <div class="kpi-container">
    <div class="kpi-card" style="border-left: 4px solid #10b981;">
      <div class="kpi-label">Total Net Sales</div>
      <div class="kpi-val" style="color: #047857;">${formatCurrency(report.kpis.totalNetSales)}</div>
    </div>
    <div class="kpi-card" style="border-left: 4px solid #0284c7;">
      <div class="kpi-label">Total Gas Volume (Kg)</div>
      <div class="kpi-val" style="color: #0369a1;">${report.kpis.totalKgSold.toLocaleString()} kg</div>
    </div>
    <div class="kpi-card" style="border-left: 4px solid #8b5cf6;">
      <div class="kpi-label">Invoices / Orders</div>
      <div class="kpi-val">${report.kpis.totalInvoices} Invoices</div>
    </div>
    <div class="kpi-card" style="border-left: 4px solid #f59e0b;">
      <div class="kpi-label">Deducted Credits/Returns</div>
      <div class="kpi-val" style="color: #b45309;">${formatCurrency(report.kpis.totalCredits)}</div>
    </div>
  </div>

  <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase;">Branch Performance Overview</h4>
  <table>
    <thead>
      <tr>
        <th>Branch Name</th>
        <th style="text-align: right;">Total Invoices</th>
        <th style="text-align: right;">Total Gas Kg Sold</th>
        <th style="text-align: right;">Net Sales (PHP)</th>
      </tr>
    </thead>
    <tbody>
      ${branchSummaryHtml}
    </tbody>
  </table>

  <h4 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase;">Sales Transaction Line Items (${report.records.length} Records)</h4>
  <table>
    <thead>
      <tr>
        <th style="text-align: center; width: 30px;">#</th>
        <th>Invoice No</th>
        <th>Date</th>
        <th>Customer</th>
        <th>Branch</th>
        <th>Product Description</th>
        <th style="text-align: right;">Qty</th>
        <th style="text-align: right;">Kg Sold</th>
        <th style="text-align: right;">Gross</th>
        <th style="text-align: right;">Credit</th>
        <th style="text-align: right;">Net Sales</th>
        <th style="text-align: center;">Tax</th>
      </tr>
    </thead>
    <tbody>
      ${topRowsHtml}
    </tbody>
  </table>

  <table class="sign-table">
    <tr>
      <td class="sign-box">
        <div class="sign-line">Prepared By / Sales Admin</div>
      </td>
      <td style="width: 2%;"></td>
      <td class="sign-box">
        <div class="sign-line">Reviewed By / Branch Manager</div>
      </td>
      <td style="width: 2%;"></td>
      <td class="sign-box">
        <div class="sign-line">Reconciled By / Finance</div>
      </td>
      <td style="width: 2%;"></td>
      <td class="sign-box">
        <div class="sign-line">Approved By / General Management</div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
