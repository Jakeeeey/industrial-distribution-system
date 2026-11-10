/**
 * High-Fidelity Printable HTML Generator for Supplier Performance AI Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements:
 * - Official Company Header with Base64 Logo, TIN, Registration #, and Address
 * - Active Filter Parameters & Print Timestamp
 * - Executive 4-box KPI Grid
 * - Formatted Tabular Dataset (Prioritizing active vendors, clean print pagination)
 * - Signatures & Approvals Section
 */

import { SupplierSummaryRow, ReportExecutiveKPIs, SupplierPerformanceFilter } from '../types';

interface CompanyData {
    company_name?: string;
    company_address?: string;
    company_city?: string;
    company_province?: string;
    company_tin?: string;
    company_registrationNumber?: string;
    company_contact?: string;
    company_email?: string;
    company_logo?: string;
}

function escapeHtml(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function generateSupplierPerformancePrintHtml(
    suppliers: SupplierSummaryRow[],
    kpis: ReportExecutiveKPIs | null,
    filter: SupplierPerformanceFilter,
    branchName: string,
    company: CompanyData | null
): string {
    const printDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const companyName = company?.company_name || 'Men2 Marketing & Distribution Enterprise Corporation';
    const address = [company?.company_address, company?.company_city, company?.company_province]
        .filter(Boolean)
        .join(', ') || 'Dagupan, Pangasinan';
    const tin = company?.company_tin || '';
    const regNo = company?.company_registrationNumber || '';
    const logoSrc = company?.company_logo || '';

    // Filter to active vendors first, then empty ones
    const activeVendors = suppliers.filter((s) => s.totalOrdersDue > 0 || s.rtsCount > 0);
    const displayList = activeVendors.length > 0 ? suppliers : suppliers.slice(0, 50);

    const tableRows = displayList
        .map((s, idx) => {
            const otifDisplay = s.otifPercentage !== null ? `${s.otifPercentage}%` : 'N/A';
            const rejectionDisplay = s.rejectionRatePercentage !== null ? `${s.rejectionRatePercentage}%` : '0.00%';
            const varianceDisplay =
                s.averageCostVariancePercentage !== null
                    ? s.averageCostVariancePercentage > 0
                        ? `+${s.averageCostVariancePercentage}%`
                        : `${s.averageCostVariancePercentage}%`
                    : '0%';

            return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>
            <strong>${escapeHtml(s.supplierName)}</strong>
            <br/>
            <small style="color: #64748b;">Terms: ${escapeHtml(s.paymentTerms) || 'Standard'}</small>
          </td>
          <td style="text-align: center; font-weight: bold;">${s.totalOrdersDue}</td>
          <td style="text-align: center; font-weight: bold; color: ${
              s.otifPercentage !== null && s.otifPercentage >= 85
                  ? '#166534'
                  : s.otifPercentage !== null && s.otifPercentage >= 70
                  ? '#854d0e'
                  : '#991b1b'
          };">
            ${otifDisplay}
          </td>
          <td style="text-align: center; font-weight: bold; color: ${
              s.rejectionRatePercentage !== null && s.rejectionRatePercentage > 3 ? '#991b1b' : '#334155'
          };">
            ${rejectionDisplay}
          </td>
          <td style="text-align: center;">${varianceDisplay}</td>
          <td style="text-align: center;">${s.rtsCount > 0 ? `<span class="badge rts">${s.rtsCount} RTS</span>` : '0'}</td>
          <td style="text-align: center;">
            <span class="badge ${s.riskLevel.toLowerCase()}">${s.riskLevel}</span>
          </td>
        </tr>
      `;
        })
        .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Supplier Performance AI Report - ${printDate}</title>
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
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-img {
      max-height: 52px;
      max-width: 120px;
      object-fit: contain;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
    }
    .report-subtitle {
      font-size: 12px;
      color: #475569;
      font-weight: 700;
      margin: 2px 0 0 0;
    }
    .company-meta {
      font-size: 9px;
      color: #64748b;
      margin-top: 3px;
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
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #f8fafc;
    }
    .kpi-title {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      color: #475569;
      margin-bottom: 2px;
    }
    .kpi-value {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-sub {
      font-size: 9px;
      color: #64748b;
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
      font-size: 9px;
      text-transform: uppercase;
    }
    td {
      padding: 5px 8px;
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
    .badge.low { background: #dcfce7; color: #166534; }
    .badge.medium { background: #fef9c3; color: #854d0e; }
    .badge.high { background: #fee2e2; color: #991b1b; }
    .badge.rts { background: #ffe4e6; color: #be123c; }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 35px;
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
  <!-- Header with Company Logo & Identification -->
  <div class="header">
    <div class="company-info">
      ${logoSrc ? `<img src="${logoSrc}" class="logo-img" alt="Company Logo" />` : ''}
      <div>
        <h1 class="brand-title">${escapeHtml(companyName)}</h1>
        <div class="report-subtitle">SUPPLIER PERFORMANCE AI REPORT</div>
        <div class="company-meta">
          ${escapeHtml(address)} ${tin ? `• TIN: ${escapeHtml(tin)}` : ''} ${regNo ? `• Reg #: ${escapeHtml(regNo)}` : ''}
        </div>
      </div>
    </div>
    <div class="meta-box">
      <div>Reporting Branch: <strong>${escapeHtml(branchName)}</strong></div>
      <div>Period: <strong>${escapeHtml(filter.startDate) || 'All'} to ${escapeHtml(filter.endDate) || 'Current'}</strong></div>
      <div>Generated On: <strong>${printDate}</strong></div>
    </div>
  </div>

  <!-- KPI Metrics Grid -->
  <div class="kpi-grid">
    <div class="kpi-card" style="border-left: 3px solid #10b981;">
      <div class="kpi-title">Enterprise OTIF</div>
      <div class="kpi-value" style="color: #059669;">${kpis?.averageOtifRate !== null && kpis?.averageOtifRate !== undefined ? `${kpis.averageOtifRate}%` : 'N/A'}</div>
      <div class="kpi-sub">On-Time & In-Full Deliveries</div>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #f59e0b;">
      <div class="kpi-title">Average Rejection Rate</div>
      <div class="kpi-value" style="color: #d97706;">${kpis?.averageRejectionRate !== null && kpis?.averageRejectionRate !== undefined ? `${kpis.averageRejectionRate}%` : '0.00%'}</div>
      <div class="kpi-sub">Returned via RTS Documents</div>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #f43f5e;">
      <div class="kpi-title">High-Risk Vendors</div>
      <div class="kpi-value" style="color: #e11d48;">${kpis?.highRiskVendorsCount ?? 0}</div>
      <div class="kpi-sub">Flagged for Late / Defective Shipments</div>
    </div>
    <div class="kpi-card" style="border-left: 3px solid #3b82f6;">
      <div class="kpi-title">Total RTS Events</div>
      <div class="kpi-value" style="color: #2563eb;">${kpis?.totalRtsReturns ?? 0}</div>
      <div class="kpi-sub">Posted Return Documents</div>
    </div>
  </div>

  <!-- Scorecard Table -->
  <table>
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">#</th>
        <th>Supplier Name</th>
        <th style="width: 80px; text-align: center;">Orders Due</th>
        <th style="width: 75px; text-align: center;">OTIF %</th>
        <th style="width: 80px; text-align: center;">Rejection %</th>
        <th style="width: 85px; text-align: center;">Cost Variance</th>
        <th style="width: 80px; text-align: center;">RTS Returns</th>
        <th style="width: 75px; text-align: center;">Risk Level</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <!-- Approvals Section -->
  <div class="signatures">
    <div class="sign-box">
      <div class="sign-title">Prepared By:</div>
      <br/><br/>
      <div>Procurement Specialist</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">Reviewed By:</div>
      <br/><br/>
      <div>Quality Reviewer</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">Approved By:</div>
      <br/><br/>
      <div>Supply Chain Director</div>
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

