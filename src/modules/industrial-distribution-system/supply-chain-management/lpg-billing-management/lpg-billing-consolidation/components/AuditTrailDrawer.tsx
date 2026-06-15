"use client";

// ─── AuditTrailDrawer.tsx ─────────────────────────────────────────────────────
// Side-drawer that shows the full adjustment history for a child transaction.
// Opened by the reviewer to trace what was changed, by whom, and when.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { X, History, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConsolidationAuditEntry } from "../types/billing-consolidation.types";

interface AuditTrailDrawerProps {
  isOpen: boolean;
  transactionNo: string;
  entries: ConsolidationAuditEntry[];
  isLoading: boolean;
  onClose: () => void;
}

// ─── Helper: Format Change Value ──────────────────────────────────────────────

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") return val.toLocaleString("en-PH", { maximumFractionDigits: 6 });
  return String(val);
}

// ─── Helper: Human-readable field label ──────────────────────────────────────

function humanize(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AuditTrailDrawer({
  isOpen,
  transactionNo,
  entries,
  isLoading,
  onClose,
}: AuditTrailDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 w-full max-w-md",
          "bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800",
          "flex flex-col shadow-2xl",
          "animate-in slide-in-from-right-full duration-300"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <History className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                Audit Trail
              </p>
              <p className="text-[10px] text-muted-foreground">
                {transactionNo}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Loading */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800/40 animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                No adjustments recorded
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                All reviewer adjustments to this transaction will appear here.
              </p>
            </div>
          )}

          {/* Entries */}
          {!isLoading &&
            entries.map((entry) => (
              <div
                key={entry.audit_id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900 overflow-hidden"
              >
                {/* Entry Header */}
                <div className="px-3 py-2 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      {entry.action_type.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-2.5 w-2.5" />
                      User #{entry.modified_by ?? "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(entry.modified_date).toLocaleString("en-PH", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>

                {/* Changed Fields */}
                <div className="px-3 py-2 space-y-1.5">
                  {Object.entries(entry.changes_payload).map(([field, change]) => {
                    // Skip the adjustment_reason row — show it separately
                    if (field === "adjustment_reason") return null;
                    return (
                      <div key={field} className="flex items-start gap-2 text-[10px]">
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400 w-32 shrink-0 truncate">
                          {humanize(field)}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 font-mono line-through">
                          {formatValue(change.old)}
                        </span>
                        <span className="text-zinc-400">→</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                          {formatValue(change.new)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Show reason if present */}
                  {entry.changes_payload["adjustment_reason"] && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700">
                      <p className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">
                        Reason
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 italic">
                        {formatValue(entry.changes_payload["adjustment_reason"].new)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
