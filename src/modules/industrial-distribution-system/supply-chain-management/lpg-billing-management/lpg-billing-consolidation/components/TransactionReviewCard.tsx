"use client";

// ─── TransactionReviewCard.tsx ────────────────────────────────────────────────
// Expandable card for a single child transaction inside the workspace.
// Shows the period, KG summary, and expands to reveal the MeterReadingReviewPanel
// and/or WiwoReviewPanel depending on which records exist.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { ChevronDown, ChevronRight, History, Calendar, Gauge, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MeterReadingReviewPanel } from "./MeterReadingReviewPanel";
import { WiwoReviewPanel } from "./WiwoReviewPanel";
import type { ConsolidationTransaction } from "../types/billing-consolidation.types";
import type { UseBillingConsolidationReturn } from "../hooks/useBillingConsolidation";

interface TransactionReviewCardProps {
  transaction: ConsolidationTransaction;
  hook: UseBillingConsolidationReturn;
  onOpenAudit: (transactionId: number, transactionNo: string) => void;
}

const BILLABLE_SOURCE_LABELS: Record<string, string> = {
  METERED: "Metered",
  WIWO: "WIWO",
  NONE: "None",
};

export function TransactionReviewCard({
  transaction,
  hook,
  onOpenAudit,
}: TransactionReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasMeterReading = !!transaction.meter_reading;
  const hasWiwo = !!transaction.wiwo_header;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden transition-shadow",
        isExpanded
          ? "border-primary/30 shadow-md"
          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
      )}
    >
      {/* ── Card Header (always visible) ─────────────────────────────────── */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left group"
        onClick={() => setIsExpanded((v) => !v)}
      >
        {/* Expand Icon */}
        <span className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>

        {/* Transaction Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
              {transaction.transaction_no}
            </span>
            {/* Type badge */}
            <Badge className="text-[9px] px-1.5 py-0 bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
              {transaction.transaction_type.replace("_", " ")}
            </Badge>
            {/* Source badge */}
            <Badge
              className={cn(
                "text-[9px] px-1.5 py-0 border",
                transaction.billable_source === "METERED"
                  ? "bg-primary/10 text-primary border-primary/20 dark:bg-primary/25 dark:text-primary-foreground/90"
                  : transaction.billable_source === "WIWO"
                  ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
                  : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500"
              )}
            >
              {BILLABLE_SOURCE_LABELS[transaction.billable_source] ?? transaction.billable_source}
            </Badge>
          </div>

          {/* Period */}
          <div className="flex items-center gap-1 mt-0.5">
            <Calendar className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {transaction.billing_period_from ?? transaction.transaction_date}
              {transaction.billing_period_to && ` → ${transaction.billing_period_to}`}
            </span>
          </div>
        </div>

        {/* KG Summary */}
        <div className="flex items-center gap-4 shrink-0">
          {hasMeterReading && (
            <div className="text-right hidden sm:block">
              <p className="text-[9px] text-muted-foreground flex items-center gap-1 justify-end">
                <Gauge className="h-2.5 w-2.5" /> Metered
              </p>
              <p className="text-xs font-black text-primary">
                {transaction.metered_kg.toFixed(3)} kg
              </p>
            </div>
          )}
          {hasWiwo && (
            <div className="text-right hidden sm:block">
              <p className="text-[9px] text-muted-foreground flex items-center gap-1 justify-end">
                <Scale className="h-2.5 w-2.5" /> {transaction.transaction_type === "ONBOARDING_BASELINE" ? "Deployed Gross" : "WIWO"}
              </p>
              <p className="text-xs font-black text-blue-700 dark:text-blue-300">
                {transaction.wiwo_kg.toFixed(3)} kg
              </p>
            </div>
          )}
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground">Billable</p>
            <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
              {transaction.billable_kg.toFixed(3)} kg
            </p>
          </div>
        </div>
      </button>

      {/* ── Expanded Content ──────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          {/* Audit Trail Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300"
              onClick={() => onOpenAudit(transaction.id, transaction.transaction_no)}
            >
              <History className="h-3 w-3" />
              View Audit Trail
            </Button>
          </div>

          {/* Meter Reading Panel */}
          {hasMeterReading && transaction.meter_reading && (
            <MeterReadingReviewPanel
              reading={transaction.meter_reading}
              attachments={transaction.attachments ?? []}
              transactionId={transaction.id}
              isOnboarding={transaction.transaction_type === "ONBOARDING_BASELINE"}
              isSubmitting={hook.isSubmitting}
              onAdjust={hook.adjustMeterReading}
            />
          )}

          {/* WIWO Panel */}
          {hasWiwo && transaction.wiwo_header && (
            <WiwoReviewPanel
              wiwoHeader={transaction.wiwo_header}
              attachments={transaction.attachments ?? []}
              transactionId={transaction.id}
              isSubmitting={hook.isSubmitting}
              onAdjust={hook.adjustWiwoDetail}
            />
          )}

          {/* No sub-records */}
          {!hasMeterReading && !hasWiwo && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No meter reading or WIWO record attached to this transaction.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
