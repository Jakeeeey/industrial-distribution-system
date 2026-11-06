// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/services/deliver-performance.pdf.ts
// ==============================================================================
// Delivery Performance Report - Corporate PDF Generator
// Fetches official company profile via /api/pdf/company (with base64 logo),
// draws corporate header, KPI metrics summary, data table, and sign-off blocks.
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

export async function fetchCompanyProfile(): Promise<CompanyProfileData | null> {
  try {
    const res = await fetch("/api/pdf/company", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data?.[0] || json.data || json;
    return data as CompanyProfileData;
  } catch (err) {
    console.warn("[deliver-performance.pdf] Could not fetch company profile:", err);
    return null;
  }
}

export async function exportDeliveryPerformancePDF(
  reportData: DeliverPerformanceResponse,
  filters: DeliverPerformanceFilterInput,
  branchLabel = "All Branches"
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const company = await fetchCompanyProfile();

  // Create Landscape A4 Document: 297mm width x 210mm height
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 297;
  const leftMargin = 14;
  const rightMargin = 14;
  let currentY = 14;

  // 1. Corporate Header
  if (company?.company_logo && company.company_logo.startsWith("data:image")) {
    try {
      doc.addImage(company.company_logo, "PNG", leftMargin, currentY, 26, 26);
    } catch {
      // Fallback if logo fails
    }
  }

  const headerLeftOffset = company?.company_logo ? leftMargin + 30 : leftMargin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(company?.company_name || "INDUSTRIAL DISTRIBUTION SYSTEM", headerLeftOffset, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  if (company?.company_address) {
    doc.text(company.company_address, headerLeftOffset, currentY + 12);
  }
  const contactText = [company?.company_contact, company?.company_email].filter(Boolean).join(" | ");
  if (contactText) {
    doc.text(contactText, headerLeftOffset, currentY + 17);
  }

  // Report Title (Right Aligned)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("DELIVERY PERFORMANCE REPORT", pageWidth - rightMargin, currentY + 6, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const periodText = `Period: ${filters.startDate || "Start"} to ${filters.endDate || "Present"}`;
  doc.text(periodText, pageWidth - rightMargin, currentY + 12, { align: "right" });
  doc.text(`Branch: ${branchLabel}`, pageWidth - rightMargin, currentY + 17, { align: "right" });

  currentY += 30;

  // 2. Executive KPI Summary Block
  const kpiBoxWidth = (pageWidth - leftMargin - rightMargin - 12) / 5;
  const kpis = reportData.kpis;
  const kpiCards = [
    { title: "Total Deliveries", val: kpis.totalDeliveries.toLocaleString(), color: [2, 132, 199] }, // sky-600
    { title: "Fulfillment Rate", val: `${kpis.fulfillmentRate}%`, color: [16, 185, 129] }, // emerald-600
    { title: "On-Time Rate", val: `${kpis.onTimeRate}%`, color: [99, 102, 241] }, // indigo-500
    { title: "Concerns / Returns", val: (kpis.fulfilledWithConcernsCount + kpis.fulfilledWithReturnsCount).toLocaleString(), color: [245, 158, 11] }, // amber-500
    { title: "Not Fulfilled", val: kpis.notFulfilledCount.toLocaleString(), color: [244, 63, 94] }, // rose-500
  ];

  kpiCards.forEach((card, idx) => {
    const x = leftMargin + idx * (kpiBoxWidth + 3);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(x, currentY, kpiBoxWidth, 16, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.title, x + 4, currentY + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.text(card.val, x + 4, currentY + 12);
  });

  currentY += 22;

  // 3. Data Table
  const tableHeaders = [
    "#",
    "Waybill No",
    "Invoice No",
    "Dispatch Date",
    "Customer Name",
    "Branch",
    "Driver",
    "Status",
    "Qty",
    "Net Amount",
    "Remarks",
  ];

  const tableRows = reportData.records.slice(0, 150).map((r, i) => [
    i + 1,
    r.waybillNo,
    r.invoiceNo,
    r.dispatchDate,
    r.customerName.length > 25 ? r.customerName.slice(0, 23) + "..." : r.customerName,
    r.branchName,
    r.driverName,
    r.status,
    r.totalQuantity,
    `PHP ${r.netAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    r.remarks || "-",
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableRows,
    theme: "striped",
    margin: { left: leftMargin, right: rightMargin, bottom: 20 },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Generated on ${new Date().toLocaleString()} | Page ${data.pageNumber} of ${totalPages}`,
        pageWidth / 2,
        205,
        { align: "center" }
      );
    },
  });

  // Save PDF
  doc.save(`delivery_performance_report_${new Date().toISOString().split("T")[0]}.pdf`);
}

