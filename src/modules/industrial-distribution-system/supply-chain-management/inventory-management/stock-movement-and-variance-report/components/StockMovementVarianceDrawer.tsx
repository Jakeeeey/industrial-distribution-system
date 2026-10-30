// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/StockMovementVarianceDrawer.tsx
// ==============================================================================
// Supporting-Record Slide-Over Panel (spec §2 "drill into supporting records").
// Shows the ledger documents behind a line, the count it was measured against,
// unmatched serials and retained adjustment references. Every figure is read-only
// evidence; correcting anything happens in the originating module.
// ==============================================================================

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  FileClock,
  Link2,
  Ruler,
  ScanLine,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStockMovementVarianceReport } from "../hooks/useStockMovementVarianceReport";
import { formatQty, formatSigned } from "../services/stock-movement-variance.calc";
import { ExceptionBadge } from "./ExceptionBadge";

type PanelTab = "documents" | "exceptions" | "references";

/** Compact labelled figure used across the panel header. */
function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "short" | "over" | "muted";
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-2.5 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "short" && "text-red-600 dark:text-red-400",
          tone === "over" && "text-amber-600 dark:text-amber-400",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function StockMovementVarianceDrawer() {
  const { selectedRow, closeRowDetail, report } = useStockMovementVarianceReport();
  const [activeTab, setActiveTab] = React.useState<PanelTab>("documents");

  // Escape always closes the panel.
  React.useEffect(() => {
    if (!selectedRow) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRowDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedRow, closeRowDetail]);

  const voidedForBranch = React.useMemo(() => {
    if (!selectedRow || !report) return [];
    const own = new Set(selectedRow.supportingDocuments.map((doc) => doc.docNo));
    return report.excludedDocuments.filter((doc) => !own.has(doc.docNo));
  }, [selectedRow, report]);

  const serialCount = selectedRow?.serialExceptions.length ?? 0;

  return (
    <AnimatePresence>
      {selectedRow ? (
        <motion.div
          key="variance-drawer"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex justify-end overflow-hidden"
        >
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeRowDetail}
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
          />

          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="relative flex h-full w-full max-w-xl flex-col border-l bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`Supporting records for ${selectedRow.productName}`}
          >
            {/* ── Panel header ─────────────────────────────────────────────── */}
            <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Supporting records
                </p>
                <h2 className="truncate text-sm font-semibold">{selectedRow.productName}</h2>
                <p className="truncate text-[11px] text-muted-foreground">
                  {selectedRow.productCode ?? `ID ${selectedRow.productId}`} ·{" "}
                  {selectedRow.branchName || `Branch #${selectedRow.branchId}`} · unit factor{" "}
                  {formatQty(selectedRow.unitCount)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRowDetail}
                aria-label="Close supporting records"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* ── Reconciliation arithmetic ────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 border-b px-4 py-3 sm:grid-cols-6">
              <Metric label="Opening" value={formatQty(selectedRow.openingBalance)} />
              <Metric label="In" value={formatQty(selectedRow.periodIn)} />
              <Metric label="Out" value={formatQty(selectedRow.periodOut)} />
              <Metric label="Expected" value={formatQty(selectedRow.expectedClosing)} />
              <Metric
                label="Counted"
                value={formatQty(selectedRow.countedClosing)}
                tone={selectedRow.countedClosing === null ? "muted" : undefined}
              />
              <Metric
                label="Variance"
                value={formatSigned(selectedRow.variance)}
                tone={
                  selectedRow.variance === null
                    ? "muted"
                    : selectedRow.variance < 0
                      ? "short"
                      : selectedRow.variance > 0
                        ? "over"
                        : undefined
                }
              />
            </div>

            {/* ── Count document ───────────────────────────────────────────── */}
            <div className="border-b px-4 py-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                <Ruler className="h-3.5 w-3.5 text-primary" />
                <span>Governing count</span>
              </p>
              {selectedRow.countDocNo ? (
                <div className="space-y-1 text-[11px]">
                  <p>
                    <span className="font-medium">{selectedRow.countDocNo}</span> · cutoff{" "}
                    {selectedRow.countCutoffDate ?? "not recorded"}
                  </p>
                  <p className="text-muted-foreground">
                    Count sheet recorded system {formatQty(selectedRow.countSystemQty)} and its own
                    variance of {formatSigned(selectedRow.countSourceVariance)} base units. This
                    report compares the count against the movement ledger instead, so a difference
                    between the two is itself the finding.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  No committed physical count covers this product at the selected cutoff, so no
                  counted figure exists and variance is undefined. Counting is performed in the
                  Physical Inventory module.
                </p>
              )}
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────────── */}
            <nav className="flex shrink-0 items-center gap-1 border-b px-4 py-2">
              {(
                [
                  { id: "documents", label: `Documents (${selectedRow.supportingDocuments.length})`, icon: ClipboardList },
                  { id: "exceptions", label: `Exceptions (${selectedRow.exceptionCodes.length + serialCount})`, icon: ScanLine },
                  { id: "references", label: `References (${selectedRow.adjustmentReferences.length})`, icon: Link2 },
                ] as { id: PanelTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <tab.icon className="h-3 w-3" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* ── Tab body ─────────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                >
                  {activeTab === "documents" ? (
                    selectedRow.supportingDocuments.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        No posted movement document falls inside the selected period for this
                        product.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {selectedRow.supportingDocuments.map((doc, index) => (
                          <li
                            key={`${doc.docNo}-${index}`}
                            className="rounded-lg border bg-muted/20 px-2.5 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[11px] font-medium">{doc.docNo}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {doc.docType}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[10px] tabular-nums text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileClock className="h-3 w-3" />
                                {doc.ts ? doc.ts.slice(0, 16).replace("T", " ") : "no timestamp"}
                              </span>
                              {doc.inBase ? <span className="text-emerald-600">in {formatQty(doc.inBase)}</span> : null}
                              {doc.outBase ? <span className="text-orange-600">out {formatQty(doc.outBase)}</span> : null}
                              {doc.countAdjustment ? (
                                <span>restated {formatSigned(doc.countAdjustment)}</span>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}

                  {activeTab === "exceptions" ? (
                    <div className="space-y-3">
                      {selectedRow.exceptionCodes.length === 0 && serialCount === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          This line reconciled cleanly: a committed count covers the cutoff and the
                          ledger agrees with it.
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedRow.exceptionCodes.map((code) => (
                              <ExceptionBadge key={code} code={code} />
                            ))}
                          </div>

                          {serialCount > 0 ? (
                            <div>
                              <p className="mb-1.5 text-[11px] font-semibold">
                                Unmatched counted serials
                              </p>
                              <ul className="space-y-1">
                                {selectedRow.serialExceptions.map((serial) => (
                                  <li
                                    key={`${serial.phNo}-${serial.serialNumber}`}
                                    className="rounded-md border bg-muted/20 px-2 py-1.5 text-[10px]"
                                  >
                                    <span className="font-medium">{serial.serialNumber}</span>
                                    <span className="text-muted-foreground">
                                      {" "}
                                      on {serial.phNo} — {serial.reason}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {voidedForBranch.length > 0 ? (
                            <div>
                              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                                <Undo2 className="h-3 w-3" />
                                <span>Void documents excluded across this branch</span>
                              </p>
                              <p className="mb-1.5 text-[10px] text-muted-foreground">
                                The movement ledger does not apply a later void, so these documents
                                were removed from every balance shown here.
                              </p>
                              <ul className="space-y-1">
                                {voidedForBranch.slice(0, 25).map((doc, index) => (
                                  <li
                                    key={`${doc.docNo}-${index}`}
                                    className="rounded-md border bg-muted/20 px-2 py-1 text-[10px]"
                                  >
                                    <span className="font-medium">{doc.docNo}</span>
                                    <span className="text-muted-foreground">
                                      {" "}
                                      {doc.docType} · in {formatQty(doc.inBase)} / out{" "}
                                      {formatQty(doc.outBase)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}

                  {activeTab === "references" ? (
                    selectedRow.adjustmentReferences.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        No offset or adjustment reference is attached to any count line for this
                        product.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {selectedRow.adjustmentReferences.map((reference) => (
                          <li
                            key={reference}
                            className="rounded-md border bg-muted/20 px-2 py-1.5 text-[10px]"
                          >
                            <span className="font-medium">{reference}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              · count line retained an offset match; netting is resolved in the
                              Physical Inventory offsetting module
                            </span>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
