"use client";

/**
 * WiwoThermalReceiptModal.tsx
 *
 * RULE DEV: Renders a 58mm-wide thermal printer receipt for LPG WIWO (Weigh-In / Weigh-Out) transactions.
 * Layout mirrors the physical receipt format used by Men2 Marketing & Distribution Enterprise Corporation.
 *
 * Receipt Sections (top to bottom):
 *  1. Company Header — name, address, contact, email, TIN
 *  2. Copy Label     — "WIWO CONSUMPTION RECEIPT" or "WIWO ONBOARDING BASELINE"
 *  3. Transaction Info — Transaction No, Date, Customer, Site, Invoice No, Order No
 *  4. Meter Sync       — Previous/Current Reading, Metered KG (if regular billing)
 *  5. Returned Cyls    — SN, Previous weight, Tare weight, Returned Gross weight, Consumed weight (if regular billing)
 *  6. Deployed Cyls    — SN, Tare weight, Deployed Gross weight (if present)
 *  7. Billing Details  — Billable Source, Billable KG, Price/KG
 *  8. Totals           — Gross, VAT, Net Amount
 *  9. Footer           — Thank you / signature line
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

export interface WiwoThermalReceiptData {
  transactionNo: string;
  transactionDate: string;
  transactionType: string;
  customerName: string;
  siteName: string | null;
  salesInvoiceNo?: string | null;
  salesOrderNo?: string | null;

  // Meter readings (sync dual check)
  previousReading?: number | null;
  currentReading?: number | null;
  meteredKg?: number | null;

  // WIWO general details
  wiwoKg: number;
  billableKg: number;
  billableSource: "METERED" | "WIWO" | "NONE";
  pricePerKg: number;
  grossAmount: number;
  vatAmount: number;
  netAmount: number;

  // Cylinder weighing details
  returnedCylinders: Array<{
    serialNumber: string;
    tareWeight: number;
    previousLpgKg: number; // Previous gross LPG weight
    returnedGrossWeight: number;
    consumedLpgKg: number;
  }>;
  deployedCylinders: Array<{
    serialNumber: string;
    tareWeight: number;
    deployedGrossWeight: number; // target gross weight
  }>;

  isOnboarding: boolean;
  remarks?: string | null;
}

interface WiwoThermalReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: WiwoThermalReceiptData;
  autoPrint?: boolean;
}

// ─── Receipt HTML Generator ───────────────────────────────────────────────────

function buildReceiptHTML(company: CompanyProfile, data: WiwoThermalReceiptData, origin: string): string {
  const receiptText = buildReceiptText(company, data);
  const logoUrl = company.company_logo
    ? (company.company_logo.startsWith("http") || company.company_logo.startsWith("data:")
      ? company.company_logo
      : `${origin}/api/ids/scm/lpg-billing-management/wiwo-billing/asset?id=${encodeURIComponent(company.company_logo)}`)
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

function buildReceiptText(company: CompanyProfile, data: WiwoThermalReceiptData): string {
  const dashes = "--------------------------------";

  // Safely detect if the user is on a mobile device (Android/iOS)
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
      month: "long",
      day: "2-digit",
      year: "numeric"
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

  // Helper to center text
  const formatCenter = (str: string): string => {
    let spaceCount = Math.floor((32 - str.length) / 2);
    spaceCount = Math.max(0, spaceCount);
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
  lines.push(formatCenter(data.isOnboarding ? "WIWO ONBOARDING BASELINE" : "WIWO CONSUMPTION RECEIPT"));

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

  // 4. Meter Sync Readings (if regular routine billing)
  if (!data.isOnboarding && data.previousReading !== undefined && data.previousReading !== null) {
    lines.push(formatCenter("--- METER DUAL CHECK ---"));
    lines.push(formatLine("Prev. Reading:", Number(data.previousReading).toFixed(4)));
    lines.push(formatLine("Curr. Reading:", Number(data.currentReading).toFixed(4)));
    lines.push(formatLine("Metered KG:", `${Number(data.meteredKg).toFixed(4)} kg`));
    lines.push(dashes);
  }

  // 5. Returned Cylinders (if present)
  if (data.returnedCylinders && data.returnedCylinders.length > 0) {
    lines.push(formatCenter("--- RETURNED CYLINDERS ---"));
    data.returnedCylinders.forEach((cyl) => {
      lines.push(`SN: ${cyl.serialNumber}`);
      lines.push(formatLine("  Prev. Gross:", `${cyl.previousLpgKg.toFixed(1)}kg`));
      lines.push(formatLine("  Ret. Gross:", `${cyl.returnedGrossWeight.toFixed(1)}kg`));
      lines.push(formatLine("  Tare | Cons:", `${cyl.tareWeight.toFixed(1)}kg | ${cyl.consumedLpgKg.toFixed(1)}kg`));
    });
    lines.push(dashes);
  }

  // 6. Deployed Cylinders (if present)
  if (data.deployedCylinders && data.deployedCylinders.length > 0) {
    lines.push(formatCenter("--- DEPLOYED CYLINDERS ---"));
    data.deployedCylinders.forEach((cyl) => {
      lines.push(`SN: ${cyl.serialNumber}`);
      lines.push(formatLine("  Tare Weight:", `${cyl.tareWeight.toFixed(1)}kg`));
      lines.push(formatLine("  Starting Gross:", `${cyl.deployedGrossWeight.toFixed(1)}kg`));
    });
    lines.push(dashes);
  }

  // 7. Item Table Header
  lines.push(formatItemLine("Item", "Qty", "Total"));
  lines.push(dashes);

  if (!data.isOnboarding) {
    // Item details
    lines.push(formatItemLine("WIWO LPG Consumption", "1", formatCurrency(data.grossAmount)));
    lines.push(` (${data.billableKg.toFixed(4)} kg @ ${formatCurrency(data.pricePerKg)}/kg)`);

    lines.push("");
    lines.push(formatLine("Metered Sync:", `${(data.meteredKg || 0).toFixed(2)} kg`));
    lines.push(formatLine("WIWO Weigh-In:", `${data.wiwoKg.toFixed(2)} kg`));
    lines.push(formatLine("Billable Source:", data.billableSource));
    lines.push(dashes);

    const finalVatAmount = data.vatAmount > 0 ? data.vatAmount : parseFloat((data.grossAmount * 0.12).toFixed(2));
    lines.push(formatLine("VAT (12%):", formatCurrency(finalVatAmount)));
    lines.push(dashes);
    lines.push(formatLine("TOTAL:", formatCurrency(data.netAmount)));
  } else {
    lines.push(formatCenter("*** ONBOARDING ***"));
    lines.push(formatCenter("No billing amount generated."));
  }

  lines.push(dashes);

  if (data.remarks && data.remarks.trim()) {
    lines.push("Remarks:");
    let tempRemarks = data.remarks.trim();
    while (tempRemarks.length > 0) {
      lines.push(tempRemarks.substring(0, 32));
      tempRemarks = tempRemarks.substring(32);
    }
    lines.push(dashes);
  }

  lines.push("");

  // 8. Footer
  lines.push(formatCenter("Thank you for choosing SeaGas"));
  lines.push(formatCenter("Please keep this receipt"));
  lines.push(formatCenter("for your records"));
  lines.push(formatCenter(`Printed on ${formatDateTimeMonth(new Date().toISOString())}`));

  // 9. Spacing for Cutter
  if (isMobile) {
    lines.push("");
    lines.push("");
  } else {
    lines.push("");
    lines.push("");
  }

  lines.push("--------------------------------");

  return lines.join("\n");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WiwoThermalReceiptModal({ open, onClose, data, autoPrint = false }: WiwoThermalReceiptModalProps) {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [printing, setPrinting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [autoPrintTriggered, setAutoPrintTriggered] = useState(false);

  // Fetch company profile once when modal opens
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
        console.error("[WiwoThermalReceiptModal] Failed to fetch company:", err);
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

  // Inject receipt HTML into iframe when both company and data are ready
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

  // Handle direct local printing with fallback to browser print dialog
  const handlePrint = React.useCallback(async () => {
    if (!company) {
      toast.error("Company profile is not loaded yet.");
      return;
    }
    setPrinting(true);
    const receiptText = buildReceiptText(company, data);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const logoUrl = company.company_logo
        ? (company.company_logo.startsWith("http") || company.company_logo.startsWith("data:")
          ? company.company_logo
          : `${origin}/api/ids/scm/lpg-billing-management/wiwo-billing/asset?id=${encodeURIComponent(company.company_logo)}`)
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
      console.warn("[WiwoThermalReceiptModal] Silent print failed:", errMsg);

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

      // Fallback to browser print with delay
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
                  images[i].onerror = onImageLoad;
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

  // Automatically trigger print if autoPrint prop is active
  useEffect(() => {
    if (open && autoPrint && company && !autoPrintTriggered && !loadingCompany) {
      setAutoPrintTriggered(true);
      handlePrint();
    }
  }, [open, autoPrint, company, autoPrintTriggered, loadingCompany, handlePrint]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm w-full p-0 overflow-hidden rounded-2xl">
        {/* Modal Header */}
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

        {/* Preview Area */}
        <div className="bg-zinc-100 dark:bg-zinc-900 flex flex-col items-center py-4 px-2 min-h-[420px]">
          {loadingCompany ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                            : `/api/ids/scm/lpg-billing-management/wiwo-billing/asset?id=${encodeURIComponent(company.company_logo)}`
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

        {/* Hidden iframe renders the actual printable receipt */}
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

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-background">
          <p className="text-[10px] text-muted-foreground">
            58mm thermal · {data.transactionNo}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs font-semibold"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={loadingCompany || !company || printing}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 font-semibold"
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
