// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/lost-and-damaged-cylinder-report/utils/generateLostDamagedPrintHtml.ts
// ==============================================================================
// HTML Generator for Lost and Damaged Cylinder Report Print Layout
// Formats an audit-grade physical document compatible with TracingReportPreviewModal
// and browser print workflows.
// ==============================================================================

import type { LostDamagedReportResponse } from "../types/lost-damaged-cylinder.types";
import type { LostDamagedFilterInput } from "../types/lost-damaged-cylinder.schema";

export function generateLostDamagedPrintHtml(
  report: LostDamagedReportResponse,
  filters: Partial<LostDamagedFilterInput>,
  branchName = "All Branches"
): string {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val);
  };

  const periodText =
    filters.datePreset === "CUSTOM" && (filters.startDate || filters.endDate)
      ? `${filters.startDate || "Beginning"} to ${filters.endDate || "Present"}`
      : filters.datePreset || "All Time";

  const rowsHtml = report.rows
    .map(
      (r, idx) => `
    <tr>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px;">${idx + 1}</td>
      <td style="font-family: monospace; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px;">${r.incidentNo}</td>
      <td style="font-family: monospace; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px;">${r.serialNumber}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px;">
        <div style="font-weight: 600;">${r.productName}</div>
        <div style="font-size: 9px; color: #64748b;">${r.productCode} (${r.tareWeight} kg)</div>
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px;">
        <div>${r.custodianName}</div>
        <div style="font-size: 9px; color: #64748b;">${r.custodianType} · ${r.branchName}</div>
      </td>
      <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px;">${r.incidentCategory}</td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px;">${r.condition}</td>
      <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px;">${r.status}</td>
      <td style="text-align: right; font-weight: 600; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px;">${formatCurrency(r.assessedValue)}</td>
      <td style="font-family: monospace; text-align: center; border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px;">${r.writeOffDocNo || r.recoveryDocNo || r.supportingDocNo}</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Lost and Damaged Cylinder Report</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      margin-bottom: 14px;
    }
    .report-title {
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: -0.01em;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    .report-meta {
      font-size: 11px;
      color: #475569;
      display: flex;
      gap: 20px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .summary-card {
      border: 1px solid #cbd5e1;
      background-color: #f8fafc;
      border-radius: 6px;
      padding: 8px 12px;
    }
    .summary-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 2px;
    }
    .summary-value {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    .table-container {
      width: 100%;
      margin-top: 10px;
    }
    table {
      width: 100% !important;
      border-collapse: collapse;
      table-layout: fixed !important;
    }
    th {
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 6px 4px;
      font-size: 8.5px;
      text-transform: uppercase;
      font-weight: 700;
      color: #334155;
      letter-spacing: 0.02em;
      white-space: nowrap !important;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 5px 4px;
      font-size: 9.5px;
      line-height: 1.25;
      vertical-align: middle;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .signoff-section {
      margin-top: 36px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      page-break-inside: avoid;
    }
    .signoff-box {
      border-top: 1px solid #0f172a;
      padding-top: 6px;
      text-align: center;
    }
    .signoff-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }
    .signoff-role {
      font-size: 9px;
      color: #64748b;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="report-title">Lost and Damaged Cylinder Report</div>
    <div class="report-meta">
      <div><strong>Branch:</strong> ${branchName}</div>
      <div><strong>Period:</strong> ${periodText}</div>
      <div><strong>Cutoff Timestamp:</strong> ${report.reportingCutoff}</div>
      <div><strong>Total Records:</strong> ${report.totalCount}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Incidents</div>
      <div class="summary-value">${report.kpis.totalIncidents} (${report.kpis.lostCount} Lost · ${report.kpis.damagedCount} Damaged)</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Assessed Loss</div>
      <div class="summary-value">${formatCurrency(report.kpis.totalLossValue)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Recovered Cylinders</div>
      <div class="summary-value">${report.kpis.recoveredCount} units (${report.kpis.recoveryRate}%)</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Unsettled Charges</div>
      <div class="summary-value">${formatCurrency(report.kpis.unsettledChargesValue)}</div>
    </div>
  </div>

  <div class="table-container">
    <table>
      <colgroup>
        <col style="width: 3.5%;" />
        <col style="width: 9.5%;" />
        <col style="width: 10.5%;" />
        <col style="width: 18%;" />
        <col style="width: 17%;" />
        <col style="width: 8.5%;" />
        <col style="width: 8%;" />
        <col style="width: 8%;" />
        <col style="width: 9%;" />
        <col style="width: 8%;" />
      </colgroup>
      <thead>
        <tr>
          <th style="text-align: center;">#</th>
          <th style="text-align: left;">Incident #</th>
          <th style="text-align: left;">Serial No</th>
          <th style="text-align: left;">Product</th>
          <th style="text-align: left;">Custodian / Location</th>
          <th style="text-align: center;">Category</th>
          <th style="text-align: center;">Condition</th>
          <th style="text-align: center;">Status</th>
          <th style="text-align: right;">Value</th>
          <th style="text-align: center;">Support Doc</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="10" style="text-align: center; padding: 20px; font-size: 11px; color: #64748b;">No records found for the selected reporting period.</td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="signoff-section">
    <div class="signoff-box">
      <div class="signoff-title">Prepared By</div>
      <div class="signoff-role">Inventory Clerk / Encoder</div>
    </div>
    <div class="signoff-box">
      <div class="signoff-title">Verified By</div>
      <div class="signoff-role">Internal Audit / Inventory Controller</div>
    </div>
    <div class="signoff-box">
      <div class="signoff-title">Approved By</div>
      <div class="signoff-role">Branch Operations Manager</div>
    </div>
  </div>
</body>
</html>
  `;
}
