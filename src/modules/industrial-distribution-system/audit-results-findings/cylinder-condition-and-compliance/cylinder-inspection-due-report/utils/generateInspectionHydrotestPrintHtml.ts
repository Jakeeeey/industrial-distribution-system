// src/modules/industrial-distribution-system/audit-results-findings/cylinder-condition-and-compliance/cylinder-inspection-due-report/utils/generateInspectionHydrotestPrintHtml.ts
// ==============================================================================
// Print / PDF Template Generator for Cylinder Inspection and Hydrotest Due Report
// Formats executive summary, active filters, KPI blocks, and compliance rows
// ready for physical printing and A4 / Letter document preview.
// ==============================================================================

import type {
  CylinderInspectionReportResponse,
} from "../types/cylinder-inspection-hydrotest.types";
import type { CylinderInspectionFilterInput } from "../types/cylinder-inspection-hydrotest.schema";

export function generateInspectionHydrotestPrintHtml(
  report: CylinderInspectionReportResponse,
  filters: CylinderInspectionFilterInput,
  branchLabel: string
): string {
  const kpis = report.kpis;
  const rows = report.rows;

  const formattedCutoff = report.reportingCutoff
    ? new Date(report.reportingCutoff).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  const rowsHtml = rows
    .map(
      (r, idx) => `
    <tr style="border-bottom: 1px solid #e5e7eb; font-size: 11px;">
      <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
      <td style="padding: 6px 8px; font-family: monospace; font-weight: bold;">${r.serialNumber}</td>
      <td style="padding: 6px 8px;">
        <div style="font-weight: 600;">${r.productName}</div>
        <div style="font-size: 10px; color: #6b7280; font-family: monospace;">${r.productCode}</div>
      </td>
      <td style="padding: 6px 8px;">
        <div>${r.custodianName}</div>
        <div style="font-size: 10px; color: #6b7280;">${r.branchName} (${r.custodianType})</div>
      </td>
      <td style="padding: 6px 8px; text-align: center;">${r.condition}</td>
      <td style="padding: 6px 8px; text-align: center; font-family: monospace;">${r.expirationDate || "Unrecorded"}</td>
      <td style="padding: 6px 8px; text-align: center; font-weight: bold;">
        ${
          r.daysRemaining === null
            ? "—"
            : r.daysRemaining < 0
            ? `<span style="color: #dc2626;">${Math.abs(r.daysRemaining)}d overdue</span>`
            : r.daysRemaining <= 30
            ? `<span style="color: #d97706;">${r.daysRemaining}d left</span>`
            : `<span style="color: #059669;">${r.daysRemaining}d left</span>`
        }
      </td>
      <td style="padding: 6px 8px; text-align: center; font-weight: bold;">
        <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; ${
          r.complianceStatus === "COMPLIANT"
            ? "background-color: #d1fae5; color: #065f46;"
            : r.complianceStatus === "DUE_SOON"
            ? "background-color: #fef3c7; color: #92400e;"
            : r.complianceStatus === "OVERDUE"
            ? "background-color: #fee2e2; color: #991b1b;"
            : r.complianceStatus === "FAILED"
            ? "background-color: #ffe4e6; color: #9f1239;"
            : "background-color: #ede9fe; color: #5b21b6;"
        }">
          ${r.complianceStatus}
        </span>
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
  <title>Cylinder Inspection and Hydrotest Due Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      margin: 0;
      padding: 24px;
      line-height: 1.4;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1f2937;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .title-area h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .title-area p {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #4b5563;
    }
    .meta-area {
      text-align: right;
      font-size: 11px;
      color: #4b5563;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin-bottom: 20px;
    }
    .kpi-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px;
      background: #f9fafb;
    }
    .kpi-label {
      font-size: 9px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
    }
    .kpi-value {
      font-size: 15px;
      font-weight: 800;
      margin-top: 2px;
      color: #111827;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th {
      background-color: #f3f4f6;
      border-bottom: 2px solid #d1d5db;
      padding: 6px 8px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #374151;
    }
    .footer-notes {
      margin-top: 24px;
      font-size: 10px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 12px; }
      @page { size: portrait; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div class="title-area">
      <h1>VO-SYNC INDUSTRIAL DISTRIBUTION SYSTEM</h1>
      <p>Cylinder Inspection & Hydrotest Due Compliance Report</p>
    </div>
    <div class="meta-area">
      <div><strong>Reporting Cutoff:</strong> ${formattedCutoff}</div>
      <div><strong>Scope:</strong> ${branchLabel}</div>
      <div><strong>Horizon:</strong> Within ${filters.warningDays || 30} Days</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Fleet</div>
      <div class="kpi-value">${kpis.totalAudited.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Compliant</div>
      <div class="kpi-value" style="color: #059669;">${kpis.compliantCount.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Due Soon</div>
      <div class="kpi-value" style="color: #d97706;">${kpis.dueSoonCount.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Overdue</div>
      <div class="kpi-value" style="color: #dc2626;">${kpis.overdueCount.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Failed Condition</div>
      <div class="kpi-value" style="color: #e11d48;">${kpis.failedCount.toLocaleString()}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Compliance Rate</div>
      <div class="kpi-value">${kpis.complianceRate}%</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">#</th>
        <th>Serial Number</th>
        <th>Product / Gas</th>
        <th>Location / Custodian</th>
        <th style="text-align: center;">Condition</th>
        <th style="text-align: center;">Due Date</th>
        <th style="text-align: center;">Days Remaining</th>
        <th style="text-align: center;">Compliance Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #9ca3af;">No records found.</td></tr>`}
    </tbody>
  </table>

  <div class="footer-notes">
    <span>VoSync Industrial Distribution System • Audit Results and Findings (ARF)</span>
    <span>Generated by Safety & Asset Custodian Module</span>
  </div>
</body>
</html>
  `;
}
