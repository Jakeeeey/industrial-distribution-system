// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/components/OwnershipBadge.tsx
// ==============================================================================
// Micro-badge component displaying cylinder ownership classification.
// ==============================================================================

"use client";

import * as React from "react";
import type { CylinderOwnership } from "../types/customer-cylinder-accountability.types";

export function OwnershipBadge({ ownership }: { ownership?: CylinderOwnership }) {
  if (ownership === "CUSTOMER") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Customer
      </span>
    );
  }

  if (ownership === "MIXED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Mixed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      Company
    </span>
  );
}
