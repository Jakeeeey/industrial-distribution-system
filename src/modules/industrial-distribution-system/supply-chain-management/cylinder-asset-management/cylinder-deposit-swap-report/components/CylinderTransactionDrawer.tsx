// src/modules/industrial-distribution-system/bia/cylinder-deposit-swap-report/components/CylinderTransactionDrawer.tsx
// ==============================================================================
// Slide-Over Audit Drawer for Cylinder Deposit and Swap Report.
// Enhanced with Framer Motion for ultra-smooth spring slide-in, backdrop fade,
// and tab content transitions.
//
// Complies with Vertex IDS standards:
// - Full comments left behind for long-term maintainability
// - High-performance hardware-accelerated animations
// ==============================================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Cylinder,
  CircleDollarSign,
  History,
  MapPin,
  Phone,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { useCylinderDepositSwapReport } from "../hooks/useCylinderDepositSwapReport";
import { OwnershipBadge } from "./OwnershipBadge";

export function CylinderTransactionDrawer() {
  const {
    selectedCustomerCode,
    customerDetail,
    isDetailLoading,
    closeCustomerDetail,
  } = useCylinderDepositSwapReport();

  const [activeTab, setActiveTab] = React.useState<"serials" | "deposits" | "history">("serials");

  // Close on Escape key press
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
          {/* ── Backdrop with smooth fade ────────────────────────────────────── */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs cursor-pointer"
            onClick={closeCustomerDetail}
          />

          {/* ── Slide Sheet with Framer Motion spring physics ────────────────── */}
          <motion.div
            key="drawer-sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280, mass: 0.8 }}
            className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl border-l"
          >
            {/* ── Drawer Header ─────────────────────────────────────────────── */}
            <div className="flex items-start justify-between border-b p-5 bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                    {customerDetail?.customerCode || selectedCustomerCode}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {customerDetail?.branchName || "Branch"}
                  </span>
                  <OwnershipBadge ownership="COMPANY" />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  {customerDetail?.customerName || "Loading customer details..."}
                </h2>
                {customerDetail?.storeName && (
                  <p className="text-xs text-muted-foreground">Store: {customerDetail.storeName}</p>
                )}
              </div>

              <button
                type="button"
                onClick={closeCustomerDetail}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                title="Close Drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Customer Info Quick Card ───────────────────────────────────── */}
            <div className="border-b px-5 py-3 bg-muted/10 grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{customerDetail?.customerAddress || "No address on file"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{customerDetail?.contactNumber || "No contact recorded"}</span>
              </div>
            </div>

            {/* ── Tabs Navigation ────────────────────────────────────────────── */}
            <div className="flex border-b px-5 gap-4 bg-card">
              <button
                type="button"
                onClick={() => setActiveTab("serials")}
                className={`flex items-center gap-2 border-b-2 py-3 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "serials"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Cylinder className="h-4 w-4" />
                <span>Physical Cylinders ({customerDetail?.activeSerials.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("deposits")}
                className={`flex items-center gap-2 border-b-2 py-3 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "deposits"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <CircleDollarSign className="h-4 w-4" />
                <span>Cash Deposits ({customerDetail?.financialDeposits.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-2 border-b-2 py-3 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "history"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <History className="h-4 w-4" />
                <span>Movement Timeline</span>
              </button>
            </div>

            {/* ── Tab Content Body with Framer Motion ───────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5">
              <AnimatePresence mode="wait">
                {isDetailLoading ? (
                  <motion.div
                    key="tab-loading"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground"
                  >
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-xs">Loading customer asset history...</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {/* TAB 1: ACTIVE PHYSICAL SERIALS */}
                    {activeTab === "serials" && (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Physical cylinders currently registered in this customer&#39;s active custody.
                        </p>
                        {customerDetail?.activeSerials.length === 0 ? (
                          <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
                            No physical cylinders currently tracked under this customer account.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {customerDetail?.activeSerials.map((ser, idx) => {
                              const isStagnant = ser.daysWithCustomer > 60;
                              const isWarning = ser.daysWithCustomer > 30 && !isStagnant;

                              return (
                                <motion.div
                                  key={ser.serialNumber || idx}
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.02, duration: 0.15 }}
                                  className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-2xs hover:shadow-xs transition-shadow"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`flex h-8 w-8 items-center justify-center rounded-md ${
                                        isStagnant
                                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                          : isWarning
                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                      }`}
                                    >
                                      <Cylinder className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="font-mono text-xs font-bold text-foreground">
                                        {ser.serialNumber}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground">
                                        {ser.productName} • Condition: {ser.cylinderCondition}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        isStagnant
                                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                                          : isWarning
                                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      }`}
                                    >
                                      {ser.daysWithCustomer} Days on Site
                                    </span>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      Deployed: {ser.deployedDate || "N/A"}
                                    </p>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 2: MATCHED CASH DEPOSITS */}
                    {activeTab === "deposits" && (
                      <div className="space-y-3">
                        <div className="rounded-lg bg-blue-50/60 dark:bg-blue-950/30 p-3 text-xs text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
                          <p className="font-medium">Financial Cash Guarantee Link</p>
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                            Cross-references security deposit receipts from Treasury / Accounting without conflating currency with physical units.
                          </p>
                        </div>

                        <div className="space-y-2">
                          {customerDetail?.financialDeposits.map((dep, idx) => (
                            <motion.div
                              key={dep.id || idx}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.03, duration: 0.15 }}
                              className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-2xs"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                  <CircleDollarSign className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="font-mono text-xs font-bold text-foreground">
                                    {dep.referenceNumber}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {dep.remarks || "Customer Guarantee Deposit"}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  ₱{dep.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  {dep.status} • {dep.transactionDate}
                                </span>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TAB 3: MOVEMENT HISTORY TIMELINE */}
                    {activeTab === "history" && (
                      <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                          Chronological audit log of deliveries, refill swaps, and returns.
                        </p>

                        <div className="relative pl-6 border-l space-y-4">
                          {customerDetail?.movementHistory.map((mov, idx) => (
                            <motion.div
                              key={mov.id || idx}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03, duration: 0.15 }}
                              className="relative group"
                            >
                              <div className="absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                                •
                              </div>

                              <div className="rounded-lg border bg-card p-3 shadow-2xs text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-foreground">
                                    {mov.transactionType === "DEPOSIT_OUT"
                                      ? "New Cylinder Deposit Issued"
                                      : mov.transactionType === "SWAP_IN"
                                      ? "Empty Swap Received"
                                      : mov.transactionType === "SWAP_OUT"
                                      ? "Full Refill Delivered"
                                      : "Cylinder Returned"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {mov.transactionDate}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <span className="font-mono font-medium text-foreground">
                                    {mov.referenceNo}
                                  </span>
                                  <span>•</span>
                                  <span>Source: {mov.sourceModule}</span>
                                  <span>•</span>
                                  <span>Qty: {mov.quantity}</span>
                                </div>

                                {mov.serialNumbers.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {mov.serialNumbers.map((s, sIdx) => (
                                      <span
                                        key={sIdx}
                                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                                      >
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {mov.notes && (
                                  <p className="text-[10px] text-muted-foreground italic pt-0.5">
                                    {mov.notes}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Drawer Footer ──────────────────────────────────────────────── */}
            <div className="border-t p-4 bg-muted/20 flex justify-end">
              <button
                type="button"
                onClick={closeCustomerDetail}
                className="rounded-lg border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
