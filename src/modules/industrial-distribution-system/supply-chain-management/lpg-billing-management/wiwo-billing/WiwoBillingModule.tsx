"use client";

import { useState } from "react";
import { CalendarRange, Scale } from "lucide-react";
import { WiwoForm } from "./components/WiwoForm";
import { TransactionHeaderWorkspace } from "./components/TransactionHeaderWorkspace";
import { CreateBillingWorkspace } from "./components/CreateBillingWorkspace";
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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-zinc-955 shadow-lg m-1 sm:m-4 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="space-y-4 p-5 sm:p-6 border-b border-zinc-150 dark:border-zinc-800/60 bg-gradient-to-r from-zinc-50/50 to-white dark:from-zinc-900/30 dark:to-zinc-950 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
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

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <TransactionHeaderWorkspace selectedHeader={selectedHeader} onSelect={setSelectedHeader} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50/10 dark:bg-zinc-900/5">
          {selectedHeader ? (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-white dark:bg-zinc-900 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selected Header</p>
                  <h2 className="font-bold">{selectedHeader.header_no || `Header #${selectedHeader.header_id}`}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedHeader.site?.site_name || `Site #${selectedHeader.customer_site_id}`} | {selectedHeader.period_from} to {selectedHeader.period_to}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-800">
                  {selectedHeader.status}
                </span>
              </div>
              <div className="bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/60 p-4 sm:p-6 rounded-3xl shadow-md w-full max-w-6xl mx-auto">
                {!billingContext ? (
                  <CreateBillingWorkspace
                    header={selectedHeader}
                    onProceed={(type, invoice) => setBillingContext({ type, invoice })}
                    onCancel={() => setSelectedHeader(null)}
                  />
                ) : (
                  <WiwoForm
                    key={`${selectedHeader.header_id}-${billingContext.type}-${formKey}`}
                    txId={null}
                    transactionHeader={selectedHeader}
                    initialFlowType={billingContext.type}
                    salesInvoice={billingContext.invoice}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-80 flex flex-col items-center justify-center text-center text-muted-foreground">
              <CalendarRange className="h-10 w-10 mb-3" />
              <h2 className="font-bold text-foreground">Select a transaction header</h2>
              <p className="text-xs mt-1">Choose an existing site-period header or create a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
