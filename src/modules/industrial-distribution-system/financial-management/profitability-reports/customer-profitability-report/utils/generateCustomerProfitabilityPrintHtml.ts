// src/modules/industrial-distribution-system/financial-management/profitability-reports/customer-profitability-report/utils/generateCustomerProfitabilityPrintHtml.ts
// ==============================================================================
// Customer Profitability Report - Printable HTML Generator
// Formats high-fidelity A4 document for window.print() with KPI summary,
// account ranking table, and signature/approval section.
//
// Dev-Rule: Always leave behind comments on all changes and development of workflows
// for efficient long-term coding.
// ==============================================================================

import type { CustomerProfitabilityReportResponse } from "../types/customer-profitability.types";

export function generateCustomerProfitabilityPrintHtml(
  report: CustomerProfitabilityReportResponse,
  branchLabel: string
): string {
  const { kpis, rows, reportingPeriod } = report;
  const printDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const tableRows = rows
    .map(
      (r, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td><strong>${escapeHtml(r.customerCode)}</strong><br/><small style="color: #64748b;">${escapeHtml(
        r.customerName
      )}</small></td>
      <td>${escapeHtml(r.storeName)}</td>
      <td>${escapeHtml(r.branchName)}</td>
      <td style="text-align: right;">${r.totalWeightKg.toLocaleString()} kg</td>
      <td style="text-align: right;">₱${r.netSales.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}</td>
      <td style="text-align: right;">₱${r.gasCogs.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}</td>
      <td style="text-align: right; color: ${r.grossMargin >= 0 ? "#15803d" : "#b91c1c"};">
        ₱${r.grossMargin.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}<br/>
        <small>(${r.grossMarginPercent}%)</small>
      </td>
      <td style="text-align: right;">₱${r.allocatedDeliveryCost.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}</td>
      <td style="text-align: right; font-weight: bold; color: ${
        r.contributionMargin >= 0 ? "#15803d" : "#b91c1c"
      };">
        ₱${r.contributionMargin.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}<br/>
        <small>(${r.contributionMarginPercent}%)</small>
      </td>
      <td style="text-align: center;">
        <span class="badge ${r.tier.toLowerCase()}">${r.tier}</span>
      </td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Customer Profitability Report - ${printDate}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
      margin: 0;
      padding: 10px;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .report-subtitle {
      font-size: 12px;
      color: #475569;
      margin: 2px 0 0 0;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .meta-box strong {
      color: #0f172a;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 12px;
      background: #f8fafc;
    }
    .kpi-title {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #475569;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-sub {
      font-size: 9px;
      color: #64748b;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 20px;
    }
    th {
      background-color: #0f172a;
      color: #ffffff;
      font-weight: 700;
      padding: 6px 8px;
      text-align: left;
      border: 1px solid #0f172a;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge.high { background: #dcfce7; color: #166534; }
    .badge.moderate { background: #dbeafe; color: #1e40af; }
    .badge.marginal { background: #fef9c3; color: #854d0e; }
    .badge.loss { background: #fee2e2; color: #991b1b; }
    .badge.incomplete { background: #f1f5f9; color: #475569; }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      padding-top: 10px;
      page-break-inside: avoid;
    }
    .sign-box {
      width: 220px;
      border-top: 1px solid #475569;
      text-align: center;
      padding-top: 6px;
      font-size: 10px;
    }
    .sign-title {
      font-weight: 700;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="brand-title">INDUSTRIAL DISTRIBUTION SYSTEM</h1>
      <p class="report-subtitle">Customer Profitability & Operational Contribution Report</p>
    </div>
    <div class="meta-box">
      <div>Reporting Period: <strong>${escapeHtml(reportingPeriod.startDate)} to ${escapeHtml(
    reportingPeriod.endDate
  )}</strong></div>
      <div>Authorized Branch: <strong>${escapeHtml(branchLabel)}</strong></div>
      <div>Date Generated: <strong>${printDate}</strong></div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Total Net Invoiced Sales</div>
      <div class="kpi-value">₱${kpis.totalNetSales.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}</div>
      <div class="kpi-sub">Across ${kpis.totalCustomersCount} active accounts</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Gross Margin</div>
      <div class="kpi-value">₱${kpis.totalGrossMargin.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}</div>
      <div class="kpi-sub">${kpis.averageGrossMarginPercent}% Avg Gross Margin</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Contribution Margin</div>
      <div class="kpi-value" style="color: ${
        kpis.totalContributionMargin >= 0 ? "#15803d" : "#b91c1c"
      };">₱${kpis.totalContributionMargin.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}</div>
      <div class="kpi-sub">${kpis.averageContributionMarginPercent}% After Operating Costs</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Profitable Accounts</div>
      <div class="kpi-value">${kpis.profitableCustomersCount} / ${kpis.totalCustomersCount}</div>
      <div class="kpi-sub">${kpis.lossMakingCustomersCount} accounts in loss position</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25px;">#</th>
        <th>Customer</th>
        <th>Store Name</th>
        <th>Branch</th>
        <th style="text-align: right;">Billed (kg)</th>
        <th style="text-align: right;">Net Sales</th>
        <th style="text-align: right;">Gas COGS</th>
        <th style="text-align: right;">Gross Margin</th>
        <th style="text-align: right;">Delivery Costs</th>
        <th style="text-align: right;">Contribution</th>
        <th style="text-align: center;">Tier</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="11" style="text-align: center; padding: 20px;">No customer records found for this period.</td></tr>`}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sign-box">
      <div class="sign-title">Prepared by</div>
      <div style="color: #64748b; margin-top: 2px;">Sales & Operations Analyst</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">Reviewed by</div>
      <div style="color: #64748b; margin-top: 2px;">Finance / Accounting Manager</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">Approved by</div>
      <div style="color: #64748b; margin-top: 2px;">General Manager / VP of Finance</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
