import { toast } from "sonner";

/**
 * automaticMobilePrint
 * 
 * Silently sends the receipt text to the local print server (/api/print).
 * 
 * @param receiptText The raw text payload to print.
 */
export const automaticMobilePrint = async (receiptText: string) => {
  if (typeof window === "undefined") {
    console.warn("[automaticMobilePrint] Cannot run on server environment.");
    return;
  }

  try {
    toast.info("Connecting to print server...");

    const res = await fetch("/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptText, printerName: "POS-58" }),
    });

    if (res.ok) {
      toast.success("Receipt printed successfully!");
    } else {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Printer server error");
    }
  } catch (error) {
    console.error("Print server failed:", error);
    toast.error("Printer offline or print server unreachable.");
  }
};
