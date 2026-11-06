// src/modules/industrial-distribution-system/bia/customer-cylinder-accountability/components/AccountabilityHeader.tsx
// ==============================================================================
// Header & Action Bar for Customer Cylinder Accountability Report
// Features: Module branding, Refresh trigger, Excel and PDF export dispatchers.
//
// Complies with VoSync Design System standards:
// - Modern typography & subtle micro-animations
// - Responsive action button strip
// - Full comments left behind for long-term maintainability
// ==============================================================================

"use client";

import * as React from "react";
import { FileSpreadsheet, RefreshCw, ShieldCheck } from "lucide-react";
import { useCustomerCylinderAccountability } from "../hooks/useCustomerCylinderAccountability";

export function AccountabilityHeader() {
  // AG-COMMENT: exportPdf removed per user requirement; only retaining Excel export
  const { refresh, exportExcel, isLoading, reportData } = useCustomerCylinderAccountability();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
      {/* ── Title & Subtitle ──────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Customer Cylinder Accountability Report
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Reconcile cylinder deposits, swaps, and accumulated physical custody balances.
            </p>
          </div>
        </div>
      </div>

      {/* ── Action Buttons Strip ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Refresh Action */}
        <button
          type="button"
          onClick={() => refresh()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted disabled:opacity-50"
          title="Refresh dataset from backend"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>

        {/* Export to Excel */}
        {/* AG-COMMENT: Sole export option retained - generates multi-sheet Excel workbook */}
        <button
          type="button"
          onClick={exportExcel}
          disabled={isLoading || !reportData?.rows?.length}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-400 disabled:opacity-50"
          title="Download report as multi-tab Excel workbook"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>Export Excel</span>
        </button>
      </div>
    </div>
  );
}
