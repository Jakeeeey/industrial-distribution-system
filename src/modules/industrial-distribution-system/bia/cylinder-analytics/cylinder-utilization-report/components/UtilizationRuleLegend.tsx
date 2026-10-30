// src/modules/industrial-distribution-system/bia/cylinder-analytics/cylinder-utilization-report/components/UtilizationRuleLegend.tsx
// ==============================================================================
// Applied-Rule Legend for the Cylinder Utilization Report (spec §4).
//
// The spec asks for the eligible statuses and the idle threshold to be "defined in
// settings"; the platform has no settings collection, so the rules are declared as
// constants in `cylinder-utilization.rules.ts` and echoed back by the BFF inside
// `reportData.rules`. Rendering them from the response — never from a hardcoded
// string in this component — is what keeps the published rule and the applied rule
// from drifting apart.
//
// Source-data limitations are rendered alongside because the report deliberately
// surfaces them instead of hiding them (same convention as the Stock Movement &
// Variance report).
//
// Complies with VoSync Design System standards:
// - Collapsed by default so the grid stays primary
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Info, TriangleAlert } from "lucide-react";
import { useCylinderUtilizationReport } from "../hooks/useCylinderUtilizationReport";
import { BucketBadge } from "./BucketBadge";
import type { UtilizationBucket } from "../types/cylinder-utilization-report.types";

export function UtilizationRuleLegend() {
  const { reportData } = useCylinderUtilizationReport();
  const [open, setOpen] = React.useState(false);

  const rules = reportData?.rules;
  const limitations = reportData?.limitations ?? [];

  if (!rules) return null;

  /** One legend entry per bucket: the statuses, conditions, and basis that resolve into it. */
  // AG-COMMENT: Plain-language explanations of the basis for Unavailable and Unclassified per user request
  const entries: Array<{ bucket: UtilizationBucket; detail: string; note: string; basis: string }> = [
    {
      bucket: "CIRCULATING",
      detail: rules.circulatingStatuses.join(", "),
      note: "Earning with customers or in delivery — numerator of the utilization ratio",
      basis: "Asset status WITH_CUSTOMER or LOADED, or verified delivery movement",
    },
    {
      bucket: "AVAILABLE",
      detail: `${rules.yardStatuses.join(", ")} — activity within ${rules.idleThresholdDays} days`,
      note: "Available in stock and active in working fleet, not dormant",
      basis: "In-stock status (AVAILABLE, FULL, EMPTY, RESERVED) with activity under 30 days",
    },
    {
      bucket: "IDLE",
      detail: `Same stock statuses — no activity for more than ${rules.idleThresholdDays} days`,
      note: "Usable fleet dormant in stock — primary opportunity for redeployment",
      basis: "In-stock status with no movement or audit stamp for >30 days",
    },
    {
      bucket: "MAINTENANCE",
      detail: `${rules.maintenanceStatuses.join(", ")} / condition ${rules.maintenanceConditions.join(", ")}`,
      note: "Eligible active fleet, but temporarily out of service pending repair",
      basis: "Tagged as DAMAGED status or condition FOR_REPAIR / DAMAGED",
    },
    {
      bucket: "UNAVAILABLE",
      detail: `${rules.unavailableStatuses.join(", ")} / condition ${rules.unavailableConditions.join(", ")}`,
      note: "Permanently removed from working fleet — excluded from the utilization denominator",
      basis: "Status LOST or RETIRED, or physical condition SCRAP (written off)",
    },
    {
      bucket: "UNCLASSIFIED",
      detail: "Status missing (blank/null) or outside standard system ENUM options",
      note: "Flagged as a data exception for review — excluded from denominator pending correction",
      basis: "Asset record lacks a valid status; requires data cleanup in Directus",
    },
  ];

  return (
    <div className="rounded-xl border bg-card shadow-2xs">
      {/* ── Toggle Row ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Applied Rules &amp; Source Limitations
          </span>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            Utilization = circulating ÷ eligible fleet × 100 · idle threshold {rules.idleThresholdDays} days
          </span>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden border-t"
          >
            <div className="space-y-4 p-4">
              {/* ── Bucket definitions ───────────────────────────────────── */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((entry) => (
                  <div key={entry.bucket} className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                    <BucketBadge bucket={entry.bucket} />
                    <p className="font-mono text-[11px] leading-relaxed text-foreground">
                      {entry.detail}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{entry.note}</p>
                    <div className="pt-1 border-t border-border/40 text-[10px] text-muted-foreground/80">
                      <strong>Basis:</strong> {entry.basis}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Last-activity basis ──────────────────────────────────── */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Last activity is resolved from the latest of
                </h4>
                <ul className="mt-1.5 space-y-1">
                  {rules.activityBasis.map((basis) => (
                    <li key={basis} className="flex items-start gap-1.5 text-[11px] text-foreground">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary" />
                      <span className="font-mono">{basis}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── Surfaced source limitations ──────────────────────────── */}
              {limitations.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    Source data limitations
                  </h4>
                  <ul className="mt-2 space-y-1.5">
                    {limitations.map((limitation) => (
                      <li key={limitation.code} className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                        <span className="font-mono font-bold">{limitation.code}</span>
                        <span className="mx-1.5 opacity-60">—</span>
                        {limitation.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
