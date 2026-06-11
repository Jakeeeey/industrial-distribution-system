"use client";

import { useState, useEffect, useMemo } from "react";
import { Receipt, ListTodo, PlusCircle, CheckCircle2 } from "lucide-react";
import type { LpgTransactionHeader } from "../../metered-billing-common/types";

interface Invoice {
  invoice_id: number;
  invoice_no: string;
  sales_invoice_no?: string; // Explicitly added to guarantee POST compatibility
  invoice_date: string;
  total_amount: number;
  transaction_status: string;
  customer_code?: string;
  sales_order_id?: number | null;
  sales_order_no?: string | null;
}

interface CreateBillingWorkspaceProps {
  header: LpgTransactionHeader;
  onProceed: (transactionType: "ROUTINE" | "ONBOARDING", selectedInvoice: Invoice | null) => void;
  onCancel: () => void;
}

export function CreateBillingWorkspace({ header, onProceed, onCancel }: CreateBillingWorkspaceProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [transactionType, setTransactionType] = useState<"ROUTINE" | "ONBOARDING" | null>(null);
  const [alreadyOnboarded, setAlreadyOnboarded] = useState(false);
  const [hasDraftOnboarding, setHasDraftOnboarding] = useState(false);
  const [checkingOnboarded, setCheckingOnboarded] = useState(false);
  const [lockedInvoice, setLockedInvoice] = useState<{
    invoice_id: number;
    invoice_no: string;
    sales_invoice_no?: string;
    invoice_date?: string;
    total_amount?: number;
    transaction_status?: string;
    sales_order_id?: number | null;
    sales_order_no?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!header.customer_site_id) return;
    let isMounted = true;
    setTimeout(() => {
      if (isMounted) {
        setCheckingOnboarded(true);
        setTransactionType(null);
        setSelectedInvoiceId(null);
        setHasDraftOnboarding(false);
        setLockedInvoice(null);
      }
    }, 0);
    
    fetch(`/api/ids/scm/lpg-billing-management/metered-billing?type=check-onboarding&siteId=${header.customer_site_id}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted) {
          if (json.hasCompleted) {
            setAlreadyOnboarded(true);
            setTransactionType("ROUTINE");
          } else {
            setAlreadyOnboarded(false);
            if (json.draft) {
              setHasDraftOnboarding(true);
              setTransactionType("ONBOARDING");
              
              if (json.draft.sales_invoice_id) {
                // Ensure both invoice_no and sales_invoice_no are captured from the draft
                const draftInv = {
                  invoice_id: Number(json.draft.sales_invoice_id),
                  invoice_no: json.draft.sales_invoice_no || json.draft.invoice_no || `Invoice #${json.draft.sales_invoice_id}`,
                  sales_invoice_no: json.draft.sales_invoice_no || json.draft.invoice_no,
                  sales_order_id: json.draft.sales_order_id ?? null,
                  sales_order_no: json.draft.sales_order_no ?? null,
                };
                setLockedInvoice(draftInv);
                setSelectedInvoiceId(draftInv.invoice_id);
              }
            }
          }
        }
      })
      .catch((err) => console.error("Failed to check onboarding status", err))
      .finally(() => {
        if (isMounted) setCheckingOnboarded(false);
      });
    return () => {
      isMounted = false;
    };
  }, [header.customer_site_id]);
 
  useEffect(() => {
    if (!header.customer_id) return;
    let isMounted = true;
    setTimeout(() => {
      if (isMounted) setLoading(true);
    }, 0);
    
    const url = `/api/ids/scm/inventory-management/inventory-control?directusCollection=sales_invoice&limit=-1&fields=invoice_id,invoice_no,invoice_date,total_amount,transaction_status,customer_code,order_id.order_id,order_id.order_no&filter[transaction_status][_eq]=En Route&filter[customer_code][_eq]=${encodeURIComponent(header.customer_id)}`;
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted) {
          // Auto-map sales_invoice_no securely into the array so it's ready to POST
          const mappedInvoices = (json.data || []).map((inv: {
            invoice_id: number;
            invoice_no?: string | null;
            sales_invoice_no?: string | null;
            invoice_date: string;
            total_amount: number;
            transaction_status: string;
            customer_code?: string;
            order_id?: {
              order_id?: number | null;
              order_no?: string | null;
            } | null;
          }) => ({
            ...inv,
            invoice_no: inv.invoice_no || inv.sales_invoice_no || "",
            sales_invoice_no: inv.sales_invoice_no || inv.invoice_no || "",
            sales_order_id: inv.order_id?.order_id || null,
            sales_order_no: inv.order_id?.order_no || null
          }));
          setInvoices(mappedInvoices);
        }
      })
      .catch((err) => {
        if (isMounted) console.error("Failed to fetch invoices", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [header.customer_id]);

  const resolvedLockedInvoice = useMemo(() => {
    if (!lockedInvoice) return null;
    const found = invoices.find(i => i.invoice_id === lockedInvoice.invoice_id);
    return found ? { ...lockedInvoice, ...found } : lockedInvoice;
  }, [lockedInvoice, invoices]);

  const handleProceed = () => {
    if (transactionType) {
      let finalInvoiceToPass: Invoice | null = null;
      
      const selectedInvoice = invoices.find(i => i.invoice_id === selectedInvoiceId) || null;
      
      if (selectedInvoice) {
        finalInvoiceToPass = selectedInvoice;
      } else if (hasDraftOnboarding) {
        finalInvoiceToPass = resolvedLockedInvoice as Invoice | null;
      }
      
      // LOGGING THE PAYLOAD BEFORE DISPATCHING
      console.log("🚀 [CreateBillingWorkspace] Submitting to Parent Component:");
      console.log("   -> Transaction Type:", transactionType);
      console.log("   -> Invoice Data to Map:", finalInvoiceToPass);

      onProceed(transactionType, finalInvoiceToPass);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/60 p-4 sm:p-6 rounded-3xl shadow-md w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ListTodo className="h-6 w-6 text-violet-500" />
          Create Billing Transaction
        </h2>
        <p className="text-sm text-muted-foreground">
          Select the transaction type and link an existing sales invoice for site <strong>{header.site?.site_name}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transaction Type Selection */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 block">
            1. Select Transaction Type
          </label>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => setTransactionType("ROUTINE")}
              disabled={hasDraftOnboarding}
              className={`p-4 border rounded-2xl text-left transition-all duration-200 group flex flex-col ${
                hasDraftOnboarding
                  ? "opacity-50 border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 cursor-not-allowed"
                  : transactionType === "ROUTINE"
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-500"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <div className="flex items-start justify-between w-full">
                <div>
                  <h3 className={`font-bold ${transactionType === "ROUTINE" ? "text-violet-700 dark:text-violet-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                    Regular Routine Check & Swap
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Process physical validation, consumption comparison, and replacement.
                  </p>
                  {hasDraftOnboarding && (
                    <span className="inline-block mt-2 px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                      Resume Onboarding First
                    </span>
                  )}
                </div>
                {transactionType === "ROUTINE" && <CheckCircle2 className="h-5 w-5 text-violet-500 shrink-0" />}
              </div>
            </button>

            <button
              onClick={() => setTransactionType("ONBOARDING")}
              disabled={alreadyOnboarded || checkingOnboarded}
              className={`p-4 border rounded-2xl text-left transition-all duration-200 group flex flex-col ${
                alreadyOnboarded
                  ? "opacity-50 border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 cursor-not-allowed"
                  : transactionType === "ONBOARDING"
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-500"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <div className="flex items-start justify-between w-full">
                <div>
                  <h3 className={`font-bold ${transactionType === "ONBOARDING" ? "text-violet-700 dark:text-violet-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                    Onboarding Baseline Setup
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deploy initial cylinders to a new site without billing consumption.
                  </p>
                  {alreadyOnboarded && (
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                      Already Onboarded
                    </span>
                  )}
                  {hasDraftOnboarding && (
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-900/50">
                      Draft Resumed
                    </span>
                  )}
                </div>
                {transactionType === "ONBOARDING" && <CheckCircle2 className="h-5 w-5 text-violet-500 shrink-0" />}
              </div>
            </button>
          </div>
        </div>
        
        {/* Invoice Selection */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100 block">
            2. Link Sales Invoice
          </label>
          {loading ? (
            <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center text-sm text-muted-foreground h-32">
              <span className="animate-pulse">Loading eligible invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center text-muted-foreground h-32 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/50">
              <Receipt className="h-6 w-6 opacity-50" />
              <p className="text-xs">No invoices found for this customer.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {invoices.map((inv) => (
                <button
                  key={inv.invoice_id}
                  onClick={() => setSelectedInvoiceId(inv.invoice_id)}
                  className={`flex items-center justify-between p-3 border rounded-xl transition-all duration-200 ${
                    selectedInvoiceId === inv.invoice_id
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="text-left">
                    <p className={`text-sm font-bold ${selectedInvoiceId === inv.invoice_id ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
                      {inv.sales_invoice_no || inv.invoice_no}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {inv.invoice_date} | ₱{inv.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {selectedInvoiceId === inv.invoice_id && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleProceed}
          /* Strictly enforce that an invoice MUST be selected alongside the transaction type */
          disabled={!transactionType || !selectedInvoiceId}
          className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:hover:bg-violet-600 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          {transactionType === "ONBOARDING" ? "Proceed to Onboarding Baseline Setup" : "Proceed to Physical Validation"}
          <PlusCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}