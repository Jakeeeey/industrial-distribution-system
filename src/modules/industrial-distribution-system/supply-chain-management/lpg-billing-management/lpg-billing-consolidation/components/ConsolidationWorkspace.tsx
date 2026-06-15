"use client";

// ─── ConsolidationWorkspace.tsx ───────────────────────────────────────────────
// Right-panel: selected header workspace.
// Shows the header summary card, all child transaction review cards,
// the billing totals footer bar, and the audit trail drawer.
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TransactionReviewCard } from "./TransactionReviewCard";
import { BillingTotalsBar } from "./BillingTotalsBar";
import { AuditTrailDrawer } from "./AuditTrailDrawer";
import type { UseBillingConsolidationReturn } from "../hooks/useBillingConsolidation";

interface ConsolidationWorkspaceProps {
  hook: UseBillingConsolidationReturn;
}

export function ConsolidationWorkspace({ hook }: ConsolidationWorkspaceProps) {
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

  const handleOpenAudit = useCallback(
    async (transactionId: number, transactionNo: string) => {
      setAuditTxNo(transactionNo);
      setAuditOpen(true);
      await loadAuditTrail(transactionId);
    },
    [loadAuditTrail]
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoadingWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-sm font-semibold">Loading workspace...</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (workspaceError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <div className="h-12 w-12 rounded-2xl bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
        </div>
        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Failed to load workspace</p>
        <p className="text-xs text-muted-foreground max-w-xs">{workspaceError}</p>
      </div>
    );
  }

  // ── No Selection ──────────────────────────────────────────────────────────
  if (!selectedHeader) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-violet-100/50 dark:bg-violet-900/20 flex items-center justify-center border border-dashed border-violet-300 dark:border-violet-700/50">
          <ClipboardList className="h-7 w-7 text-violet-400 dark:text-violet-500 animate-pulse" />
        </div>
        <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
          No Billing Header Selected
        </p>
        <p className="text-xs text-muted-foreground max-w-[260px]">
          Select a billing header from the list on the left to begin reviewing its transactions.
        </p>
      </div>
    );
  }

  const canApprove = selectedHeader.status === "DRAFT";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header Summary Card ────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Identity */}
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
              <ReceiptText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-zinc-800 dark:text-zinc-100">
                  {selectedHeader.header_no ?? `Header #${selectedHeader.header_id}`}
                </h2>
                <Badge
                  className={cn(
                    "text-[10px] px-1.5 py-0 border",
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
                  <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400">
                    Billed
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Building2 className="h-2.5 w-2.5" />
                  {selectedHeader.customer_id}
                  {selectedHeader.site?.site_name ? ` · ${selectedHeader.site.site_name}` : ""}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Calendar className="h-2.5 w-2.5" />
                  {selectedHeader.period_from} → {selectedHeader.period_to}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Approve CTA */}
          {canApprove && (
            <Button
              size="sm"
              onClick={() => approveHeader(selectedHeader.header_id)}
              disabled={isSubmitting}
              className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSubmitting ? "Processing..." : "Approve & Generate Sales Invoice"}
            </Button>
          )}
          {!canApprove && selectedHeader.status === "POSTED" && (
            <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs font-semibold px-3 py-1.5 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approved
            </Badge>
          )}
        </div>

        {/* Remarks */}
        {selectedHeader.remarks && (
          <p className="mt-2 text-[10px] text-muted-foreground italic pl-13">
            {selectedHeader.remarks}
          </p>
        )}
      </div>

      {/* ── Transaction Cards ─────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              No child transactions found
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              This billing header has no associated metered or WIWO transactions yet.
            </p>
          </div>
        )}

        {transactions.map((tx) => (
          <TransactionReviewCard
            key={tx.id}
            transaction={tx}
            hook={hook}
            onOpenAudit={handleOpenAudit}
          />
        ))}
      </div>

      {/* ── Totals Footer Bar ─────────────────────────────────────────────── */}
      {transactions.length > 0 && (
        <BillingTotalsBar transactions={transactions} />
      )}

      {/* ── Audit Trail Drawer ────────────────────────────────────────────── */}
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
