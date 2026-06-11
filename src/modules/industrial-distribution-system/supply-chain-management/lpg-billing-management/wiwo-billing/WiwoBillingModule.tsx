"use client";

import { useState } from "react";
import { Scale, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WiwoForm } from "./components/WiwoForm";
import { TransactionHeaderWorkspace } from "./components/TransactionHeaderWorkspace";
import { CreateBillingWorkspace } from "./components/CreateBillingWorkspace";
// AG-CHANGE: Import PostedHeaderTransactionList to display read-only transaction list for POSTED headers
import { PostedHeaderTransactionList } from "./components/PostedHeaderTransactionList";
import type { LpgTransactionHeader } from "./types";

export default function WiwoBillingModule() {
  const [formKey, setFormKey] = useState(0);
  const [selectedHeader, setSelectedHeader] = useState<LpgTransactionHeader | null>(null);
  const [billingContext, setBillingContext] = useState<{
    type: "ROUTINE" | "ONBOARDING";
    invoice: { invoice_id: number; invoice_no: string; total_amount: number; invoice_date: string; transaction_status: string };
  } | null>(null);

  const handleSuccess = () => {
    setBillingContext(null); // Return to header view
    setFormKey((k) => k + 1);
  };

  const handleCancel = () => {
    setBillingContext(null); // Return to create billing or header
    setFormKey((k) => k + 1);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full border border-border rounded-2xl bg-card text-card-foreground shadow-lg m-1 sm:m-4 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="space-y-4 p-5 sm:p-6 border-b border-border bg-card shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-sm">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                WIWO LPG Billing & Validation
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Weigh-In / Weigh-Out validation logic with Meter-Sync dual check.
              </p>
            </div>
          </div>

          {/* Transaction Type Selector (Removed since it's now in CreateBillingWorkspace) */}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-background custom-scrollbar">
        {!selectedHeader ? (
          <TransactionHeaderWorkspace selectedHeader={selectedHeader} onSelect={setSelectedHeader} />
        ) : (
          <div className="space-y-4 w-full max-w-6xl mx-auto">
            <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-md p-4 sm:p-6 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Step 1: Selected Header</p>
                <h2 className="font-bold text-lg text-foreground">{selectedHeader.header_no || `Header #${selectedHeader.header_id}`}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedHeader.site?.site_name || `Site #${selectedHeader.customer_site_id}`} | {selectedHeader.period_from} to {selectedHeader.period_to}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                <span className="rounded-full badge-warning px-3 py-1 text-xs font-bold">
                  {selectedHeader.status}
                </span>
                {!billingContext && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedHeader(null)}
                    className="font-medium shadow-sm hover:bg-accent/50"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Return to List
                  </Button>
                )}
              </div>
            </div>

            <div className="w-full">
              {selectedHeader.status === "POSTED" ? (
                // AG-CHANGE: POSTED headers skip the process — show read-only transaction list instead
                <PostedHeaderTransactionList header={selectedHeader} />
              ) : !billingContext ? (
                <CreateBillingWorkspace
                  header={selectedHeader}
                  onProceed={(type, invoice) => setBillingContext({ type, invoice })}
                  onCancel={() => setSelectedHeader(null)}
                />
              ) : (
                <div className="bg-card/80 backdrop-blur-md border border-border p-4 sm:p-6 rounded-3xl shadow-md w-full animate-in fade-in slide-in-from-bottom-4">
                  <WiwoForm
                    key={`${selectedHeader.header_id}-${billingContext.type}-${formKey}`}
                    txId={null}
                    transactionHeader={selectedHeader}
                    initialFlowType={billingContext.type}
                    salesInvoice={billingContext.invoice}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
