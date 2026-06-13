"use client";

import { useState } from "react";
import { Scale, ArrowLeft, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WiwoForm } from "./components/WiwoForm";
import { TransactionHeaderWorkspace } from "./components/TransactionHeaderWorkspace";
import { CreateBillingWorkspace } from "./components/CreateBillingWorkspace";
// AG-CHANGE: Import PostedHeaderTransactionList to display read-only transaction list for POSTED headers
import { PostedHeaderTransactionList } from "./components/PostedHeaderTransactionList";
import type { LpgTransactionHeader } from "./types";

// AG-CHANGE: Format ISO date (YYYY-MM-DD) to readable "Jun 13, 2026"
const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function WiwoBillingModule() {
  const [formKey, setFormKey] = useState(0);
  const [selectedHeader, setSelectedHeader] = useState<LpgTransactionHeader | null>(null);
  const [billingContext, setBillingContext] = useState<{
    type: "ROUTINE" | "ONBOARDING";
    invoice: { invoice_id: number; invoice_no: string; total_amount: number; invoice_date: string; transaction_status: string };
    draftTxId?: number;
  } | null>(null);

  const handleSuccess = () => {
    setBillingContext(null);
    setFormKey((k) => k + 1);
  };

  const handleCancel = () => {
    setBillingContext(null);
    setFormKey((k) => k + 1);
  };

  return (
    // AG-CHANGE: m-1 on mobile (no gap wasted), sm:m-4 on larger screens
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full border border-border rounded-xl sm:rounded-2xl bg-card text-card-foreground shadow-lg m-1 sm:m-4 animate-in fade-in duration-300">

      {/* ── Page Header ──────────────────────────────────────────────── */}
      {/* AG-CHANGE: Reduced padding on mobile; hide subtitle on xs */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-sm">
            <Scale className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground leading-tight">
              WIWO LPG Billing
            </h1>
            <p className="text-[11px] text-muted-foreground hidden sm:block mt-0.5">
              Weigh-In / Weigh-Out validation with Meter-Sync dual check.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      {/* AG-CHANGE: p-2 on mobile, p-4/p-6 on larger screens */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4 lg:p-6 bg-background custom-scrollbar">
        {!selectedHeader ? (
          <TransactionHeaderWorkspace selectedHeader={selectedHeader} onSelect={setSelectedHeader} />
        ) : (
          <div className="space-y-3 w-full max-w-6xl mx-auto">

            {/* ── Selected Header Banner ───────────────────────────── */}
            {/* AG-CHANGE: Tighter layout on mobile — period dates wrap gracefully */}
            <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-4 shadow-md animate-in fade-in slide-in-from-top-4">
              <div className="flex items-start justify-between gap-3">
                {/* Left: header info */}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Selected Header
                  </p>
                  <h2 className="font-bold text-sm sm:text-base text-foreground truncate">
                    {selectedHeader.header_no || `Header #${selectedHeader.header_id}`}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {selectedHeader.site?.site_name || `Site #${selectedHeader.customer_site_id}`}
                  </p>
                  {/* Period on its own line — key info */}
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-primary">
                    <CalendarRange className="h-3 w-3 shrink-0" />
                    <span>{formatDate(selectedHeader.period_from)}</span>
                    <span className="opacity-50">→</span>
                    <span>{formatDate(selectedHeader.period_to)}</span>
                  </div>
                </div>

                {/* Right: status + back button */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="rounded-full badge-warning px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap">
                    {selectedHeader.status}
                  </span>
                  {!billingContext && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedHeader(null)}
                      className="font-medium shadow-sm hover:bg-accent/50 text-xs h-7 px-2.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Back
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Workspace Area ───────────────────────────────────── */}
            <div className="w-full">
              {selectedHeader.status === "POSTED" ? (
                // AG-CHANGE: POSTED headers show read-only transaction list
                <PostedHeaderTransactionList header={selectedHeader} />
              ) : !billingContext ? (
                <CreateBillingWorkspace
                  header={selectedHeader}
                  onProceed={(type, invoice, draftTxId) => setBillingContext({ type, invoice, draftTxId })}
                  onCancel={() => setSelectedHeader(null)}
                />
              ) : (
                // AG-CHANGE: No extra padding wrapper on mobile — WiwoForm handles its own padding
                <div className="bg-card/80 backdrop-blur-md border border-border p-3 sm:p-5 rounded-2xl sm:rounded-3xl shadow-md w-full animate-in fade-in slide-in-from-bottom-4">
                  <WiwoForm
                    key={`${selectedHeader.header_id}-${billingContext.type}-${formKey}`}
                    txId={billingContext.draftTxId ?? null}
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
