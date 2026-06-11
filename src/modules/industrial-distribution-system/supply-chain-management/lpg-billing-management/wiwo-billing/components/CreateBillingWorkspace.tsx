import { useState, useEffect } from "react";
import { Receipt, ListTodo, PlusCircle, CheckCircle2 } from "lucide-react";
import type { LpgTransactionHeader } from "../types";

interface Invoice {
  invoice_id: number;
  invoice_no: string;
  invoice_date: string;
  total_amount: number;
  transaction_status: string;
}

interface CreateBillingWorkspaceProps {
  header: LpgTransactionHeader;
  onProceed: (transactionType: "ROUTINE" | "ONBOARDING", selectedInvoice: Invoice) => void;
  onCancel: () => void;
}

export function CreateBillingWorkspace({ header, onProceed, onCancel }: CreateBillingWorkspaceProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [transactionType, setTransactionType] = useState<"ROUTINE" | "ONBOARDING" | null>(null);

  const [hasOnboarding, setHasOnboarding] = useState(false);

  useEffect(() => {
    if (!header.customer_id || !header.customer_site_id) return;
    let isMounted = true;
    setTimeout(() => {
      if (isMounted) setLoading(true);
    }, 0);

    Promise.all([
      fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing?type=invoices&customerCode=${encodeURIComponent(header.customer_id)}`).then(res => res.json()),
      fetch(`/api/ids/scm/lpg-billing-management/wiwo-billing?type=check-onboarding&siteId=${header.customer_site_id}`).then(res => res.json())
    ])
      .then(([invoicesJson, onboardingJson]) => {
        if (isMounted) {
          setInvoices(invoicesJson.data || []);
          setHasOnboarding(onboardingJson.data?.hasOnboarding || false);
        }
      })
      .catch((err) => {
        if (isMounted) console.error("Failed to fetch billing prerequisites", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [header.customer_id, header.customer_site_id]);

  const handleProceed = () => {
    if (transactionType && selectedInvoiceId) {
      const selectedInvoice = invoices.find(i => i.invoice_id === selectedInvoiceId);
      if (selectedInvoice) {
        onProceed(transactionType, selectedInvoice);
      }
    }
  };

  return (
    <div className="bg-card/80 backdrop-blur-md border border-border p-4 sm:p-6 rounded-3xl shadow-md w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ListTodo className="h-6 w-6 text-primary" />
          Create Billing Transaction
        </h2>
        <p className="text-sm text-muted-foreground">
          Select the transaction type and link an existing sales invoice for site <strong>{header.site?.site_name}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transaction Type Selection */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-foreground block">
            1. Select Transaction Type
          </label>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => setTransactionType("ROUTINE")}
              className={`p-4 border rounded-2xl text-left transition-all duration-200 group ${
                transactionType === "ROUTINE"
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border hover:border-primary/50 hover:bg-accent"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={`font-bold ${transactionType === "ROUTINE" ? "text-primary" : "text-foreground"}`}>
                    Regular Routine Check & Swap
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Process physical validation, consumption comparison, and replacement.
                  </p>
                </div>
                {transactionType === "ROUTINE" && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </div>
            </button>

            <button
              onClick={() => {
                if (!hasOnboarding) setTransactionType("ONBOARDING");
              }}
              disabled={hasOnboarding}
              className={`p-4 border rounded-2xl text-left transition-all duration-200 group relative ${
                hasOnboarding 
                  ? "border-border bg-accent/30 opacity-60 cursor-not-allowed"
                  : transactionType === "ONBOARDING"
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-accent"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={`font-bold ${transactionType === "ONBOARDING" ? "text-primary" : "text-foreground"}`}>
                    Onboarding Baseline Setup
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deploy initial cylinders to a new site without billing consumption.
                  </p>
                  {hasOnboarding && (
                    <span className="inline-block mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                      Already Onboarded
                    </span>
                  )}
                </div>
                {transactionType === "ONBOARDING" && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </div>
            </button>
          </div>
        </div>

        {/* Invoice Selection */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-foreground block">
            2. Link Sales Invoice
          </label>
          {loading ? (
            <div className="p-4 border border-border rounded-2xl flex items-center justify-center text-sm text-muted-foreground h-32">
              <span className="animate-pulse">Loading eligible invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-4 border border-border rounded-2xl flex flex-col items-center justify-center text-center text-muted-foreground h-32 space-y-2 bg-accent/50">
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
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-accent"
                  }`}
                >
                  <div className="text-left">
                    <p className={`text-sm font-bold ${selectedInvoiceId === inv.invoice_id ? "text-primary" : ""}`}>
                      {inv.invoice_no}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {inv.invoice_date} | ₱{inv.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {selectedInvoiceId === inv.invoice_id && (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleProceed}
          disabled={!transactionType || !selectedInvoiceId}
          className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary text-primary-foreground text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
        >
          Proceed to Physical Validation
          <PlusCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
