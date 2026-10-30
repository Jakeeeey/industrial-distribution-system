// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationDrawer.tsx
// ==============================================================================
// Slide-Over Details Panel for the Cylinder Utilization Report (spec §11).
//
// Shows the supporting cylinder records behind one branch × size grouping, the
// last-activity basis that decided each bucket, and the movement documents —
// including the reversals that were seen but deliberately not counted, so the
// reviewer can confirm the exclusion rather than take it on trust (spec §4, §5).
//
// Complies with VoSync Design System standards:
// - Framer Motion spring slide-in with backdrop blur, Escape to close
// - Bucket tabs re-query through the provider instead of filtering client-side
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  CalendarClock,
  ChevronDown,
  FileText,
  X,
  AlertTriangle,
  CheckCircle2,
  Cylinder,
} from "lucide-react";
import { useCylinderUtilizationReport } from "../hooks/useCylinderUtilizationReport";
import { BUCKET_LABELS, formatCount, formatCutoffLabel } from "../services";
import { BucketBadge } from "./BucketBadge";
import type {
  CylinderUtilizationAssetRecord,
  UtilizationBucket,
} from "../types/cylinder-utilization-report.types";

/** Tab order mirrors the classification precedence, with "All" first. */
const BUCKET_TABS: Array<UtilizationBucket | null> = [
  null,
  "CIRCULATING",
  "AVAILABLE",
  "IDLE",
  "MAINTENANCE",
  "UNAVAILABLE",
  "UNCLASSIFIED",
];

export function UtilizationDrawer() {
  const {
    selection,
    selectedBucket,
    detail,
    isDetailLoading,
    closeDetail,
    filterDetailByBucket,
  } = useCylinderUtilizationReport();

  // Escape closes the panel, matching the sibling BIA drawers.
  React.useEffect(() => {
    if (!selection) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection, closeDetail]);

  const assets = detail?.assets ?? [];
  const exceptionCount = assets.filter((asset) => asset.isException).length;

  return (
    <AnimatePresence>
      {selection && (
        <motion.div
          key="utilization-drawer-wrapper"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex justify-end overflow-hidden"
        >
          {/* ── Backdrop ─────────────────────────────────────────────────── */}
          <motion.div
            key="utilization-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="fixed inset-0 cursor-pointer bg-black/45 backdrop-blur-xs"
            onClick={closeDetail}
          />

          {/* ── Slide Sheet ──────────────────────────────────────────────── */}
          <motion.div
            key="utilization-drawer-sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280, mass: 0.8 }}
            className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l bg-background shadow-2xl"
          >
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="space-y-1 border-b bg-muted/20 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {selection.sizeLabel}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {selection.branchName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title="Close details panel"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <h2 className="text-lg font-bold text-foreground">Supporting Cylinder Records</h2>
              <p className="text-[11px] text-muted-foreground">
                {detail ? `${formatCount(detail.assets.length)} of the grouping` : "Loading grouping..."} · fleet read
                as at <span className="font-mono font-semibold">{formatCutoffLabel(detail?.reportingCutoff)}</span>
              </p>
            </div>

            {/* ── Bucket Tabs ──────────────────────────────────────────── */}
            <div className="flex gap-1 overflow-x-auto border-b px-4 py-2 text-[11px] font-semibold">
              {BUCKET_TABS.map((bucket) => {
                const active = selectedBucket === bucket;
                return (
                  <button
                    key={bucket ?? "ALL"}
                    type="button"
                    onClick={() => filterDetailByBucket(bucket)}
                    className={`whitespace-nowrap rounded-md border px-2.5 py-1.5 transition ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {bucket ? BUCKET_LABELS[bucket] : "All buckets"}
                  </button>
                );
              })}
            </div>

            {/* ── Body ─────────────────────────────────────────────────── */}
            <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {isDetailLoading ? (
                <div className="animate-pulse space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted" />
                  ))}
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-bold text-foreground">No cylinders in this bucket</h4>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Nothing in this branch and size resolves to {selectedBucket ? BUCKET_LABELS[selectedBucket] : "any"}{" "}
                    category as at the reporting cutoff.
                  </p>
                </div>
              ) : (
                <>
                  {exceptionCount > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[11px] font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        {formatCount(exceptionCount)} record(s) carry a status that is missing or outside the source ENUM
                        domain. They are reported separately and excluded from the utilization denominator (spec §8).
                      </span>
                    </div>
                  )}
                  {assets.map((asset) => (
                    <AssetCard key={asset.assetId} asset={asset} />
                  ))}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * One cylinder: its resolved bucket, the date and source that decided it, and the
 * movement documents retained as evidence. Supporting documents are collapsed by
 * default so a long grouping stays scannable.
 */
function AssetCard({ asset }: { asset: CylinderUtilizationAssetRecord }) {
  const [openDocs, setOpenDocs] = React.useState(false);

  return (
    <div
      className={`rounded-xl border p-3.5 text-xs transition ${
        asset.isException ? "border-destructive/40 bg-destructive/5" : "bg-card"
      }`}
    >
      {/* ── Identity row ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cylinder className="h-4 w-4" />
          </div>
          <div>
            <div className="font-mono text-xs font-bold text-foreground">{asset.serialNumber}</div>
            <div className="text-[11px] text-muted-foreground">
              {asset.sizeLabel} · {asset.branchName}
            </div>
          </div>
        </div>
        <BucketBadge bucket={asset.bucket} />
      </div>

      {/* ── Classification evidence ────────────────────────────────────── */}
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2.5 text-[11px] sm:grid-cols-4">
        <Field label="Status" value={asset.status || "— missing —"} mono />
        <Field label="Condition" value={asset.condition || "— missing —"} mono />
        {/* Labelled "Since activity", not "Idle": a circulating cylinder also has a
            dormancy span, and calling it idle would contradict its own badge. */}
        <Field label="Since activity" value={asset.idleDays === null ? "—" : `${asset.idleDays}d`} mono />
        <Field label="Customer" value={asset.customerCode || "In yard"} />
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
        <span>
          Last activity{" "}
          <span className="font-mono font-semibold text-foreground">{asset.lastActivityDate || "unknown"}</span>
          {asset.activityBasis && (
            <>
              {" "}from <span className="font-semibold text-foreground">{asset.activityBasis.replace(/_/g, " ")}</span>
            </>
          )}
        </span>
      </div>

      {asset.exceptionReason && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-[11px] font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{asset.exceptionReason}</span>
        </p>
      )}

      {/* ── Supporting documents ───────────────────────────────────────── */}
      {asset.movements.length > 0 && (
        <div className="mt-2.5 border-t pt-2">
          <button
            type="button"
            onClick={() => setOpenDocs((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Supporting movements ({asset.movements.length})
            </span>
            <motion.span animate={{ rotate: openDocs ? 180 : 0 }} transition={{ duration: 0.18 }}>
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {openDocs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <ul className="mt-2 space-y-1.5">
                  {asset.movements.map((doc) => (
                    <li
                      key={doc.id}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-[11px] ${
                        doc.counted ? "bg-muted/20" : "border-amber-500/30 bg-amber-500/5"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-foreground">
                          {doc.documentNo}
                          {doc.documentDate && <span className="text-muted-foreground"> · {doc.documentDate}</span>}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {doc.sourceModule.replace(/_/g, " ")} · {doc.documentStatus || "no status"}
                          {doc.customerCode ? ` · ${doc.customerCode}` : ""}
                        </div>
                        {doc.note && <div className="mt-0.5 text-[10px] text-muted-foreground italic">{doc.note}</div>}
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          doc.counted
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {doc.counted ? "Counted" : "Not counted"}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/** Compact label/value pair used inside the classification strip. */
function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`block truncate font-semibold text-foreground ${mono ? "font-mono text-[11px]" : "text-[11px]"}`} title={value}>
        {value}
      </span>
    </div>
  );
}
