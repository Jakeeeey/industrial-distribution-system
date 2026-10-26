// services/customer-cylinder-aging.pdf.ts
// ──────────────────────────────────────────────────────────────────────────────
// Corporate PDF Generator for Customer Cylinder Aging Report.
// Fetches official company profile and logo, renders executive KPI summary,
// and outputs a multi-page Landscape A4 collection manifest with repeating headers.
// ──────────────────────────────────────────────────────────────────────────────

import type { CustomerCylinderAgingReportResponse } from "../types/customer-cylinder-aging.types";

interface CompanyProfileData {
  company_name?: string;
  company_logo?: string;
  company_address?: string;
  company_brgy?: string;
  company_city?: string;
  company_province?: string;
  company_zipCode?: string;
  company_contact?: string;
  company_email?: string;
}

async function fetchCompanyProfile(): Promise<CompanyProfileData | null> {
  try {
    const res = await fetch("/api/ids/hrm/employee-admin/structure/company-profile", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data || json) as CompanyProfileData;
  } catch (err) {
    console.error("Failed to fetch company profile for PDF:", err);
    return null;
  }
}

export async function exportCustomerCylinderAgingPDF(
  reportData: CustomerCylinderAgingReportResponse
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
  const margin = 14;
  let currentY = 12;

  // ── 1. Official Corporate Header ──
  if (company) {
    if (company.company_logo) {
      try {
        doc.addImage(company.company_logo, "PNG", margin, currentY, 26, 14, undefined, "FAST");
      } catch (e) {
        console.warn("Logo image could not be loaded into PDF", e);
      }
    }

    const headerTextX = company.company_logo ? margin + 30 : margin;

    // Company Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // slate-900
    const companyTitle = (company.company_name || "INDUSTRIAL GAS DISTRIBUTION SYSTEM").toUpperCase();
    doc.text(companyTitle, headerTextX, currentY + 4);

    // Corporate Address
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // slate-600
    const addressLine = [
      company.company_address,
      company.company_brgy,
      company.company_city,
      company.company_province,
      company.company_zipCode,
    ]
      .filter(Boolean)
      .join(", ");
    doc.text(addressLine || "Corporate Operations Center", headerTextX, currentY + 9);

    // Contact info
    const contactLine = [
      company.company_contact ? `Tel: ${company.company_contact}` : "",
      company.company_email ? `Email: ${company.company_email}` : "",
    ]
      .filter(Boolean)
      .join("  |  ");
    if (contactLine) {
      doc.text(contactLine, headerTextX, currentY + 13);
    }

    currentY += 19;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text("CUSTOMER CYLINDER AGING & COLLECTION REPORT", margin, currentY + 4);
    currentY += 12;
  }

  // ── 2. Report Sub-Header & Metadata ──
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("CUSTOMER CYLINDER AGING REPORT", margin, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const metadataText = `Cutoff Date: ${reportData.cutoffDate}   |   Aging Threshold: ${reportData.filters.agingThreshold ?? 30} Days   |   Total Cylinders: ${reportData.items.length.toLocaleString()}   |   Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  doc.text(metadataText, margin, currentY + 4.5);
  currentY += 9;

  // ── 3. Executive KPI Summary Banner ──
  const kpis = reportData.kpis;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 10, 1.5, 1.5, "F");
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 10, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  const kpiText = `Total Units Held: ${kpis.totalUnitsHeld.toLocaleString()}     |     Overdue Units: ${kpis.overdueUnits.toLocaleString()} (${kpis.overduePercentage}%)     |     Average Customer Dwell: ${kpis.averageDwellDays} Days     |     Priority Collection Accounts: ${kpis.priorityCollectionAccountsCount}`;
  doc.text(kpiText, margin + 4, currentY + 6.5);
  currentY += 15;

  // ── 4. 10-Column Collection Manifest Table ──
  const tableData = reportData.items.map((i) => {
    const storeInfo = i.storeName ? `\n(${i.storeName})` : "";
    const contactLoc = [i.contactNumber, i.customerAddress].filter(Boolean).join("\n");
    const overdueLabel = i.isOverdue ? `+${i.overdueDays} d` : "Compliant";
    const estTag = i.isEstimated ? " (FIFO)" : "";

    return [
      i.customerCode,
      `${i.customerName}${storeInfo}`,
      contactLoc || "—",
      `${i.serialNumber}${estTag}`,
      i.productName,
      i.issueDate,
      `${i.ageDays} d`,
      overdueLabel,
      i.agingBucket.replace(/_/g, " "),
      i.recommendedAction.replace(/_/g, " "),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        "Cust Code",
        "Customer & Store Name",
        "Contact & Address",
        "Serial No.",
        "Gas Product",
        "Issue Date",
        "Holding Age",
        "Overdue",
        "Aging Bucket",
        "Action Directive",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "left",
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2,
      valign: "top",
    },
    columnStyles: {
      0: { cellWidth: 20 }, // Cust Code
      1: { cellWidth: 42 }, // Customer Name
      2: { cellWidth: 48 }, // Contact & Address
      3: { cellWidth: 28, font: "courier" }, // Serial
      4: { cellWidth: 38 }, // Product
      5: { cellWidth: 19, halign: "center" }, // Issue Date
      6: { cellWidth: 17, halign: "right" }, // Age
      7: { cellWidth: 18, halign: "center" }, // Overdue
      8: { cellWidth: 21, halign: "center" }, // Bucket
      9: { cellWidth: 18, halign: "center" }, // Action
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Highlight Overdue cells in red
      if (data.section === "body" && data.column.index === 7) {
        const text = String(data.cell.raw || "");
        if (text.startsWith("+")) {
          data.cell.styles.textColor = [225, 29, 72]; // rose-600
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [16, 185, 129]; // emerald-500
        }
      }
    },
    didDrawPage: (data) => {
      // ── Footer on each page ──
      const totalPages = doc.getNumberOfPages();
      const pageStr = `Page ${data.pageNumber} of ${totalPages}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(pageStr, margin, 203);
      doc.text(
        "CONFIDENTIAL — FOR INTERNAL INVENTORY & LOGISTICS COLLECTION OPERATIONS ONLY",
        pageWidth - margin,
        203,
        { align: "right" }
      );
    },
  });

  // Save the complete generated PDF document
  doc.save(
    `Customer_Cylinder_Aging_Report_${reportData.cutoffDate || "export"}.pdf`
  );
}
