// src/modules/industrial-distribution-system/supply-chain-management/fleet-and-logistics/delivery-performance-report/services/deliver-performance.export.ts
// ==============================================================================
// Delivery Performance Report - CSV & Excel Exporter
// Exports filtered delivery audit records to CSV/Excel format.
// ==============================================================================

import type { DeliveryRecordItem } from "../types/deliver-performance.types";

export function exportDeliveryPerformanceCSV(records: DeliveryRecordItem[], filename = "delivery_performance_report.csv") {
  const headers = [
    "Waybill No",
    "Invoice No",
    "Dispatch Date",
    "Arrival Date",
    "Customer Code",
    "Customer Name",
    "Branch",
    "Driver",
    "Status",
    "Cleared",
    "On Time",
    "Quantity",
    "Gross Amount",
    "Discount",
    "Net Amount",
    "Distance (km)",
    "Remarks",
  ];

  const rows = records.map((r) => [
    `"${r.waybillNo}"`,
    `"${r.invoiceNo}"`,
    `"${r.dispatchDate}"`,
    `"${r.arrivalDate || ""}"`,
    `"${r.customerCode}"`,
    `"${(r.customerName || "").replace(/"/g, '""')}"`,
    `"${(r.branchName || "").replace(/"/g, '""')}"`,
    `"${(r.driverName || "").replace(/"/g, '""')}"`,
    `"${r.status}"`,
    `"${r.isCleared ? "Yes" : "No"}"`,
    `"${r.isOnTime ? "Yes" : "No"}"`,
    r.totalQuantity,
    r.grossAmount.toFixed(2),
    r.discountAmount.toFixed(2),
    r.netAmount.toFixed(2),
    r.totalDistance.toFixed(2),
    `"${(r.remarks || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

