// src/modules/industrial-distribution-system/dashboard/utils/kpiCalculations.ts

/**
 * Formats a number as Philippine Peso
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "₱0.00";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(num)) return "₱0.00";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats a number as a percentage
 */
export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0%";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return "0%";
  return `${num.toFixed(1)}%`;
}

/**
 * Trigger client-side download of JSON data as CSV
 */
export function exportToCsv(data: Record<string, unknown>[], fileName: string) {

  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","), // header row
    ...data.map((row) =>
      headers
        .map((header) => {
          const val = row[header];
          const escaped = String(val ?? "").replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",")
    ),
  ];

  const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
