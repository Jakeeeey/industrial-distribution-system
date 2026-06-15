"use client";

// ─── LpgBillingConsolidationModule.tsx ───────────────────────────────────────
// Module root component for the LPG Billing Consolidation reviewer.
// Overhauled as a premium sequential 3-step stepper UI.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Scale, ArrowLeft, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBillingConsolidation } from "./hooks/useBillingConsolidation";
import { ConsolidationHeaderWorkspace } from "./components/ConsolidationHeaderWorkspace";
import { ConsolidationWorkspace } from "./components/ConsolidationWorkspace";
import { cn } from "@/lib/utils";

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function LpgBillingConsolidationModule() {
  const hook = useBillingConsolidation();
  const { selectedHeader, selectHeader, clearSelection } = hook;

  // Active step: 1 (Select Header), 2 (Process Invoices), 3 (Approve & Create SI)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Sync step with selected header status
  useEffect(() => {
    if (!selectedHeader) {
      setStep(1);
    } else if (step === 1) {
      if (selectedHeader.status === "DRAFT") {
        setStep(2);
      } else {
        setStep(3);
      }
    }
  }, [selectedHeader, step]);

  const handleSelectHeader = (headerId: number) => {
    selectHeader(headerId);
  };

  const handleBackToSelect = () => {
    clearSelection();
    setStep(1);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-full border border-border rounded-xl sm:rounded-2xl bg-card text-card-foreground shadow-lg m-1 sm:m-4 animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-sm">
            <Scale className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground leading-tight">
              LPG Billing Consolidation
            </h1>
            <p className="text-[11px] text-muted-foreground hidden sm:block mt-0.5">
              Consolidate customer metered and WIWO deliveries into Sales Invoices.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Workspace Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4 lg:p-6 bg-background custom-scrollbar">
        {step === 1 || !selectedHeader ? (
          <ConsolidationHeaderWorkspace hook={hook} onSelect={handleSelectHeader} />
        ) : (
          <div className="space-y-4 w-full max-w-6xl mx-auto">
            {/* ── Header Info & Stepper Bar ── */}
            <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Selected Header
                </p>
                <h2 className="font-bold text-sm sm:text-base text-foreground truncate">
                  {selectedHeader.header_no || `Header #${selectedHeader.header_id}`}
                </h2>
                <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-primary">
                  <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatDate(selectedHeader.period_from)}</span>
                  <span className="opacity-50">→</span>
                  <span>{formatDate(selectedHeader.period_to)}</span>
                </div>
              </div>

              {/* Step indicator progress bar */}
              <div className="flex items-center gap-2 shrink-0 select-none">
                {/* Step 2 Pill */}
                <button
                  type="button"
                  disabled={selectedHeader.status !== "DRAFT"}
                  onClick={() => setStep(2)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black transition-all border",
                    step === 2
                      ? "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground/90 dark:border-primary/30 shadow-sm"
                      : "bg-muted text-muted-foreground border-transparent hover:bg-accent hover:text-foreground disabled:hover:bg-muted"
                  )}
                >
                  <span className={cn(
                    "h-4 w-4 rounded-full flex items-center justify-center text-[10px]",
                    step === 2 ? "bg-primary/20 text-primary" : "bg-black/10 dark:bg-white/10"
                  )}>
                    2
                  </span>
                  Process Invoices
                </button>

                <span className="text-muted-foreground/40 font-mono text-sm">→</span>

                {/* Step 3 Pill */}
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black transition-all border",
                    step === 3
                      ? "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground/90 dark:border-primary/30 shadow-sm"
                      : "bg-muted text-muted-foreground border-transparent hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span className={cn(
                    "h-4 w-4 rounded-full flex items-center justify-center text-[10px]",
                    step === 3 ? "bg-primary/20 text-primary" : "bg-black/10 dark:bg-white/10"
                  )}>
                    3
                  </span>
                  Approve & Create SI
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 md:border-l md:border-border md:pl-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToSelect}
                  className="font-medium shadow-sm hover:bg-accent/50 text-xs h-8 px-3"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Change Header
                </Button>
              </div>
            </div>

            {/* Workspace View */}
            <div className="w-full">
              <ConsolidationWorkspace hook={hook} step={step} setStep={setStep} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

