// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/components/StatusBadge.tsx
// ==============================================================================
// Verification & Exception badge component for ledger transactions and rows.
// ==============================================================================

"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export function StatusBadge({
  isVerified,
  exceptionCount = 0,
}: {
  isVerified: boolean;
  exceptionCount?: number;
}) {
  if (exceptionCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-3 w-3" />
        <span>{exceptionCount} {exceptionCount === 1 ? "Exception" : "Exceptions"}</span>
      </span>
    );
  }

  if (isVerified) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        <span>Verified</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-muted bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      Pending
    </span>
  );
}
