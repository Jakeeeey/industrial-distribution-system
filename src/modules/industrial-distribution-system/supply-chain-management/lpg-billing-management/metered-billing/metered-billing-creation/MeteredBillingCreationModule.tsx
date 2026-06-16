"use client";

import { useState } from "react";

import { Gauge } from "lucide-react";
import { CreationForm } from "./components/CreationForm";
import { TransactionHeaderWorkspace } from "./components/TransactionHeaderWorkspace";
import { CreateBillingWorkspace } from "./components/CreateBillingWorkspace";
import type { LpgTransactionHeader } from "../metered-billing-common/types";

interface MeteredBillingCreationModuleProps {
  currentUser?: { id: number; name: string } | null;
}

export default function MeteredBillingCreationModule({ currentUser }: MeteredBillingCreationModuleProps = {}) {

  const [formKey, setFormKey] = useState(0);

  /**
   * PER_INVOICE mode:
   *   true  — previous reading is resolved using site + customer + sales invoice
   *           (only looks at transactions tied to the same invoice)
   *   false — previous reading is resolved using site + customer only
   *           (last transaction regardless of which invoice it belongs to)
   */
  const [perInvoice] = useState(false);
  /**
   * AUTO_PERIOD_FROM mode (hidden — not shown in UI):
   *   true  — billingPeriodFrom of the new transaction is auto-set from
   *            the billing_period_to of the last matching transaction
   *   false — billingPeriodFrom is left as initialised (from transaction header)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [autoPeriodFrom, _setAutoPeriodFrom] = useState(true);


  const [selectedHeader, setSelectedHeader] = useState<LpgTransactionHeader | null>(null);
  const [createHeaderOnOpen, setCreateHeaderOnOpen] = useState(false);
  const [billingContext, setBillingContext] = useState<{
    type: "ROUTINE" | "ONBOARDING";
    invoice: {
      invoice_id: number;
      invoice_no: string;
      sales_invoice_no?: string;
      total_amount: number;
      invoice_date: string;
      transaction_status: string;
      sales_order_id?: number | null;
      sales_order_no?: string | null;
    } | null;
  } | null>(null);

  const handleSuccess = () => {
    setBillingContext(null);
    setSelectedHeader(null);
    setCreateHeaderOnOpen(false);
    setFormKey((k) => k + 1);

  };

  const handleCancel = () => {
    setBillingContext(null); // Return to type selection & invoice linking step
    setFormKey((k) => k + 1);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-zinc-950 shadow-lg m-1 sm:m-4 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="space-y-4 p-5 sm:p-6 border-b border-zinc-150 dark:border-zinc-800/60 bg-gradient-to-r from-zinc-50/50 to-white dark:from-zinc-900/30 dark:to-zinc-950 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 shrink-0 shadow-sm">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                LPG Metered Billing & Validation
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Metered volume validation with linked transaction context.
              </p>
            </div>
          </div>

          {/* ── PER_INVOICE Toggle ── dont show this*/}
          {/* <button
            onClick={() => setPerInvoice((v) => !v)}
            title={perInvoice
              ? "Per Invoice: previous reading resolved by site + invoice"
              : "Per Site: previous reading resolved by site only (any invoice)"}
            className={[
              "flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 shadow-sm",
              perInvoice
                ? "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700/40 text-violet-700 dark:text-violet-300"
                : "bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/40 text-zinc-500 dark:text-zinc-400",
            ].join(" ")}
          > */}
          {/* {perInvoice
              ? <FileText className="h-3.5 w-3.5 shrink-0" />
              : <Hash className="h-3.5 w-3.5 shrink-0" />}
            <span className="hidden sm:inline">
              {perInvoice ? "Per Invoice" : "Per Site"}
            </span>
            {/* pill indicator */}
          {/* <span className={[
              "inline-block w-7 h-4 rounded-full relative transition-colors duration-200",
              perInvoice ? "bg-violet-500" : "bg-zinc-300 dark:bg-zinc-600",
            ].join(" ")}> */}
          {/* <span className={[
                "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200",
                perInvoice ? "translate-x-3.5" : "translate-x-0.5",
              ].join(" ")} />
            </span> */}
          {/* </button> */}

        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pt-0 bg-zinc-50/10 dark:bg-zinc-900/5 custom-scrollbar">
        {!selectedHeader ? (
          <TransactionHeaderWorkspace
            selectedHeader={selectedHeader}
            onSelect={setSelectedHeader}
            autoOpenCreate={createHeaderOnOpen}
            onCloseCreate={() => setCreateHeaderOnOpen(false)}
          />
        ) : (
          <div className="space-y-4 w-full max-w-6xl mx-auto">
            {/* Step Header Card */}
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md p-4 sm:p-6 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Step 1: Selected Header</p>
                <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{selectedHeader.header_no || `Header #${selectedHeader.header_id}`}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedHeader.site?.site_name || `Site #${selectedHeader.customer_site_id}`} | {selectedHeader.period_from} to {selectedHeader.period_to}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                  {selectedHeader.status}
                </span>
                {!billingContext && (
                  <button
                    onClick={() => setSelectedHeader(null)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Change Header
                  </button>
                )}
              </div>
            </div>

            <div className="w-full">
              {!billingContext ? (
                <CreateBillingWorkspace
                  header={selectedHeader}
                  onProceed={(type, invoice) => setBillingContext({ type, invoice })}
                  onCancel={() => setSelectedHeader(null)}
                />
              ) : (
                <div className="bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/60 p-4 sm:p-6 rounded-3xl shadow-md w-full animate-in fade-in slide-in-from-bottom-4">
                  <CreationForm
                    key={`${selectedHeader.header_id}-${billingContext.type}-${formKey}`}
                    transactionHeader={selectedHeader}
                    initialFlowType={billingContext.type}
                    salesInvoice={billingContext.invoice}
                    perInvoice={perInvoice}
                    autoPeriodFrom={autoPeriodFrom}
                    currentUserId={currentUser?.id ?? null}
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
