"use client";

// ─── ConsolidationWorkspace.tsx ───────────────────────────────────────────────
// Right-panel workspace for the selected LPG billing header.
// Supports Step 2 (Process Invoices) and Step 3 (Approve & Create SI) views.
// Shows child transaction cards, totals, and audit drawers.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import {
  ReceiptText,
  CheckCircle2,
  Calendar,
  Building2,
  AlertTriangle,
  Loader2,
  ClipboardList,
  ArrowRight,
  ArrowLeft,
  Calculator,
  Percent,
  History,
  TrendingUp,
  Gauge,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AuditTrailDrawer } from "./AuditTrailDrawer";
import { MeterReadingReviewPanel } from "./MeterReadingReviewPanel";
import { WiwoReviewPanel } from "./WiwoReviewPanel";
import type { UseBillingConsolidationReturn } from "../hooks/useBillingConsolidation";

interface ConsolidationWorkspaceProps {
  hook: UseBillingConsolidationReturn;
  step: 1 | 2 | 3;
  setStep: (step: 1 | 2 | 3) => void;
}

export function ConsolidationWorkspace({ hook, step, setStep }: ConsolidationWorkspaceProps) {
  const {
    selectedHeader,
    transactions,
    isLoadingWorkspace,
    workspaceError,
    isSubmitting,
    approveHeader,
    auditEntries,
    isLoadingAudit,
    loadAuditTrail,
  } = hook;

  // Audit drawer state
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditTxNo, setAuditTxNo] = useState("");
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);

  const activeTxId = selectedTxId;
  const activeTx = transactions.find((t) => t.id === activeTxId);

  const handleOpenAudit = useCallback(
    async (transactionId: number, transactionNo: string) => {
      setAuditTxNo(transactionNo);
      setAuditOpen(true);
      await loadAuditTrail(transactionId);
    },
    [loadAuditTrail]
  );

  // ── Loading ──
  if (isLoadingWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold animate-pulse">Loading workspace data...</p>
      </div>
    );
  }

  // ── Error ──
  if (workspaceError) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 p-8 text-center">
        <div className="h-12 w-12 rounded-2xl bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center border border-rose-200 dark:border-rose-900/30">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>
        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Failed to load workspace</p>
        <p className="text-xs text-muted-foreground max-w-xs">{workspaceError}</p>
      </div>
    );
  }

  // ── No Selection ──
  if (!selectedHeader) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 p-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-dashed border-primary/20 animate-pulse">
          <ClipboardList className="h-7 w-7 text-primary" />
        </div>
        <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
          No Billing Header Selected
        </p>
        <p className="text-xs text-muted-foreground max-w-[260px]">
          Select a billing header from Step 1 to begin reviewing its transactions.
        </p>
      </div>
    );
  }

  const isDraft = selectedHeader.status === "DRAFT";

  // Compute overall totals from child transactions
  const totalMeteredKg = transactions.reduce((s, tx) => s + tx.metered_kg, 0);
  const totalWiwoKg = transactions.reduce((s, tx) => s + tx.wiwo_kg, 0);
  const totalBillableKg = transactions.reduce((s, tx) => s + tx.billable_kg, 0);
  const totalGross = transactions.reduce((s, tx) => s + tx.gross_amount, 0);
  const totalDiscount = transactions.reduce((s, tx) => s + tx.discount_amount, 0);
  const totalVat = transactions.reduce((s, tx) => s + tx.vat_amount, 0);
  const totalNet = transactions.reduce((s, tx) => s + tx.net_amount, 0);
  const totalAmountBilled = totalNet;

  const handleApprove = async () => {
    const success = await approveHeader(selectedHeader.header_id);
    if (success) {
      setStep(3);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card rounded-2xl border border-border overflow-hidden shadow-sm animate-in fade-in duration-300">
      {/* ── Header Summary Banner ── */}
      <div className="px-5 py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/30 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ReceiptText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-zinc-800 dark:text-zinc-100">
                  {selectedHeader.header_no ?? `Header #${selectedHeader.header_id}`}
                </h2>
                <Badge
                  className={cn(
                    "text-[10px] px-2 py-0.5 border font-bold uppercase tracking-wider",
                    selectedHeader.status === "POSTED"
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                      : selectedHeader.status === "CANCELLED"
                        ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400"
                        : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
                  )}
                >
                  {selectedHeader.status}
                </Badge>
                {selectedHeader.is_billed === 1 && (
                  <Badge className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 font-bold">
                    Billed
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold">
                  <Building2 className="h-3 w-3" />
                  {selectedHeader.customer_id}
                  {selectedHeader.site?.site_name ? ` · ${selectedHeader.site.site_name}` : ""}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold">
                  <Calendar className="h-3 w-3" />
                  {selectedHeader.period_from} → {selectedHeader.period_to}
                </span>
                <span className="text-[10px] text-muted-foreground font-bold">
                  {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {step === 2 && (
              <Button
                size="sm"
                onClick={() => setStep(3)}
                className="h-9 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4"
              >
                Next: Approve & Create SI
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            {step === 3 && (
              <>
                {isDraft && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(2)}
                    className="h-9 text-xs gap-1.5 font-bold"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Process
                  </Button>
                )}

                {isDraft ? (
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={isSubmitting || transactions.length === 0}
                    className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isSubmitting ? "Processing approval..." : "Approve & Generate Sales Invoice"}
                  </Button>
                ) : (
                  selectedHeader.status === "POSTED" && (
                    <Badge className="gap-1.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs font-black px-3.5 py-1.5 shrink-0 border">
                      <CheckCircle2 className="h-4 w-4" /> Approved & Invoiced
                    </Badge>
                  )
                )}
              </>
            )}
          </div>
        </div>

        {/* Remarks */}
        {selectedHeader.remarks && (
          <p className="mt-2 text-[10px] text-muted-foreground italic pl-13">
            Remarks: {selectedHeader.remarks}
          </p>
        )}
      </div>

      {/* ── STEP 2: Process Invoices View (Split Screen) ── */}
      {/* Dev Workflow: Split-screen UI implemented for reviewing child transactions details instead of accordion view. */}
      {step === 2 && (
        <>
          {/* Header Totals Dashboard Row: Styled to match image 2 for premium, unified UX */}
          <div className="flex items-center gap-0 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 backdrop-blur-sm shrink-0 w-full">
            {[
              {
                label: "Total Metered",
                value: totalMeteredKg.toFixed(3),
                sub: "kg",
                icon: Gauge,
                color: "text-violet-600 dark:text-violet-400",
              },
              {
                label: "Total WIWO",
                value: totalWiwoKg.toFixed(3),
                sub: "kg",
                icon: Scale,
                color: "text-blue-600 dark:text-blue-400",
              },
              {
                label: "Billable KG",
                value: totalBillableKg.toFixed(3),
                sub: "kg",
                icon: ReceiptText,
                color: "text-emerald-600 dark:text-emerald-400",
              },
              {
                label: "Gross Amount",
                value: `₱ ${totalGross.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                icon: Calculator,
                color: "text-amber-600 dark:text-amber-400",
              },
            ].map((item, i, arr) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex-1 flex items-center gap-2 px-4 py-2",
                    i < arr.length - 1 && "border-r border-zinc-200 dark:border-zinc-800"
                  )}
                >
                  <div className="h-7 w-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <Icon className={cn("h-3.5 w-3.5", item.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground leading-tight">
                      {item.label}
                    </p>
                    <p className={cn("text-xs font-black leading-tight", item.color)}>
                      {item.value}
                      {item.sub && (
                        <span className="text-[9px] font-medium text-muted-foreground ml-0.5">
                          {item.sub}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-background">
            {/* Left Column: Transaction List */}
            <div className="w-full md:w-[300px] border-r border-border flex flex-col min-h-0 bg-zinc-50/20 dark:bg-zinc-950/5">
              <div className="px-4 py-3 border-b border-border bg-card shrink-0 flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Transactions</span>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  {transactions.length} total
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
                {transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ClipboardList className="h-10 w-10 text-muted-foreground/20 mb-3" />
                    <p className="text-xs font-semibold text-zinc-500">No transactions found</p>
                  </div>
                ) : (
                  transactions.map((tx) => {
                    const isSelected = tx.id === activeTxId;
                    const hasMeterReading = !!tx.meter_reading;
                    const hasWiwo = !!tx.wiwo_header;
                    return (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => setSelectedTxId((prev) => (prev === tx.id ? null : tx.id))}
                        className={cn(
                          "w-full text-left rounded-xl border p-3 transition-all flex flex-col gap-2 relative group",
                          isSelected
                            ? "border-primary/50 bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/30 shadow-sm"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-card hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1.5 w-full">
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                            {tx.transaction_no}
                          </span>
                          <Badge className="text-[8px] px-1.5 py-0 bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 shrink-0">
                            {tx.transaction_type.replace("_", " ")}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between w-full text-[10px] text-muted-foreground">
                          <span className="truncate">
                            {tx.billing_period_from ?? tx.transaction_date}
                          </span>
                          <Badge
                            className={cn(
                              "text-[8px] px-1 py-0 border shrink-0",
                              tx.billable_source === "METERED"
                                ? "bg-primary/10 text-primary border-primary/20 dark:bg-primary/25 dark:text-primary-foreground/90"
                                : tx.billable_source === "WIWO"
                                  ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
                                  : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500"
                            )}
                          >
                            {tx.billable_source}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 w-full text-[10px]">
                          <div className="flex gap-2">
                            {hasMeterReading && (
                              <div>
                                <span className="text-muted-foreground">Metered:</span>{" "}
                                <span className="font-bold text-primary">{tx.metered_kg.toFixed(1)} kg</span>
                              </div>
                            )}
                            {hasWiwo && (
                              <div>
                                <span className="text-muted-foreground">WIWO:</span>{" "}
                                <span className="font-bold text-blue-600 dark:text-blue-400">{tx.wiwo_kg.toFixed(1)} kg</span>
                              </div>
                            )}
                          </div>
                          <div className="font-black text-emerald-600 dark:text-emerald-450">
                            {tx.billable_kg.toFixed(2)} kg
                          </div>
                        </div>

                        {/* Card Amounts Row: Displays recalculated Vatable Sales, VAT, and Total Amount dynamically */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-dashed border-zinc-200 dark:border-zinc-850 w-full text-[9px] text-muted-foreground">
                          <span>Vatable Amount: <strong className="font-semibold text-zinc-700 dark:text-zinc-300">₱{tx.gross_amount.toFixed(2)}</strong></span>
                          <span>VAT: <strong className="font-semibold text-zinc-700 dark:text-zinc-300">₱{tx.vat_amount.toFixed(2)}</strong></span>
                          <span>Total: <strong className="font-black text-emerald-600 dark:text-emerald-450">₱{tx.net_amount.toFixed(2)}</strong></span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Detail View */}
            <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
              {activeTx ? (
                <div key={activeTx.id} className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Detail Panel Header */}
                  <div className="px-5 py-3.5 border-b border-border bg-zinc-50/30 dark:bg-zinc-900/10 flex items-center justify-between shrink-0">
                    <div>
                      <h3 className="text-xs font-black text-foreground">
                        Transaction: {activeTx.transaction_no}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Details, attachments, and adjustments
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-750 dark:text-amber-350"
                      onClick={() => handleOpenAudit(activeTx.id, activeTx.transaction_no)}
                    >
                      <History className="h-3 w-3" />
                      View Audit Trail
                    </Button>
                  </div>

                  {/* Detail Panel Content: Split Layout */}
                  <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left Side: Scrollable adjustment panels */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                      {/* Meter Reading Panel */}
                      {!!activeTx.meter_reading && (
                        <MeterReadingReviewPanel
                          reading={activeTx.meter_reading}
                          attachments={activeTx.attachments ?? []}
                          transactionId={activeTx.id}
                          isOnboarding={activeTx.transaction_type === "ONBOARDING_BASELINE"}
                          isSubmitting={isSubmitting}
                          onAdjust={hook.adjustMeterReading}
                        />
                      )}

                      {/* WIWO Panel */}
                      {!!activeTx.wiwo_header && (
                        <WiwoReviewPanel
                          wiwoHeader={activeTx.wiwo_header}
                          attachments={activeTx.attachments ?? []}
                          transactionId={activeTx.id}
                          isSubmitting={isSubmitting}
                          onAdjust={hook.adjustWiwoDetail}
                        />
                      )}

                      {/* No sub-records */}
                      {!activeTx.meter_reading && !activeTx.wiwo_header && (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                          <p className="text-xs font-semibold">No detailed records</p>
                          <p className="text-[10px] mt-0.5">There are no meter readings or WIWO weight reviews for this transaction.</p>
                        </div>
                      )}
                    </div>

                    {/* Right Side: Static WIWO Billing Summary Card */}
                    {(!!activeTx.meter_reading || !!activeTx.wiwo_header) && (
                      <div className="w-[340px] border-l border-border bg-zinc-50/10 dark:bg-zinc-950/5 p-4 overflow-y-auto shrink-0 custom-scrollbar flex flex-col justify-start">
                        <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 rounded-2xl p-4 sm:p-5 text-white shadow-xl space-y-4 w-full">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                              <Calculator className="h-4.5 w-4.5" />
                            </div>
                            <h3 className="font-bold text-sm">WIWO Billing Summary</h3>
                          </div>

                          {activeTx.transaction_type === "REGULAR_BILLING" && (
                            <div className="space-y-3">
                              <div className="flex flex-col gap-3">
                                {/* Metered Calculation Box */}
                                <div className="bg-white/10 rounded-xl p-3.5 space-y-2 text-xs">
                                  <div className="text-violet-200 font-bold mb-1 uppercase tracking-wider text-[9px] flex items-center gap-1.5 border-b border-white/10 pb-1">
                                    <Gauge className="h-3.5 w-3.5 shrink-0" /> Metered Calculation
                                  </div>
                                  {/* BIR labels: Vatable Sales, Output VAT, Amount Due */}
                                  <div className="flex justify-between items-center text-violet-100">
                                    <span className="text-[11px]">KG</span>
                                    <span className="font-mono font-bold text-sm">{activeTx.metered_kg.toFixed(3)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-violet-100">
                                    <span className="text-[11px]">Vatable Sales</span>
                                    <span className="font-mono text-[11px]">₱ {(activeTx.metered_kg * activeTx.price_per_kg).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-violet-100">
                                    <span className="text-[11px]">Output VAT</span>
                                    <span className="font-mono text-[11px]">₱ {(activeTx.metered_kg * activeTx.price_per_kg * 0.12).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-white border-t border-white/10 pt-2 font-bold">
                                    <span className="text-xs">Amount Due</span>
                                    <span className="font-mono text-xs">₱ {(activeTx.metered_kg * activeTx.price_per_kg * 1.12).toFixed(2)}</span>
                                  </div>
                                </div>

                                {/* WIWO Calculation Box */}
                                <div className="bg-white/10 rounded-xl p-3.5 space-y-2 text-xs">
                                  <div className="text-violet-200 font-bold mb-1 uppercase tracking-wider text-[9px] flex items-center gap-1.5 border-b border-white/10 pb-1">
                                    <Scale className="h-3.5 w-3.5 shrink-0" /> WIWO Calculation
                                  </div>
                                  {/* BIR labels: Vatable Sales, Output VAT, Amount Due */}
                                  <div className="flex justify-between items-center text-violet-100">
                                    <span className="text-[11px]">KG</span>
                                    <span className="font-mono font-bold text-sm">{activeTx.wiwo_kg.toFixed(3)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-violet-100">
                                    <span className="text-[11px]">Vatable Sales</span>
                                    <span className="font-mono text-[11px]">₱ {(activeTx.wiwo_kg * activeTx.price_per_kg).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-violet-100">
                                    <span className="text-[11px]">Output VAT</span>
                                    <span className="font-mono text-[11px]">₱ {(activeTx.wiwo_kg * activeTx.price_per_kg * 0.12).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-white border-t border-white/10 pt-2 font-bold">
                                    <span className="text-xs">Amount Due</span>
                                    <span className="font-mono text-xs">₱ {(activeTx.wiwo_kg * activeTx.price_per_kg * 1.12).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-violet-200 bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs">
                                <span className="font-semibold">Variance (Difference)</span>
                                <span className="font-mono font-bold">{activeTx.variance_kg.toFixed(3)} kg</span>
                              </div>

                              <div className="flex items-center justify-between bg-white/15 rounded-xl p-2.5 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <TrendingUp className="h-3.5 w-3.5 text-white/80 shrink-0" />
                                  <span className="font-semibold">Billable Source</span>
                                </div>
                                <Badge className="font-bold text-[10px] tracking-wider border-none bg-orange-300/30 text-orange-100">
                                  {activeTx.billable_source}
                                </Badge>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2 text-xs pt-1 border-t border-white/10">
                            <div className="flex justify-between text-violet-100">
                              <span>Billable KG</span>
                              <span className="font-bold font-mono">{activeTx.billable_kg.toFixed(3)} kg</span>
                            </div>
                            <div className="flex justify-between text-violet-100">
                              <span>Price / KG</span>
                              <span className="font-bold font-mono">₱ {activeTx.price_per_kg.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-violet-100 border-t border-white/10 pt-2">
                              <span>Vatable Sales</span>
                              <span className="font-bold font-mono">₱ {activeTx.gross_amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-violet-100">
                              <span>12% Output VAT</span>
                              <span className="font-bold font-mono">₱ {activeTx.vat_amount.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-white/20 pt-2 flex justify-between items-end">
                              <span className="font-bold text-sm">Total Amount Due</span>
                              <span className="text-base font-black font-mono">
                                ₱ {activeTx.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div key="empty" className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground animate-in fade-in duration-200">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/25 mb-2.5 animate-pulse" />
                  <p className="text-xs font-semibold">Select a transaction from the left list to review its details.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── STEP 3: Approve & Create SI View ── */}
      {step === 3 && (
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-zinc-50/20 dark:bg-zinc-950/10">
          {/* Status Message for Posted headers */}
          {!isDraft && selectedHeader.status === "POSTED" && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-800 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Billing Header Approved</p>
                <p className="text-muted-foreground mt-0.5">
                  The billing header status is posted, child transactions are locked, and the Sales Invoice has been successfully generated.
                </p>
              </div>
            </div>
          )}

          {/* Billing Totals Overview Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Billable KG */}
            <div className="bg-card border border-border p-4 rounded-2xl flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Total Billable
              </span>
              <span className="text-lg font-black text-primary mt-1">
                {totalBillableKg.toFixed(3)}{" "}
                <span className="text-xs font-semibold text-muted-foreground">kg</span>
              </span>
              <p className="text-[9px] text-muted-foreground mt-1">
                Metered: {totalMeteredKg.toFixed(2)} kg · WIWO: {totalWiwoKg.toFixed(2)} kg
              </p>
            </div>

            {/* Gross Amount */}
            <div className="bg-card border border-border p-4 rounded-2xl flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Gross Amount
              </span>
              <span className="text-lg font-black text-zinc-800 dark:text-zinc-200 mt-1">
                ₱ {totalGross.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                <Calculator className="h-2.5 w-2.5" /> Consolidated gross total
              </p>
            </div>

            {/* VAT Amount */}
            <div className="bg-card border border-border p-4 rounded-2xl flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Consolidated VAT
              </span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
                ₱ {totalVat.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                <Percent className="h-2.5 w-2.5" /> 12% output taxation
              </p>
            </div>

            {/* Total Billed Amount */}
            <div className="bg-card border border-border p-4 rounded-2xl flex flex-col justify-between shadow-sm ring-1 ring-emerald-500/20 bg-emerald-500/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Total Amount Due
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                ₱ {totalAmountBilled.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <p className="text-[9px] text-muted-foreground mt-1">
                Vatable Sales: ₱ {totalGross.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Child Transactions Table Review */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Transactions Breakdown</span>
              <Badge variant="outline" className="text-[10px] font-bold">
                {transactions.length} Item{transactions.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-zinc-50/30 dark:bg-zinc-900/10 font-bold">
                    <th className="p-3">Transaction No</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Billable Qty</th>
                    <th className="p-3 text-right">Price/Kg</th>
                    <th className="p-3 text-right">Vatable Sales</th>
                    <th className="p-3 text-right">Discount</th>
                    <th className="p-3 text-right">12% VAT</th>
                    <th className="p-3 text-right font-black">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={cn(
                        "hover:bg-muted/40 transition-colors",
                        tx.status === "CANCELLED" && "opacity-40 line-through bg-zinc-100/50 dark:bg-zinc-900/20"
                      )}
                    >
                      <td className="p-3 font-mono font-bold text-foreground">{tx.transaction_no}</td>
                      <td className="p-3 text-muted-foreground">{tx.transaction_date || "—"}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 font-bold whitespace-nowrap">
                          {tx.transaction_type}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-bold">
                        {tx.billable_kg.toFixed(3)} kg
                        <span className="text-[9px] text-muted-foreground block font-normal">
                          src: {tx.billable_source}
                        </span>
                      </td>
                      <td className="p-3 text-right text-muted-foreground">₱ {tx.price_per_kg.toFixed(2)}</td>
                      <td className="p-3 text-right text-muted-foreground">₱ {tx.gross_amount.toFixed(2)}</td>
                      <td className="p-3 text-right text-rose-600 dark:text-rose-400">
                        {tx.discount_amount > 0 ? `-₱ ${tx.discount_amount.toFixed(2)}` : "—"}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">₱ {tx.vat_amount.toFixed(2)}</td>
                      <td className="p-3 text-right font-black text-foreground">₱ {tx.net_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-50/50 dark:bg-zinc-900/20 font-black border-t border-border">
                    <td colSpan={3} className="p-3 text-right">Summary Totals</td>
                    <td className="p-3 text-right text-primary">
                      {totalBillableKg.toFixed(3)} kg
                    </td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right">₱ {totalGross.toFixed(2)}</td>
                    <td className="p-3 text-right text-rose-600 dark:text-rose-400">
                      {totalDiscount > 0 ? `-₱ ${totalDiscount.toFixed(2)}` : "—"}
                    </td>
                    <td className="p-3 text-right text-amber-600 dark:text-amber-400">₱ {totalVat.toFixed(2)}</td>
                    <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">₱ {totalNet.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Audit Trail Drawer ── */}
      <AuditTrailDrawer
        isOpen={auditOpen}
        transactionNo={auditTxNo}
        entries={auditEntries}
        isLoading={isLoadingAudit}
        onClose={() => setAuditOpen(false)}
      />
    </div>
  );
}

