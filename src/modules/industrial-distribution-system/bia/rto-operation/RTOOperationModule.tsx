// RTOOperationModule.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Main entry point for the BIA RTO Operation module.
// Thin orchestrator — mounts the Provider and composes UI sections.
// Pattern mirrors: CustomerCylinderAgingModule.tsx
// ──────────────────────────────────────────────────────────────────────────────

"use client";

import * as React from "react";
import { Store } from "lucide-react";
import { RTOOperationProvider } from "./providers/RTOOperationProvider";
import { useRTOOperation } from "./hooks/useRTOOperation";
import { RTOKPICards } from "./components/RTOKPICards";
import { RTODealerTable } from "./components/RTODealerTable";
import { RTODealerDetailView } from "./components/RTODealerDetailView";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// ── Inner content (must be inside provider) ───────────────────────────────────

function RTOOperationContent() {
  const { viewMode, backToList } = useRTOOperation();

  return (
    <div className="w-full min-w-0 space-y-4 animate-in fade-in duration-500">
      {/* ── Module Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black leading-tight">
            RTO Operation
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
            Business Intelligence & Analytics · Retail Trade Outlet Distribution
          </p>
        </div>
      </div>

      {/* ── KPI Summary Cards ──────────────────────────────────────────────── */}
      <RTOKPICards />

      {/* ── Dealer Masterlist Table ────────────────────────────────────────── */}
      <RTODealerTable />

      {/* ── Modal Detail View ──────────────────────────────────────────────── */}
      <Dialog
        open={viewMode === "detail"}
        onOpenChange={(open) => {
          if (!open) backToList();
        }}
      >
        <DialogContent className="max-w-[95vw] md:max-w-4xl h-[90vh] p-0 flex flex-col overflow-hidden bg-background">
          <DialogTitle className="sr-only">Dealer Details</DialogTitle>
          <RTODealerDetailView />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Module export ─────────────────────────────────────────────────────────────

export default function RTOOperationModule() {
  return (
    <RTOOperationProvider>
      <RTOOperationContent />
    </RTOOperationProvider>
  );
}
