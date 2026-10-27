// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/reports/cylinder-stock-report/utils/generateCylinderStockPdf.ts
// ==============================================================================
// Cylinder Stock Report - Official PDF Generator
// Complies with VoSync development standards:
// - Imports system-standard PdfEngine and incorporates /api/pdf/company corporate header
// - Formats official A4 landscape report with company header, KPI summary, and complete table
// ==============================================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { CompanyData } from "@/components/pdf-layout-design/types";
import { pdfTemplateService } from "@/components/pdf-layout-design/services/pdf-template";
import type { CylinderStockRecord, CylinderStockKPISummary } from "../types/cylinder-stock-report.types";

export interface CylinderStockPdfData {
  rows: CylinderStockRecord[];
  kpis: CylinderStockKPISummary | null;
  reportingCutoff: string;
  branchName: string;
}

export async function generateCylinderStockPdf(data: CylinderStockPdfData) {
  try {
    // 1. Fetch official company header data from system endpoint
    let companyData: CompanyData | null = null;
    try {
      const res = await fetch("/api/pdf/company");
      if (res.ok) {
        const body = await res.json();
        companyData = body?.data?.[0] || (Array.isArray(body?.data) ? null : body?.data);
      }
    } catch {
      companyData = null;
    }

    if (!companyData) {
      companyData = {} as CompanyData;
    }

    // 2. Resolve template (prefer MEN2 corporate layout or available fallback)
    const templates = await pdfTemplateService.fetchTemplates();
    const template =
      templates.find((t) => t.name === "MEN2") ||
      templates.find((t) => t.name.toLowerCase().includes("men2")) ||
      templates[0];
    const templateName = template?.name || "MEN2";

    // 3. Generate full PDF using PdfEngine with company header frame
    const doc = await PdfEngine.generateWithFrame(templateName, companyData, (doc: jsPDF, startY: number) => {
      const pageWidth = doc.internal.pageSize.getWidth();

      // Report Header Section
      let currentY = startY + 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("CYLINDER STOCK REPORT", 10, currentY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      currentY += 4.5;
      doc.text(
        `Reporting Cutoff Snapshot: ${data.reportingCutoff || new Date().toISOString()} (Asia/Manila)  •  Branch Scope: ${data.branchName}`,
        10,
        currentY
      );

      // KPI Summary Stat Boxes
      if (data.kpis) {
        currentY += 5;
        const boxWidth = (pageWidth - 20 - 15) / 6;
        const boxHeight = 13;

        const kpiItems = [
          { title: "Usable Available", value: data.kpis.usableAvailable, color: [16, 185, 129] },
          { title: "Full Cylinders", value: data.kpis.fullStock, color: [6, 182, 212] },
          { title: "Empty Cylinders", value: data.kpis.emptyStock, color: [100, 116, 139] },
          { title: "Quarantine / Defect", value: data.kpis.quarantinedDefective, color: [225, 29, 72] },
          { title: "Loaded / Reserved", value: data.kpis.loadedStock + data.kpis.reservedStock, color: [217, 119, 6] },
          { title: "Customer Custody", value: data.kpis.withCustomer, color: [99, 102, 241] },
        ];

        kpiItems.forEach((kpi, idx) => {
          const x = 10 + idx * (boxWidth + 3);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.roundedRect(x, currentY, boxWidth, boxHeight, 1.5, 1.5, "FD");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(100, 116, 139);
          doc.text(kpi.title, x + 2.5, currentY + 4);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.text(kpi.value.toLocaleString(), x + 2.5, currentY + 10);
        });

        currentY += boxHeight + 4;
      }

      // Tabular Data
      const tableHead = [
        [
          "#",
          "Serial Number",
          "Gas Product & SKU",
          "Variant State",
          "Location / Branch",
          "Tare Wt.",
          "Condition",
          "Stock Status",
          "Current Custodian",
        ],
      ];

      const tableRows = data.rows.map((r, i) => [
        String(i + 1),
        r.serialNumber,
        `${r.productName}\n(${r.productCode})`,
        r.variantState || "STANDARD",
        r.branchName,
        r.tareWeight ? `${r.tareWeight} kg` : "—",
        r.cylinderCondition,
        r.cylinderStatus,
        r.custodianName,
      ]);

      autoTable(doc, {
        head: tableHead,
        body: tableRows,
        startY: currentY,
        margin: { left: 10, right: 10, bottom: 25 },
        styles: {
          fontSize: 7,
          font: "helvetica",
          textColor: [30, 41, 59],
          cellPadding: 2,
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 26, fontStyle: "bold" },
          2: { cellWidth: "auto" },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 28 },
          5: { cellWidth: 16, halign: "right" },
          6: { cellWidth: 18, halign: "center" },
          7: { cellWidth: 24, halign: "center" },
          8: { cellWidth: 32 },
        },
        didDrawPage: (hookData) => {
          // Bottom page number
          const pageStr = `Page ${hookData.pageNumber}`;
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(148, 163, 184);
          doc.text(
            pageStr,
            pageWidth - 10,
            doc.internal.pageSize.getHeight() - 8,
            { align: "right" }
          );
        },
      });

      // Sign-off / Verification section on the final page
      const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
      const pageHeight = doc.internal.pageSize.getHeight();

      // Check if sign-off fits on current page
      let sigY = finalY;
      if (sigY + 20 > pageHeight - 15) {
        doc.addPage();
        sigY = 20;
      }

      const colWidth = 50;
      const spacing = (pageWidth - 20 - colWidth * 3) / 2;

      const signOffs = ["Prepared By:", "Verified Warehouse Custodian:", "Approved Management:"];
      signOffs.forEach((title, idx) => {
        const x = 10 + idx * (colWidth + spacing);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(title, x, sigY);

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(x, sigY + 12, x + colWidth, sigY + 12);

        doc.setFontSize(6.5);
        doc.text("Signature over Printed Name / Date", x, sigY + 16);
      });
    });

    // 4. Save file
    const dateStr = new Date().toISOString().split("T")[0];
    doc.save(`Cylinder_Stock_Report_${dateStr}.pdf`);
  } catch (error) {
    console.error("[Cylinder Stock PDF Generator] Error:", error);
    throw error;
  }
}
