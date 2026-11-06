// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/components/AccountabilityDrawer.tsx
// ==============================================================================
// Slide-Over Audit Drawer for Customer Cylinder Accountability Report
// Provides granular drill-down into chronological transaction movements,
// physical serialized cylinder custody, and exception audits.
//
// Complies with VoSync Design System standards:
// - Framer Motion spring animations & backdrop blur
// - Multi-tab segregation: Ledger, Active Serials, Exceptions
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Cylinder,
  History,
  Building2,
  Clock,
  ArrowUpRight,
  Repeat,
  ArrowDownLeft,
} from "lucide-react";
import { useCustomerCylinderAccountability } from "../hooks/useCustomerCylinderAccountability";
import { OwnershipBadge } from "./OwnershipBadge";

export function AccountabilityDrawer() {
  const {
    selectedCustomerCode,
    customerDetail,
    isDetailLoading,
    closeCustomerDetail,
  } = useCustomerCylinderAccountability();

  const [activeTab, setActiveTab] = React.useState<"ledger" | "serials" >("ledger");

  // Escape key handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCustomerDetail();
    };
    if (selectedCustomerCode) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCustomerCode, closeCustomerDetail]);

 

  return (
    <AnimatePresence>
      {selectedCustomerCode && (
        <motion.div
          key="drawer-wrapper"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex justify-end overflow-hidden"
        >
          {/* ── Backdrop ─────────────────────────────────────────────────── */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs cursor-pointer"
            onClick={closeCustomerDetail}
          />

          {/* ── Slide Sheet ──────────────────────────────────────────────── */}
          <motion.div
            key="drawer-sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280, mass: 0.8 }}
            className="relative z-10 flex h-full w-full max-w-3xl flex-col bg-background shadow-2xl border-l"
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between border-b p-5 bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                    {customerDetail?.customerCode || selectedCustomerCode}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {customerDetail?.branchName || "Branch"}
                  </span>
                  <OwnershipBadge ownership={customerDetail?.ownership} />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  {customerDetail?.customerName || "Loading customer ledger..."}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCustomerDetail}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Custody Balance Quick Strip (SNET Spec v1.0 §10, §11) ─── */}
            {/* AG-COMMENT: 4 core custody metrics: Opening, Current Held, Limit, Variance */}
            <div className="grid grid-cols-2 gap-3 border-b px-5 py-3 bg-muted/10 sm:grid-cols-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Opening</span>
                <span className="font-mono text-base font-bold text-foreground">
                  {customerDetail ? customerDetail.openingBase.toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Current Held (=)</span>
                <span className="font-mono text-base font-bold text-indigo-600 dark:text-indigo-400">
                  {customerDetail ? customerDetail.closingBase.toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Authorized Limit</span>
                <span className="font-mono text-base font-bold text-foreground">
                  {customerDetail ? customerDetail.authorizedLimit.toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Variance</span>
                {customerDetail ? (
                  <span
                    className={`font-mono text-base font-bold ${
                      customerDetail.variance > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {customerDetail.variance > 0
                      ? `+${customerDetail.variance}`
                      : customerDetail.variance}
                  </span>
                ) : (
                  <span className="font-mono text-base font-bold text-muted-foreground">—</span>
                )}
              </div>
              
            </div>

            {/* ── Navigation Tabs ────────────────────────────────────────── */}
            <div className="flex border-b px-5 gap-6 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("ledger")}
                className={`py-3 flex items-center gap-1.5 border-b-2 transition ${
                  activeTab === "ledger"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>Transaction Ledger ({customerDetail?.transactions?.length ?? 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("serials")}
                className={`py-3 flex items-center gap-1.5 border-b-2 transition ${
                  activeTab === "serials"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Cylinder className="h-3.5 w-3.5" />
                <span>Physical Custody Serials ({customerDetail?.activeSerialsInCustody?.length ?? 0})</span>
              </button>

            
            </div>

            {/* ── Drawer Body Content ────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5">
              {isDetailLoading ? (
                <div className="space-y-3 animate-pulse">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-muted" />
                  ))}
                </div>
              ) : activeTab === "ledger" ? (
                /* ── Tab 1: Chronological Ledger ───────────────────────────── */
                <div className="space-y-3">
                  {!customerDetail?.transactions || customerDetail.transactions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground space-y-1.5 px-4">
                      <p className="font-medium text-foreground">
                        No verified cylinder transactions found for this customer within the selected period.
                      </p>
                      <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                        All physical custody serials ({customerDetail?.activeSerialsInCustody?.length ?? 0}) were issued in prior periods. Adjust the <strong>Period Start</strong> filter in the top bar (e.g. to June 2026) to view previous onboarding issuances and refill movements.
                      </p>
                    </div>
                  ) : (
                    customerDetail.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className={`rounded-xl border p-3.5 text-xs transition ${
                          tx.hasException ? "border-amber-500/40 bg-amber-500/5" : "bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-foreground">
                                {tx.transactionDate}
                              </span>
                              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {tx.sourceModule}: {tx.sourceHeaderId}
                              </span>
                              
                            </div>
                            <div className="font-semibold text-foreground text-sm">
                              {tx.productName}
                            </div>
                          </div>

                          {/* Running Base Impact */}
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 font-mono text-sm font-bold">
                              {tx.activityType === "DEPOSIT" && (
                                <span className="text-emerald-600 dark:text-emerald-400 flex items-center">
                                  <ArrowUpRight className="h-3.5 w-3.5" />+{tx.depositQty}
                                </span>
                              )}
                              {tx.activityType === "SWAP" && (
                                <span className="text-primary flex items-center">
                                  <Repeat className="h-3.5 w-3.5" />{tx.swapQty} (±0)
                                </span>
                              )}
                              {tx.activityType === "PULL_OUT" && (
                                <span className="text-rose-600 dark:text-rose-400 flex items-center">
                                  <ArrowDownLeft className="h-3.5 w-3.5" />-{tx.pullOutQty}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Running Base: <span className="font-bold font-mono text-foreground">{tx.runningBase}</span>
                            </div>
                          </div>
                        </div>

                        {/* Serials preview if any */}
                        {tx.serialNumbers && tx.serialNumbers.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {tx.serialNumbers.map((sn, sIdx) => (
                              <span key={sIdx} className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {sn}
                              </span>
                            ))}
                          </div>
                        )}

                      
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* ── Tab 2: Physical Serial Custody ────────────────────────── */
                <div className="space-y-2">
                  {!customerDetail?.activeSerialsInCustody || customerDetail.activeSerialsInCustody.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      No active serialized cylinder assets currently registered in this customer&#39;s custody.
                    </div>
                  ) : (
                    customerDetail.activeSerialsInCustody.map((serial, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border bg-card p-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Cylinder className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-mono text-xs font-bold text-foreground">
                              {serial.serialNumber}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {serial.productName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="block text-[10px] uppercase text-muted-foreground">Condition</span>
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              {serial.condition || "GOOD"}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase text-muted-foreground">Days with Customer</span>
                            <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {serial.daysWithCustomer}d
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) }
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
