"use client";

// ─── LpgBillingConsolidationModule.tsx ───────────────────────────────────────
// Module root component for the LPG Billing Consolidation reviewer.
// Composes the left (header list) and right (workspace) panels.
// The hook is initialized here and shared down via props to avoid prop drilling
// beyond the first level.
// ─────────────────────────────────────────────────────────────────────────────

import { useBillingConsolidation } from "./hooks/useBillingConsolidation";
import { ConsolidationHeaderList } from "./components/ConsolidationHeaderList";
import { ConsolidationWorkspace } from "./components/ConsolidationWorkspace";

export function LpgBillingConsolidationModule() {
  // Initialize the composer hook once at module root.
  // Both panels consume state from this single hook instance.
  const hook = useBillingConsolidation();

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      {/* ── Left Panel: Header List (~380px fixed width) ─────────────────── */}
      <div className="w-[380px] shrink-0 flex flex-col h-full min-h-0 overflow-hidden">
        <ConsolidationHeaderList hook={hook} />
      </div>

      {/* ── Right Panel: Workspace (flex-1) ──────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full min-h-0 overflow-hidden">
        <ConsolidationWorkspace hook={hook} />
      </div>
    </div>
  );
}
