/**
 * CreateBillingWorkspace.tsx
 *
 * AG-CHANGE: Redesigned as a sequential 2-step stepper UI to match the wiwo-billing module.
 *   Step 1 — Select Transaction Type (ROUTINE or ONBOARDING)
 *   Step 2 — Link Sales Invoice (only shown after type is confirmed)
 *
 * Key behaviors (preserved from original):
 *  - Invoice list is hidden until a transaction type is confirmed via "Next"
 *  - ONBOARDING option is disabled if the site is already onboarded
 *  - ROUTINE option is disabled if there is a draft onboarding setup
 *  - "Proceed" requires both a type and an invoice to be selected
 *  - Back button on Step 2 returns to Step 1 and clears invoice selection (unless locked)
 */

import { useState, useEffect, useMemo } from "react";
import {
  Receipt,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Zap,
  RefreshCw,
  Package,
  FileText,
  AlertCircle,
  PlusCircle,
  // RULE DEV: LinkIcon removed — "Already Linked" invoices are now hidden completely from the list
} from "lucide-react";
import type { LpgTransactionHeader } from "../../metered-billing-common/types";

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
  // RULE DEV: Flag set when the invoice is already linked to a transaction header (any status)
  // Linked invoices are now HIDDEN completely from the selection list (not shown as disabled)
  isLinked?: boolean;
}

interface CreateBillingWorkspaceProps {
  header: LpgTransactionHeader;
  onProceed: (transactionType: "ROUTINE" | "ONBOARDING", selectedInvoice: Invoice | null, draftTxId?: number | null) => void;
  onCancel: () => void;
}

export function CreateBillingWorkspace({
  header,
  onProceed,
  onCancel,
}: CreateBillingWorkspaceProps) {
  // ─── State ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [transactionType, setTransactionType] = useState<"ROUTINE" | "ONBOARDING" | null>(null);
  const [alreadyOnboarded, setAlreadyOnboarded] = useState(false);
  const [hasDraftOnboarding, setHasDraftOnboarding] = useState(false);
  const [draftTxId, setDraftTxId] = useState<number | null>(null);
  // RULE DEV: Stores the display label (e.g. ID or transaction_no) of the draft onboarding record
  const [draftTransactionNo, setDraftTransactionNo] = useState<string | null>(null);
  const [checkingOnboarded, setCheckingOnboarded] = useState(true);
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

  // ─── Check onboarding status ──────────────────────────────────────────────
  useEffect(() => {
    if (!header.customer_site_id) return;
    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckingOnboarded(true);
    setTransactionType(null);
    setSelectedInvoiceId(null);
    setHasDraftOnboarding(false);
    setDraftTxId(null);
    setDraftTransactionNo(null);
    setLockedInvoice(null);

    fetch(`/api/ids/scm/lpg-billing-management/metered-billing?type=check-onboarding&siteId=${header.customer_site_id}&headerId=${header.header_id}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted) {
          const hasCompleted = json.hasCompleted || false;
          setAlreadyOnboarded(hasCompleted);

          if (json.draft) {
            setHasDraftOnboarding(true);
            setTransactionType("ONBOARDING");
            setDraftTxId(Number(json.draft.id));
            // RULE DEV: Use transaction_no if available, otherwise fall back to the record ID as a display label
            setDraftTransactionNo(
              (json.draft.transaction_no as string | undefined) ||
              (json.draft.id ? `#${json.draft.id}` : null)
            );

            if (json.draft.sales_invoice_id) {
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
          } else if (hasCompleted) {
            setTransactionType("ROUTINE");
          } else {
            setTransactionType("ONBOARDING");
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
  }, [header.customer_site_id, header.header_id]);

  // ─── Fetch Invoices ────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2 || !header.customer_id) return;
    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const invoicesUrl = `/api/ids/scm/inventory-management/inventory-control?directusCollection=sales_invoice&limit=-1&fields=invoice_id,invoice_no,invoice_date,total_amount,transaction_status,customer_code,order_id.order_id,order_id.order_no&filter[transaction_status][_eq]=En Route&filter[customer_code][_eq]=${encodeURIComponent(header.customer_id)}`;
    
    // RULE DEV: Fetch all metered/wiwo transactions to identify which invoices already have transactions.
    // We will hide invoices with existing active transactions, except draft onboarding baseline setups.
    const txUrl = `/api/ids/scm/inventory-management/inventory-control?directusCollection=lpg_metered_wiwo_transactions&limit=-1&fields=sales_invoice_id,status,transaction_type`;

    Promise.all([
      fetch(invoicesUrl).then((res) => res.json()),
      fetch(txUrl)
        .then((res) => res.json())
        .catch((err) => {
          console.error("Failed to fetch transactions", err);
          return { data: [] };
        })
    ])
      .then(([invoicesJson, txJson]) => {
        if (isMounted) {
          // Identify all invoice IDs that already have a non-cancelled transaction,
          // except if it is an onboarding baseline in draft status.
          const draftOnboardingInvoiceIds = new Set<number>();
          const invoicesWithTx = new Set<number>();

          (txJson.data || []).forEach((tx: { sales_invoice_id: number | string | null; status: string; transaction_type: string }) => {
            if (tx.sales_invoice_id && tx.status !== "CANCELLED") {
              const invId = Number(tx.sales_invoice_id);
              if (tx.transaction_type === "ONBOARDING_BASELINE" && tx.status === "DRAFT") {
                draftOnboardingInvoiceIds.add(invId);
              } else {
                invoicesWithTx.add(invId);
              }
            }
          });

          const mappedInvoices = (invoicesJson.data || [])
            .map((inv: {
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
              sales_order_no: inv.order_id?.order_no || null,
              // Mark as linked (and thus hidden) if it already has a transaction (unless draft onboarding)
              isLinked: invoicesWithTx.has(inv.invoice_id) && !draftOnboardingInvoiceIds.has(inv.invoice_id),
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
  }, [step, header.customer_id]);

  const resolvedLockedInvoice = useMemo(() => {
    if (!lockedInvoice) return null;
    const found = invoices.find(i => i.invoice_id === lockedInvoice.invoice_id);
    return found ? { ...lockedInvoice, ...found } : lockedInvoice;
  }, [lockedInvoice, invoices]);

  const visibleInvoices = useMemo(() => {
    return invoices.filter(inv => !inv.isLinked);
  }, [invoices]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectType = (type: "ROUTINE" | "ONBOARDING") => {
    if (type === "ONBOARDING" && (alreadyOnboarded || hasDraftOnboarding)) return;
    if (type === "ROUTINE" && (!alreadyOnboarded || hasDraftOnboarding)) return;
    setTransactionType(type);
  };

  const handleNextStep = () => {
    if (!transactionType) return;
    if (!lockedInvoice) {
      setSelectedInvoiceId(null);
    }
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    if (!lockedInvoice) {
      setSelectedInvoiceId(null);
    }
  };

  const handleProceed = () => {
    if (transactionType) {
      let finalInvoiceToPass: Invoice | null = null;
      const selectedInvoice = invoices.find(i => i.invoice_id === selectedInvoiceId) || null;

      if (selectedInvoice) {
        finalInvoiceToPass = selectedInvoice;
      } else if (hasDraftOnboarding) {
        finalInvoiceToPass = resolvedLockedInvoice as Invoice | null;
      }

      console.log("🚀 [CreateBillingWorkspace] Submitting to Parent Component:");
      console.log("   -> Transaction Type:", transactionType);
      console.log("   -> Invoice Data to Map:", finalInvoiceToPass);

      onProceed(transactionType, finalInvoiceToPass, hasDraftOnboarding ? draftTxId : null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-card/80 backdrop-blur-md border border-border h-[calc(100dvh-260px)] min-h-[380px] sm:h-auto flex flex-col rounded-3xl shadow-md w-full max-w-4xl mx-auto overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-transparent shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
              New Billing Transaction
            </p>
            <h2 className="text-base sm:text-lg font-black text-foreground truncate">
              {header.site?.site_name || `Site #${header.customer_site_id}`}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {header.customer_name || header.customer_id} · {formatDate(header.period_from)} → {formatDate(header.period_to)}
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${step > 1 ? "bg-emerald-500 text-white" : step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
              {step > 1 ? "✓" : "1"}
            </div>
            <div className={`h-px w-4 sm:w-6 transition-colors duration-300 ${step > 1 ? "bg-emerald-400" : "bg-border"
              }`} />
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
              2
            </div>
            <span className="hidden sm:flex flex-col text-[10px] text-muted-foreground ml-1">
              <span className={step === 1 ? "text-primary font-bold" : step > 1 ? "text-emerald-500 font-bold" : ""}>
                {step === 1 ? "Select Type" : "Type ✓"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Step 1: Select Transaction Type ────────────────────────────── */}
      {step === 1 && (
        <div className="p-4 sm:p-6 space-y-5 flex-1 flex flex-col justify-between min-h-0 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-5 flex-1 flex flex-col min-h-0">
            <div className="space-y-1 shrink-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Step 1 of 2 · Transaction Type
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Choose the billing flow for this header.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 overflow-y-auto">
              {/* ROUTINE */}
              <button
                type="button"
                onClick={() => handleSelectType("ROUTINE")}
                disabled={!alreadyOnboarded || hasDraftOnboarding || checkingOnboarded}
                className={`group relative p-4 sm:p-5 border-2 rounded-2xl text-left transition-all duration-200 ${(!alreadyOnboarded || hasDraftOnboarding)
                  ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                  : transactionType === "ROUTINE"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-lg shadow-primary/10"
                    : "border-border hover:border-primary/40 hover:bg-accent/60"
                  }`}
              >
                <div className={`absolute top-4 right-4 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${transactionType === "ROUTINE" ? "border-primary bg-primary" : "border-muted-foreground/40"
                  }`}>
                  {transactionType === "ROUTINE" && <CheckCircle2 className="h-3 w-3 text-white" />}
                </div>

                {checkingOnboarded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-card/60 rounded-2xl z-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${transactionType === "ROUTINE" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  }`}>
                  <RefreshCw className="h-5 w-5" />
                </div>

                <h3 className={`font-bold text-base mb-1.5 transition-colors ${transactionType === "ROUTINE" ? "text-primary" : "text-foreground"
                  }`}>
                  Regular Routine Check &amp; Swap
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Process physical cylinder validation, consumption comparison, and potential cylinder replacement.
                </p>

                {!alreadyOnboarded && !checkingOnboarded && (
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>Requires onboarding baseline first</span>
                  </div>
                )}

                {hasDraftOnboarding && (
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>Resume and post onboarding baseline first</span>
                  </div>
                )}

                {alreadyOnboarded && (
                  <div className="mt-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${transactionType === "ROUTINE" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                      <Zap className="h-2.5 w-2.5" />
                      REGULAR_BILLING
                    </span>
                  </div>
                )}
              </button>

              {/* ONBOARDING */}
              <button
                type="button"
                onClick={() => handleSelectType("ONBOARDING")}
                disabled={alreadyOnboarded || hasDraftOnboarding || checkingOnboarded}
                className={`group relative p-4 sm:p-5 border-2 rounded-2xl text-left transition-all duration-200 ${
                  (alreadyOnboarded || hasDraftOnboarding)
                    ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                    : transactionType === "ONBOARDING"
                      ? "border-emerald-500 bg-emerald-55 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/10"
                      : "border-border hover:border-emerald-500/40 hover:bg-accent/60"
                  }`}
              >
                <div className={`absolute top-4 right-4 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${transactionType === "ONBOARDING" ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40"
                  }`}>
                  {transactionType === "ONBOARDING" && <CheckCircle2 className="h-3 w-3 text-white" />}
                </div>

                {checkingOnboarded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-card/60 rounded-2xl z-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${transactionType === "ONBOARDING" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/30 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                  }`}>
                  <Package className="h-5 w-5" />
                </div>

                <h3 className={`font-bold text-base mb-1.5 transition-colors ${transactionType === "ONBOARDING" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                  }`}>
                  Onboarding Baseline Setup
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Deploy initial cylinders to a new LPG site. Establishes inventory baseline without billing consumption.
                </p>

                {alreadyOnboarded && (
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>Site already has an onboarding record</span>
                  </div>
                )}

                {hasDraftOnboarding && (
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-900/50">
                      <Zap className="h-2.5 w-2.5" />
                      DRAFT_ONBOARDING{draftTransactionNo ? ` : ${draftTransactionNo}` : ""}
                    </span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center px-4 sm:px-5 py-2.5 border border-border bg-card hover:bg-accent hover:text-foreground text-muted-foreground text-xs sm:text-sm font-bold rounded-xl transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              disabled={!transactionType}
              className="inline-flex items-center gap-1.5 px-4 sm:px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
            >
              Next: Link Invoice
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Link Sales Invoice ──────────────────────────────────── */}
      {step === 2 && (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-3 shrink-0">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${transactionType === "ROUTINE" ? "bg-primary/10 text-primary" : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              }`}>
              {transactionType === "ROUTINE" ? <RefreshCw className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
              {transactionType === "ROUTINE" ? "Regular Routine Check & Swap" : "Onboarding Baseline Setup"}
            </div>
            <button
              type="button"
              onClick={handleBack}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              Change
            </button>
          </div>

          <div className="space-y-1.5 shrink-0">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Step 2 of 2 · Link Sales Invoice
            </p>
            <p className="text-sm text-muted-foreground">
              Select the sales invoice to attach to this billing transaction.
            </p>
          </div>

          {/* Invoice selection layout */}
          {lockedInvoice && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-400 flex items-center gap-2 mb-3 shrink-0">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Selection is locked to the sales invoice from your draft onboarding setup.</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground flex-1">
              <Loader2 className="h-7 w-7 animate-spin" />
              <span className="text-sm animate-pulse">Fetching eligible invoices...</span>
            </div>
          ) : visibleInvoices.length === 0 && !lockedInvoice ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground bg-accent/40 rounded-2xl border border-dashed border-border flex-1">
              <Receipt className="h-8 w-8 opacity-40" />
              <div className="text-center">
                <p className="text-sm font-semibold">No eligible invoices found</p>
                <p className="text-xs mt-0.5 max-w-xs">
                  No available sales invoices found for this customer.
                </p>
              </div>
            </div>
          ) : (
            /* AG-CHANGE: Replaced max-h-60 with flex-1 min-h-[180px] on mobile (fills height), scaling back to sm:max-h-72 sm:flex-none on desktop */
            <div className="grid grid-cols-1 gap-2.5 flex-1 min-h-[180px] sm:flex-none sm:min-h-0 sm:max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {/* If lockedInvoice is set and not in the main list, display it */}
              {resolvedLockedInvoice && !visibleInvoices.some(i => i.invoice_id === resolvedLockedInvoice.invoice_id) && (
                <button
                  type="button"
                  disabled
                  className="group relative flex flex-col p-4 border-2 rounded-2xl text-left transition-all duration-200 border-primary bg-primary/10 ring-2 ring-primary/20 shadow-md opacity-80 cursor-not-allowed"
                >
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/20 text-primary">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-bold text-primary">
                      {resolvedLockedInvoice.sales_invoice_no || resolvedLockedInvoice.invoice_no}
                    </span>
                  </div>
                  <div className="space-y-0.5 pl-9">
                    {resolvedLockedInvoice.invoice_date && (
                      <p className="text-[11px] text-muted-foreground">
                        📅 {resolvedLockedInvoice.invoice_date}
                      </p>
                    )}
                    {resolvedLockedInvoice.total_amount && (
                      <p className="text-[11px] font-semibold text-foreground">
                        ₱{resolvedLockedInvoice.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </button>
              )}

              {/* RULE DEV: Filter out isLinked invoices completely — they are not shown in the list.
                  Only invoices linked to THIS header or unlinked invoices are displayed. */}
              {visibleInvoices.map((inv) => {
                const isSelected = selectedInvoiceId === inv.invoice_id;
                const isLocked = !!lockedInvoice;
                const isDisabled = isLocked && !isSelected;
                return (
                  <button
                    key={inv.invoice_id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && setSelectedInvoiceId(inv.invoice_id)}
                    className={`group relative flex flex-col p-4 border-2 rounded-2xl text-left transition-all duration-200 ${isSelected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-md"
                      : isLocked
                        ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                        : "border-border hover:border-primary/40 hover:bg-accent/60"
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                        }`}>
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <span className={`text-sm font-bold ${isSelected ? "text-primary" : "text-foreground"
                        }`}>
                        {inv.sales_invoice_no || inv.invoice_no}
                      </span>
                    </div>

                    <div className="space-y-0.5 pl-9">
                      <p className="text-[11px] text-muted-foreground">
                        {inv.invoice_date}
                      </p>
                      <p className="text-[11px] font-semibold text-foreground">
                        ₱{inv.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      {/* <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full ${inv.transaction_status === "POSTED"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                        : inv.transaction_status === "CANCELLED"
                          ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                          : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                        }`}>
                        {inv.transaction_status}
                      </span> */}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border gap-2 shrink-0">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={handleProceed}
              disabled={!selectedInvoiceId}
              className="inline-flex items-center gap-1.5 px-4 sm:px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20"
            >
              <span className="hidden sm:inline">Proceed to Physical Validation</span>
              <span className="sm:hidden">Proceed</span>
              <PlusCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}