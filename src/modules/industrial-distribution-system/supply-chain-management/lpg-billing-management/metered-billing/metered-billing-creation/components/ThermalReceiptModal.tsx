"use client";

/**
 * ThermalReceiptModal.tsx
 *
 * RULE DEV: Renders a 58mm-wide thermal printer receipt for LPG Metered Billing transactions.
 * Layout mirrors the physical receipt format used by Men2 Marketing & Distribution Enterprise Corporation.
 *
 * Receipt Sections (top to bottom):
 *  1. Company Header — name, address, contact, email, TIN
 *  2. Copy Label     — "MERCHANT COPY / STORE / POS FILE COPY"
 *  3. Transaction Info — Transaction No, Date, Customer, Site, Invoice No
 *  4. Billing Details — Previous/Current Reading, Consumption, Billable KG, Price/KG
 *  5. Totals          — Gross, VAT, Net Amount
 *  6. Footer          — Thank you / signature line
 *
 * Printing: Uses a hidden iframe with @media print styles scoped to 58mm width.
 * Company data is fetched once on modal open from the existing company-profile endpoint.
 */

import React, { useEffect, useRef, useState } from "react";
import { Printer, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyProfile {
  company_id: number;
  company_name: string;
  company_address?: string | null;
  company_brgy?: string | null;
  company_city?: string | null;
  company_province?: string | null;
  company_zipCode?: string | null;
  company_contact?: string | null;
  company_email?: string | null;
  company_tin?: string | null;
  company_logo?: string | null;
}

export interface ThermalReceiptData {
  // Transaction
  transactionNo: string;
  transactionDate: string;
  transactionType: string;
  // Customer / Site
  customerName: string;
  siteName: string | null;
  // Invoice
  salesInvoiceNo?: string | null;
  salesOrderNo?: string | null;
  // Meter Readings
  previousReading: number;
  currentReading: number;
  billingPeriodFrom?: string;
  billingPeriodTo?: string;
  // Billing Amounts
  meteredKg: number;
  billableKg: number;
  pricePerKg: number;
  grossAmount: number;
  vatAmount: number;
  netAmount: number;
  vatRate: number;
  // Status
  // status: string;
  isOnboarding: boolean;
  siteCylinders?: Array<{
    serialNumber: string;
    tareWeight: number;
    capacity: number;
    status: string;
  }>;
}

interface ThermalReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ThermalReceiptData;
  autoPrint?: boolean;
}


// ─── Receipt HTML Generator ───────────────────────────────────────────────────

function buildReceiptHTML(company: CompanyProfile, data: ThermalReceiptData, origin: string): string {
  const receiptText = buildReceiptText(company, data);
  const logoUrl = company.company_logo
    ? (company.company_logo.startsWith("http") || company.company_logo.startsWith("data:")
      ? company.company_logo
      : `${origin}/api/ids/scm/lpg-billing-management/metered-billing/asset?id=${encodeURIComponent(company.company_logo)}`)
    : null;

  const logoHtml = logoUrl
    ? `<div style="text-align: center;">
         <img src="${logoUrl}" style="width: 140px; height: 40px; object-fit: contain; filter: grayscale(100%);" alt="logo" />
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt - ${data.transactionNo}</title>
  <style>
    /* RULE DEV: Scoped @media print styles for 58mm thermal paper */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      font-weight: bold;
      line-height: 1.2;
      color: #000;
      background: #fff;
    }
    pre {
      font-family: 'Courier New', Courier, monospace;
      white-space: pre-wrap;
      word-wrap: break-word;
      width: 58mm;
      padding: 0;
      margin: 0;
 
    }
    @media print {
      @page {
        size: 58mm auto;
        margin: 0;
      }
      body {
        width: 58mm !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      pre {
        width: 58mm !important;
        padding: 0 !important;
        margin-left: 0 !important; 
 
      }
    }
  </style>
</head>
<body>
  ${logoHtml}
  <pre>${receiptText}</pre>
</body>
</html>`;
}

// ─── Plain Text Receipt Generator (32-column limit for 58mm Thermal Printers) ───

function buildReceiptText(company: CompanyProfile, data: ThermalReceiptData): string {
  const dashes = "--------------------------------";

  // ADDED: Safely detect if the user is on a mobile device (Android/iOS)
  const isMobile =
    typeof window !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // Helper to format currency
  const formatCurrency = (val: number): string => {
    return "P" + val.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Helper to format date
  const formatDateStr = (iso?: string | null): string => {
    if (!iso) return "—";
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTimeMonth = (iso?: string | null): string => {
    const date = iso ? new Date(iso) : new Date();

    return date.toLocaleDateString("en-PH", {
      month: "long",    // "June"
      day: "2-digit",   // "06"
      year: "numeric"   // "2026"
    });
  };

  // Helper to align line: label on left, value on right
  const formatLine = (label: string, value: string): string => {
    const spaceCount = 32 - label.length - value.length;
    if (spaceCount <= 0) return `${label} ${value}`;
    return label + " ".repeat(spaceCount) + value;
  };

  // Helper to align item line: Item (col 18), Qty (col 4), Total (col 10)
  const formatItemLine = (item: string, qty: string, total: string): string => {
    const itemPart = item.substring(0, 17).padEnd(18, " ");
    const qtyPart = qty.padStart(3, " ").substring(0, 3) + " ";
    const totalPart = total.padStart(10, " ").substring(0, 10);
    return itemPart + qtyPart + totalPart;
  };

  // Helper to center text with a physical margin offset
  const formatCenter = (str: string): string => {
    const CENTER_OFFSET = 0;
    let spaceCount = Math.floor((32 - str.length) / 2) + CENTER_OFFSET;
    spaceCount = Math.max(0, spaceCount); // Prevent negative spaces
    return " ".repeat(spaceCount) + str.substring(0, 32);
  };

  const lines: string[] = [];

  // 1. Company Header
  lines.push(formatCenter("Men2 Marketing & Distribution"));
  lines.push(formatCenter("Enterprise Corporation"));

  const address = [
    company.company_address,
    company.company_brgy,
    company.company_city,
    company.company_province,
    company.company_zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  if (address) {
    let tempAddr = address;
    while (tempAddr.length > 0) {
      lines.push(formatCenter(tempAddr.substring(0, 32)));
      tempAddr = tempAddr.substring(32);
    }
  }
  if (company.company_contact) lines.push(formatCenter(`Tel: ${company.company_contact}`));
  if (company.company_email) lines.push(formatCenter(company.company_email.substring(0, 32)));
  if (company.company_tin) lines.push(formatCenter(`TIN: ${company.company_tin}`));

  lines.push(dashes);

  // 2. Copy Label
  lines.push(formatCenter(data.isOnboarding ? "ONBOARDING BASELINE" : "CONSUMPTION RECEIPT"));

  lines.push(dashes);

  // 3. Transaction Info
  lines.push(formatLine("Invoice #:", data.salesInvoiceNo || "—"));
  const currentTimeStr = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  lines.push(formatLine("Date:", `${formatDateStr(data.transactionDate)} ${currentTimeStr}`));
  lines.push(formatLine("Customer:", (data.customerName || "—").substring(0, 20)));
  if (data.siteName) {
    lines.push(formatLine("Addr:", data.siteName.substring(0, 26)));
  }
  if (data.salesOrderNo) {
    lines.push(formatLine("Order #:", data.salesOrderNo));
  }

  lines.push(dashes);

  // 4. Readings (Rendered in monospace details block)
  if (data.isOnboarding) {
    // Developer Comment: Print only the baseline target index during onboarding setup
    lines.push(formatLine("Baseline Reading:", data.currentReading.toFixed(4)));
  } else {
    lines.push(formatLine("Prev. Reading:", data.previousReading.toFixed(4)));
    lines.push(formatLine("Curr. Reading:", data.currentReading.toFixed(4)));
    lines.push(formatLine("Consumption:", (data.currentReading - data.previousReading).toFixed(4)));
    lines.push(formatLine("Metered KG:", `${data.meteredKg.toFixed(4)} kg`));
  }

  lines.push(dashes);

  // 4.5. Onboarding Connected Cylinders
  if (data.isOnboarding && data.siteCylinders && data.siteCylinders.length > 0) {
    lines.push(formatCenter("--- CONNECTED CYLINDERS ---"));
    data.siteCylinders.forEach((cyl) => {
      lines.push(`SN: ${cyl.serialNumber}`);
      lines.push(formatLine("  Status:", cyl.status));
      lines.push(formatLine("  Tare | Capacity:", `${cyl.tareWeight.toFixed(1)}kg | ${cyl.capacity}kg`));
    });
    lines.push(dashes);
  }

  // 5. Item table Header
  lines.push(formatItemLine("Item", "Qty", "Total"));
  lines.push(dashes);

  if (!data.isOnboarding) {
    // Item details
    lines.push(formatItemLine("LPG Consumption", "1", formatCurrency(data.grossAmount)));
    lines.push(` (${data.billableKg.toFixed(4)} kg @ ${formatCurrency(data.pricePerKg)}/kg)`);

    lines.push("");
    lines.push(dashes);
    const finalVatAmount = data.vatAmount > 0 ? data.vatAmount : parseFloat((data.grossAmount * 0.12).toFixed(2));
    const finalVatRate = data.vatRate > 0 ? data.vatRate : 0.12;
    lines.push(formatLine(`VAT (${(finalVatRate * 100).toFixed(0)}%):`, formatCurrency(finalVatAmount)));
    lines.push(dashes);
    lines.push(formatLine("TOTAL:", formatCurrency(data.netAmount)));
  } else {
    lines.push(formatCenter("*** ONBOARDING ***"));
    lines.push(formatCenter("No billing amount generated."));
  }

  lines.push(dashes);

  lines.push("");

  // 6. Footer
  lines.push(formatCenter("Thank you for choosing SeaGas"));
  lines.push(formatCenter("Please keep this receipt "));
  lines.push(formatCenter("for your records"));
  lines.push(formatCenter(`Printed on ${formatDateTimeMonth(new Date().toISOString())}`));

  // 7. Dynamic Spacing for Mobile vs Desktop
  if (isMobile) {
    // MOBILE: The Android app needs less spacing to reach the cutter
    lines.push("");
    lines.push("");

  } else {
    // DESKTOP: Windows/Mac spoolers need more feed lines to push the paper out
    lines.push("");

    lines.push("");
  }

  // CRITICAL: The Visible Anchor
  // This must be here so the mobile app doesn't delete the empty lines above it!
  lines.push("--------------------------------");

  return lines.join("\n");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThermalReceiptModal({ open, onClose, data, autoPrint = false }: ThermalReceiptModalProps) {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [printing, setPrinting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [autoPrintTriggered, setAutoPrintTriggered] = useState(false);

  // RULE DEV: Fetch company profile once when modal opens
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    setLoadingCompany(true);
    fetch("/api/ids/hrm/employee-admin/structure/company-profile")
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.data) {
          setCompany(json.data);
        }
      })
      .catch((err) => {
        console.error("[ThermalReceiptModal] Failed to fetch company:", err);
        toast.error("Failed to load company profile for printing");
      })
      .finally(() => { if (isMounted) setLoadingCompany(false); });
    return () => { isMounted = false; };
  }, [open]);

  // Reset autoPrintTriggered state when modal closes
  useEffect(() => {
    if (!open) {
      setAutoPrintTriggered(false);
    }
  }, [open]);

  // RULE DEV: Inject receipt HTML into iframe when both company and data are ready
  useEffect(() => {
    if (!open || !company || !iframeRef.current) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const html = buildReceiptHTML(company, data, origin);
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [open, company, data]);

  // RULE DEV: Handle direct local printing with fallback to browser print dialog.
  // First, attempts native BLE printing via `@capacitor-community/bluetooth-le` (Capacitor environment);
  // falls back to local silent print server (/api/print), and finally browser print helper.
  const handlePrint = React.useCallback(async () => {
    if (!company) {
      toast.error("Company profile is not loaded yet.");
      return;
    }
    setPrinting(true);
    const receiptText = buildReceiptText(company, data);



    // 2. Try Local Printer API (/api/print)
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const logoUrl = company.company_logo
        ? (company.company_logo.startsWith("http") || company.company_logo.startsWith("data:")
          ? company.company_logo
          : `${origin}/api/ids/scm/lpg-billing-management/metered-billing/asset?id=${encodeURIComponent(company.company_logo)}`)
        : null;

      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptText, logoUrl, printerName: "POS-58" }),
      });

      if (res.ok) {
        toast.success("Receipt printed silently on POS-58.");
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Silent printer connection failed.");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("[ThermalReceiptModal] Silent print failed:", errMsg);

      const isConnectionIssue =
        errMsg.toLowerCase().includes("offline") ||
        errMsg.toLowerCase().includes("not found");

      if (isConnectionIssue) {
        toast.error("Printer Offline or Not Found", {
          description: `${errMsg} Redirecting to browser print dialog...`,
          duration: 6000,
        });
      } else {
        toast.error("Printing Failed", {
          description: `${errMsg}. Falling back to browser print...`,
        });
      }

      // Fallback to browser print with a 1-second delay so user can read the error toast
      if (iframeRef.current?.contentWindow) {
        const frame = iframeRef.current;
        setTimeout(() => {
          if (frame.contentWindow) {
            const images = frame.contentDocument?.getElementsByTagName("img");
            const triggerPrint = () => {
              if (frame.contentWindow) {
                frame.contentWindow.focus();
                frame.contentWindow.print();
              }
            };

            if (images && images.length > 0) {
              let loadedCount = 0;
              const onImageLoad = () => {
                loadedCount++;
                if (loadedCount === images.length) {
                  triggerPrint();
                }
              };
              for (let i = 0; i < images.length; i++) {
                if (images[i].complete) {
                  onImageLoad();
                } else {
                  images[i].onload = onImageLoad;
                  images[i].onerror = onImageLoad; // Don't get stuck if image fails to load
                }
              }
            } else {
              triggerPrint();
            }
          }
        }, 1000);
      } else {
        toast.error("Browser print fallback failed.");
      }
    } finally {
      setPrinting(false);
    }
  }, [company, data]);

  // RULE DEV: Automatically trigger print if autoPrint prop is active
  useEffect(() => {
    if (open && autoPrint && company && !autoPrintTriggered && !loadingCompany) {
      setAutoPrintTriggered(true);
      handlePrint();
    }
  }, [open, autoPrint, company, autoPrintTriggered, loadingCompany, handlePrint]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm w-full p-0 overflow-hidden rounded-2xl" showCloseButton={false}>
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-primary" />
            <DialogTitle className="text-sm font-bold">Print Receipt (58mm)</DialogTitle>
          </div>
          <DialogClose asChild>
            <button
              onClick={onClose}
              className="rounded-full p-1 hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </DialogClose>
        </div>

        {/* ── Preview Area ── */}
        <div className="bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center py-4 px-2 min-h-[420px]">
          {loadingCompany ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground py-16">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">Loading company info...</span>
            </div>
          ) : (
            <div
              className="bg-white shadow-md rounded p-3 overflow-y-auto select-none custom-scrollbar"
              style={{ width: "220px", height: "380px" }}
            >
              {company && (
                <div className="flex flex-col items-center">
                  {company.company_logo && (
                    <div className="mb-2 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          company.company_logo.startsWith("http") || company.company_logo.startsWith("data:")
                            ? company.company_logo
                            : `/api/ids/scm/lpg-billing-management/metered-billing/asset?id=${encodeURIComponent(company.company_logo)}`
                        }
                        alt="Company Logo"
                        className="w-[140px] h-[77px] object-contain filter grayscale"
                      />
                    </div>
                  )}
                  <pre
                    className="text-black font-bold whitespace-pre select-none w-full"
                    style={{
                      fontFamily: "'Courier New', Courier, monospace",
                      fontSize: "10px",
                      lineHeight: "1.2",
                    }}
                  >
                    {buildReceiptText(company, data)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hidden iframe renders the actual printable 58mm receipt */}
        <iframe
          ref={iframeRef}
          title="Thermal Receipt Print Helper"
          style={{
            position: "absolute",
            width: "0px",
            height: "0px",
            border: "none",
            left: "-9999px",
            top: "-9999px",
          }}
        />

        {/* ── Footer Actions ── */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-background">
          <p className="text-[10px] text-muted-foreground">
            58mm thermal · {data.transactionNo}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={loadingCompany || !company || printing}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              {printing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Printer className="h-3.5 w-3.5" />
              )}
              {printing ? "Printing..." : "Print"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
