// src/modules/industrial-distribution-system/supply-chain-management/inventory-management/stock-movement-and-variance-report/components/ExceptionBadge.tsx
// ==============================================================================
// Exception Chip for Stock Movement and Variance Report.
// Renders a data-exception code as a colour-coded, human-readable chip. Reporting
// only surfaces exceptions; correcting them stays in the originating module.
// ==============================================================================

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { VarianceExceptionCode } from "../types/stock-movement-variance.types";

/** Plain-language label per exception code, written for a supervisor not a dev. */
const EXCEPTION_META: Record<VarianceExceptionCode, { label: string; className: string }> = {
  NO_COUNT: {
    label: "No committed count",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  UNMATCHED_SERIAL: {
    label: "Unmatched serial",
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  },
  VOID_REVERSAL: {
    label: "Void reversal excluded",
    className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
  VARIANCE_DRIFT: {
    label: "Ledger / count drift",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  },
  POST_CUTOFF_MOVEMENT: {
    label: "Moved after cutoff",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  },
};

interface ExceptionBadgeProps {
  code: VarianceExceptionCode;
  className?: string;
}

/** A single exception chip. */
export function ExceptionBadge({ code, className }: ExceptionBadgeProps) {
  const meta = EXCEPTION_META[code];
  if (!meta) return null;

  return (
    <span
      title={code}
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

/** Reads the code list from a row and renders chips with an overflow counter. */
export function ExceptionBadgeGroup({
  codes,
  max = 2,
}: {
  codes: VarianceExceptionCode[];
  max?: number;
}) {
  if (codes.length === 0) {
    return (
      <span className="text-[10px] text-muted-foreground">None</span>
    );
  }

  const visible = codes.slice(0, max);
  const hidden = codes.length - visible.length;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {visible.map((code) => (
        <ExceptionBadge key={code} code={code} />
      ))}
      {hidden > 0 ? (
        <span className="text-[10px] font-medium text-muted-foreground">+{hidden}</span>
      ) : null}
    </span>
  );
}
