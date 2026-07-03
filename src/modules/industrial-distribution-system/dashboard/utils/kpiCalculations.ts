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
 * Trigger client-side download of JSON data as CSV.
 * Uses Blob + URL.createObjectURL to safely handle all characters.
 */
export function exportToCsv(data: Record<string, unknown>[], fileName: string) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);

  // Quote each cell value — escape internal quotes by doubling them
  const escapeCell = (val: unknown): string => {
    const str = String(val ?? "");
    // Wrap in quotes and escape any existing quotes inside
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csvRows = [
    headers.join(","),                                         // header row (unquoted column names)
    ...data.map((row) => headers.map((h) => escapeCell(row[h])).join(",")),
  ];

  const csvString = csvRows.join("\r\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
