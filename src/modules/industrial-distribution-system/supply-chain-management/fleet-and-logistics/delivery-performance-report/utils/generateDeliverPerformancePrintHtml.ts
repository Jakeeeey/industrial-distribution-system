// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/utils/generateDeliverPerformancePrintHtml.ts
// ==============================================================================
// Delivery Performance Report - Printable HTML Generator
// Browser-friendly printable layout incorporating company header,
// status distributions, and complete formatted audit lines.
// ==============================================================================

import type { DeliverPerformanceResponse } from "../types/deliver-performance.types";
import type { DeliverPerformanceFilterInput } from "../types/deliver-performance.schema";

interface CompanyProfileData {
  company_name?: string;
  company_logo?: string;
  company_address?: string;
  company_contact?: string;
  company_email?: string;
}

export function generateDeliverPerformancePrintHtml(
  report: DeliverPerformanceResponse,
  filters: DeliverPerformanceFilterInput,
  company: CompanyProfileData | null,
  branchLabel = "All Branches"
): string {
  const formatCurrency = (val: number) =>
    `₱${val.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rowsHtml = report.records
    .slice(0, 100)
    .map(
      (r, i) => `
    <tr>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${i + 1}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${r.waybillNo}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;">${r.invoiceNo}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;">${r.dispatchDate}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;">${r.customerName}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;">${r.branchName}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px;">${r.driverName}</td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${r.status}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px;">${r.totalQuantity}</td>
      <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${formatCurrency(r.netAmount)}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11px;">${r.remarks || "-"}</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Delivery Performance Report</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 12px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .company-title { font-size: 18px; font-weight: 700; color: #0f172a; }
    .company-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .report-title { font-size: 16px; font-weight: 700; color: #0f172a; text-align: right; }
    .meta-text { font-size: 11px; color: #64748b; text-align: right; }
    .kpi-grid { display: flex; gap: 12px; margin-bottom: 16px; }
    .kpi-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; background: #f8fafc; }
    .kpi-title { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .kpi-value { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #1e293b; color: #ffffff; padding: 6px; border: 1px solid #cbd5e1; text-align: left; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; color: #475569; }
    .sign-box { border-top: 1px solid #94a3b8; width: 180px; text-align: center; padding-top: 6px; margin-top: 36px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">${company?.company_name || "INDUSTRIAL DISTRIBUTION SYSTEM"}</div>
      <div class="company-sub">${company?.company_address || "Operations & Supply Chain Logistics"}</div>
      <div class="company-sub">${[company?.company_contact, company?.company_email].filter(Boolean).join(" | ")}</div>
    </div>
    <div>
      <div class="report-title">DELIVERY PERFORMANCE REPORT</div>
      <div class="meta-text">Period: ${filters.startDate || "Beginning"} to ${filters.endDate || "Present"}</div>
      <div class="meta-text">Branch: ${branchLabel}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Total Trips</div>
      <div class="kpi-value">${report.kpis.totalDeliveries.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Fulfillment Rate</div>
      <div class="kpi-value" style="color: #059669;">${report.kpis.fulfillmentRate}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">On-Time Performance</div>
      <div class="kpi-value" style="color: #4f46e5;">${report.kpis.onTimeRate}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Concerns / Returns</div>
      <div class="kpi-value" style="color: #d97706;">${(report.kpis.fulfilledWithConcernsCount + report.kpis.fulfilledWithReturnsCount).toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Net Delivered Sales</div>
      <div class="kpi-value" style="color: #0f172a;">${formatCurrency(report.kpis.totalNetAmount)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">#</th>
        <th>Waybill No</th>
        <th>Invoice No</th>
        <th>Dispatch Date</th>
        <th>Customer</th>
        <th>Branch</th>
        <th>Driver</th>
        <th style="text-align: center;">Status</th>
        <th style="text-align: right;">Quantity</th>
        <th style="text-align: right;">Net Amount</th>
        <th>Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>
      <div class="sign-box">Prepared By / Fleet Admin</div>
    </div>
    <div>
      <div class="sign-box">Reviewed By / Logistics Lead</div>
    </div>
    <div>
      <div class="sign-box">Approved By / Operations Manager</div>
    </div>
  </div>
</body>
</html>
  `;
}

